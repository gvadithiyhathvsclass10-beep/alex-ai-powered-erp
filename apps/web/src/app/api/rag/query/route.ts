import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hybridSearch, type SearchResult, type SearchContext } from '@/lib/rag/vector-search'
import { getUserChatProvider, type AIProviderType } from '@/lib/rag/generation'
import { canAccessDocument } from '@/lib/document-processing/access'
import { formatAIServiceErrorResponse } from '@/lib/ai/service'
import { extractContent, validateUploadedFile, resolveDocumentType } from '@/lib/document-processing/extractors'
import { chunkBySemanticUnits } from '@/lib/document-processing/chunker'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { encodeEmbeddingToBytes } from '@/lib/document-processing/pipeline'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'why',
  'when', 'where', 'who', 'which', 'are', 'was', 'were', 'can', 'could', 'would',
  'should', 'you', 'your', 'about', 'into', 'tell', 'explain', 'does', 'did',
  'have', 'has', 'had', 'they', 'them', 'their', 'its', 'there', 'here', 'more',
  'also', 'give', 'show', 'according', 'source', 'sources', 'document', 'documents',
  'notebook', 'paper', 'page', 'section',
])

function extractQueryTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function computeChunkTermOverlap(terms: string[], results: SearchResult[]): number {
  if (terms.length === 0 || results.length === 0) return results.length > 0 ? 1 : 0
  let maxMatched = 0
  for (const r of results) {
    const haystack = `${r.document.title} ${r.sectionTitle || ''} ${r.content}`.toLowerCase()
    const matched = terms.filter(t => haystack.includes(t)).length
    if (matched > maxMatched) maxMatched = matched
  }
  return maxMatched / terms.length
}

// Helper to parse request body - handles both JSON and FormData
async function parseRequestBody(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const body: Record<string, any> = {}
    
    for (const [key, value] of formData.entries()) {
      if (key === 'attachments') continue // Handle files separately if needed
      if (key === 'documentIds' || key === 'sourceIds') {
        try {
          body[key] = JSON.parse(value as string)
        } catch {
          body[key] = []
        }
      } else if (key === 'useDocuments') {
        body[key] = value === 'true'
      } else {
        body[key] = value
      }
    }
    
    // Handle file attachments
    const attachments: File[] = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('attachments[') && value instanceof File) {
        body.attachments = body.attachments || []
        body.attachments.push(value)
      }
    }
    
    return body
  }
  
  return request.json()
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await parseRequestBody(request)
    const {
      query,
      subjectId,
      projectId,
      notebookId,
      documentIds,
      sourceIds,
      limit,
      threshold,
      stream,
      conversationId,
      context: extraContext,
      provider,
      model,
      useDocuments,
    } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // If notebookId is specified, verify access and collect all notebook source documentIds
    // Notebooks are explicitly source-grounded workflows - always use documents
    let effectiveDocumentIds: string[] | undefined = Array.isArray(documentIds) && documentIds.length > 0
      ? [...documentIds]
      : undefined
    let effectiveNotebookId: string | undefined = notebookId || undefined
    let notebookEmptySources = false

    if (notebookId && prisma.researchNotebook?.findUnique) {
      const notebook = await prisma.researchNotebook.findUnique({
        where: { id: notebookId },
        include: {
          sources: { select: { id: true, documentId: true } },
          documents: { select: { id: true } },
        },
      })

      if (!notebook) {
        return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
      }
      if (notebook.ownerId !== user.id && !notebook.isPublic && user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const nbDocIds = new Set<string>()
      for (const s of notebook.sources || []) {
        if (s.documentId) nbDocIds.add(s.documentId)
      }
      for (const d of notebook.documents || []) {
        nbDocIds.add(d.id)
      }

      if (Array.isArray(sourceIds) && sourceIds.length > 0) {
        const filtered = new Set<string>()
        for (const sid of sourceIds) {
          if (nbDocIds.has(sid)) filtered.add(sid)
          const src = (notebook.sources || []).find(s => s.id === sid && s.documentId)
          if (src?.documentId) filtered.add(src.documentId)
        }
        effectiveDocumentIds = [...filtered]
      } else if (effectiveDocumentIds && effectiveDocumentIds.length > 0) {
        effectiveDocumentIds = effectiveDocumentIds.filter(id => nbDocIds.has(id))
      } else if (nbDocIds.size > 0) {
        effectiveDocumentIds = [...nbDocIds]
      } else {
        notebookEmptySources = true
        effectiveDocumentIds = []
      }
      effectiveNotebookId = undefined
    }

    // If querying a notebook that has 0 sources, immediately return a deterministic NO_SOURCES response
    if (notebookEmptySources) {
      let emptyConvId: string | null = conversationId || null
      if (!emptyConvId) {
        const createdConv = await prisma.conversation.create({
          data: {
            userId: user.id,
            title: query.slice(0, 80),
            projectId: projectId || null,
            notebookId: notebookId || null,
          },
        })
        emptyConvId = createdConv.id
      }
      const noSourcesAnswer =
        'Not supported by the provided notebook sources: This notebook has no processed source documents yet. Upload or link at least one source document to ask grounded questions.'
      const noSourcesNote =
        'No processed sources are available in this notebook — response is not backed by uploaded source documents.'

      if (emptyConvId) {
        await prisma.message.createMany({
          data: [
            { conversationId: emptyConvId, senderId: user.id, role: 'user', content: query },
            {
              conversationId: emptyConvId,
              senderId: user.id,
              role: 'assistant',
              content: noSourcesAnswer,
              metadata: {
                citations: [],
                sources: [],
                isSourceSupported: false,
                groundingStatus: 'NO_SOURCES',
                groundingNote: noSourcesNote,
              } as any,
            },
          ],
        })
      }

      return NextResponse.json({
        answer: noSourcesAnswer,
        citations: [],
        isSourceSupported: false,
        groundingStatus: 'NO_SOURCES',
        groundingNote: noSourcesNote,
        conversationId: emptyConvId,
        sources: [],
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
      })
    }

    // Verify access control if specific documentIds were requested directly
    if (!notebookId && effectiveDocumentIds && effectiveDocumentIds.length > 0) {
      const requestedDocs = await prisma.document.findMany({
        where: { id: { in: effectiveDocumentIds } },
        select: { id: true, ownerId: true, subjectId: true, projectId: true, notebookId: true },
      })
      if (requestedDocs.length === 0) {
        return NextResponse.json({ error: 'Requested documents not found' }, { status: 404 })
      }
      for (const doc of requestedDocs) {
        const allowed = await canAccessDocument(user, doc)
        if (!allowed) {
          return NextResponse.json(
            { error: 'Forbidden: you do not have access to one or more requested documents' },
            { status: 403 }
          )
        }
      }
    }

    const chatProvider = await getUserChatProvider(
      user.id,
      provider as AIProviderType | undefined,
      model
    )

    // Load conversation history if conversationId provided
    let conversationHistory: Array<{ role: string; content: string }> = []
    let targetConversationId: string | null = conversationId || null

    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      })
      if (conversation && conversation.userId === user.id) {
        conversationHistory = (conversation.messages || []).map(m => ({
          role: m.role,
          content: m.content,
        }))
      }
    }

    // Determine if we should perform document retrieval
    const shouldRetrieveDocuments = notebookId || (useDocuments && effectiveDocumentIds && effectiveDocumentIds.length > 0) || (body.attachments && body.attachments.length > 0)

    // Build retrieval query incorporating recent user turn context for follow-up questions
    const priorUserMessages = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-2)
      .map(m => m.content)
    const retrievalQuery =
      priorUserMessages.length > 0 ? `${priorUserMessages.join(' ')} ${query}` : query

    // Load user memories & academic context
    const [memories, enrollments, upcomingAssignments, attendanceSummary, plannerEvents] =
      await Promise.all([
        prisma.userMemory.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.subjectEnrollment.findMany({
          where: { userId: user.id, isActive: true },
          include: { subject: { include: { semester: true } } },
          take: 10,
        }),
        prisma.assignment.findMany({
          where: {
            subject: { enrollments: { some: { userId: user.id, isActive: true } } },
            dueDate: { gte: new Date() },
            isPublished: true,
          },
          include: { subject: true },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        prisma.attendanceRecord.findMany({
          where: { userId: user.id },
          include: { session: { include: { subject: true } } },
          orderBy: { markedAt: 'desc' },
          take: 50,
        }),
        prisma.plannerEvent.findMany({
          where: { userId: user.id, startTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 10,
        }),
      ])

    // Perform hybrid search across user's accessible documents ONLY when documents are explicitly requested
    let searchResults: SearchResult[] = []
    let searchContext: SearchContext = { searchMode: 'none', hasVectors: false }

    if (shouldRetrieveDocuments) {
      const result = await hybridSearch({
        query: retrievalQuery,
        userId: user.id,
        userRole: user.role,
        subjectId,
        projectId,
        notebookId: effectiveNotebookId,
        documentIds: effectiveDocumentIds,
        limit: limit || 10,
        threshold: threshold ?? 0.5,
      })
      searchResults = result.results
      searchContext = result.context
    }

    // Evaluate whether the query is actually supported by the retrieved source chunks
    const currentTerms = extractQueryTerms(query)
    const contextualTerms = extractQueryTerms(retrievalQuery)
    const isBroadOverviewQuery =
      /\b(summarize|summary|overview|main points|key takeaways|study guide|faq|what is this|what are these)\b/i.test(
        query
      )
    const currentOverlap = computeChunkTermOverlap(currentTerms, searchResults)
    const contextualOverlap = computeChunkTermOverlap(contextualTerms, searchResults)
    const hasRelevantSourceEvidence =
      searchResults.length > 0 &&
      (isBroadOverviewQuery ||
        currentOverlap > 0 ||
        (priorUserMessages.length > 0 && contextualOverlap > 0))

    const memoryContext =
      memories.length > 0
        ? '\n\nUSER MEMORIES (authoritative facts):\n' +
          memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')
        : ''

    const academicContext = `
${enrollments.length > 0 ? '\nCURRENT ENROLLMENTS:\n' + enrollments.map(e => `- ${e.subject.code}: ${e.subject.name} (${e.subject.semester?.name || 'N/A'})`).join('\n') : ''}
${upcomingAssignments.length > 0 ? '\nUPCOMING ASSIGNMENTS:\n' + upcomingAssignments.map(a => `- ${a.subject?.code}: ${a.title} (Due: ${new Date(a.dueDate).toLocaleDateString()})`).join('\n') : ''}
${attendanceSummary.length > 0 ? '\nRECENT ATTENDANCE:\n' + [...new Set(attendanceSummary.map(a => `${a.session.subject.code}: ${a.status}`))].slice(0, 10).join('\n') : ''}
${plannerEvents.length > 0 ? '\nUPCOMING EVENTS:\n' + plannerEvents.map(e => `- ${e.title} (${new Date(e.startTime).toLocaleString()})`).join('\n') : ''}
`.trim()

    const historyMessages = conversationHistory.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const systemPrompt = notebookId
      ? `You are ALEX, a source-grounded Research Notebook assistant.
Rules:
1. Answer questions using ONLY the provided notebook sources and conversation history.
2. Cite every source-supported claim using [Source X] format (which maps to the exact source title, page number, and section).
3. Clearly distinguish source-supported information from unsupported information: if the provided notebook sources do NOT contain the answer to the user's question, begin your response with "Not supported by the provided notebook sources:" and state clearly what is missing from the sources without fabricating any citations.
4. For follow-up questions, use the conversation history together with the provided sources and maintain accurate [Source X] citations.`
      : useDocuments
      ? `You are ALEX, a personal AI academic assistant. The user has enabled document context for this conversation.
Guidelines:
- Answer using the provided document sources, memories, and academic context
- Cite document sources using [Source X] format when referencing uploaded documents
- Reference memories as "According to your saved memory..."
- If document sources are empty or don't contain enough information, clearly state that no uploaded document supports the claim
- Be concise, accurate, and never fabricate citations, page numbers, or memories`
      : `You are ALEX, a personal AI academic assistant for a student. You have access to:
1. User-approved persistent memories (authoritative facts)
2. Academic context (enrollments, assignments, attendance, calendar)
3. Current page context (what the user is viewing)

Guidelines:
- Answer using memories and academic context
- Reference memories as "According to your saved memory..."
- Do not reference uploaded documents unless explicitly provided
- Be concise, accurate, and never fabricate citations, page numbers, or memories`

    const fullSystemPrompt =
      systemPrompt +
      `\n\nConversation History:\n${historyMessages.map(m => `${m.role}: ${m.content}`).join('\n') || 'None'}` +
      (notebookId || useDocuments ? '' : `\n\nMemories & Academic Context:\n${memoryContext}\n${academicContext}`) +
      `\n\nCurrent Page Context:\n${extraContext || 'None'}`

    const effectiveContextForGeneration = hasRelevantSourceEvidence ? searchResults : []

    // Process file attachments if any
    let attachmentContext: SearchResult[] = []
    if (body.attachments && body.attachments.length > 0) {
      try {
        const attachmentResults = await Promise.all(
          body.attachments.map(async (file: File) => {
            // Validate file type
            const { documentType, normalizedMimeType } = validateUploadedFile(
              file.name,
              file.type,
              Buffer.from(await file.arrayBuffer())
            )

            // Extract content
            const extracted = await extractContent(
              Buffer.from(await file.arrayBuffer()),
              documentType,
              normalizedMimeType
            )

            const normalizedText = (extracted.text || '').trim()
            if (!normalizedText) {
              return null
            }

            // Chunk the content
            const chunks = chunkBySemanticUnits(normalizedText, extracted.pages)
            if (chunks.length === 0) {
              return null
            }

            // Generate embeddings for the chunks
            const embeddingResult = await getUserEmbeddingProvider(user.id)
            if (!embeddingResult) {
              return null
            }

            const { embeddings } = await embeddingResult.provider.generateEmbeddings(
              chunks.map(c => c.content)
            )

            // Create search results for each chunk
            const searchResults: SearchResult[] = chunks.map((chunk, index) => ({
              id: `attachment-${file.name}-${index}`,
              documentId: `attachment-${file.name}`,
              content: chunk.content,
              chunkIndex: index,
              pageNumber: chunk.pageNumber,
              sectionTitle: chunk.sectionTitle,
              similarity: 1.0, // Attachments get maximum similarity since they're explicitly attached
              metadata: {
                attachmentName: file.name,
                attachmentType: file.type,
                chunkIndex: index,
              } as Record<string, unknown>,
              document: {
                id: `attachment-${file.name}`,
                title: file.name,
                fileName: file.name,
                documentType: documentType,
                ownerId: user.id,
              },
            }))

            return searchResults
          })
        )

        // Flatten and filter out null results
        attachmentContext = attachmentResults.flat().filter(Boolean) as SearchResult[]
      } catch (error) {
        console.warn('[RAG Query] Failed to process attachments:', error)
      }
    }

    // Combine search results with attachment context
    const combinedContext = [...attachmentContext, ...effectiveContextForGeneration]

    const effectiveContextForGenerationFinal = hasRelevantSourceEvidence ? combinedContext : []

    if (stream && 'generateStream' in chatProvider && typeof chatProvider.generateStream === 'function') {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of chatProvider.generateStream({
              query,
              context: effectiveContextForGenerationFinal,
              systemPrompt: fullSystemPrompt,
            })) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`))
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', citations: [] })}\n\n`))
          } catch (streamErr) {
            const msg = streamErr instanceof Error ? streamErr.message : 'Generation failed'
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const response = await chatProvider.generate({
      query,
      context: effectiveContextForGenerationFinal,
      systemPrompt: fullSystemPrompt,
    })

    // Determine explicit source-support classification
    const answerIndicatesUnsupported =
      /not supported by (?:the )?(?:provided |uploaded )?(?:notebook )?sources|no matching evidence was found|sources do not (?:contain|mention)|not mentioned in (?:the )?(?:provided )?sources/i.test(
        response.answer
      )

    const isSourceSupported = Boolean(
      hasRelevantSourceEvidence && !answerIndicatesUnsupported && effectiveContextForGenerationFinal.length > 0
    )

    // Ensure grounded responses carry accurate citations with source title, page, and section
    let finalCitations = isSourceSupported ? response.citations : []
    if (isSourceSupported && finalCitations.length === 0 && effectiveContextForGenerationFinal.length > 0) {
      const topSource = effectiveContextForGenerationFinal[0]
      finalCitations = [
        {
          id: topSource.id,
          documentId: topSource.documentId,
          documentTitle: topSource.document.title,
          pageNumber: topSource.pageNumber ?? null,
          sectionTitle: topSource.sectionTitle ?? null,
          excerpt: topSource.content.slice(0, 200) + (topSource.content.length > 200 ? '...' : ''),
          relevanceScore: topSource.similarity,
        },
      ]
    }

    const groundingStatus: 'SUPPORTED' | 'UNSUPPORTED' | 'NO_SOURCES' = shouldRetrieveDocuments && searchResults.length === 0
      ? 'NO_SOURCES'
      : isSourceSupported
        ? 'SUPPORTED'
        : shouldRetrieveDocuments
          ? 'UNSUPPORTED'
          : 'NO_SOURCES'

    const groundingNote =
      groundingStatus === 'SUPPORTED'
        ? `Grounded in ${finalCitations.length} cited source${finalCitations.length === 1 ? '' : 's'} (${[...new Set(finalCitations.map(c => `${c.documentTitle}${c.pageNumber ? ` p.${c.pageNumber}` : ''}${c.sectionTitle ? ` · ${c.sectionTitle}` : ''}`))].join(', ')}).`
        : groundingStatus === 'NO_SOURCES'
          ? 'No processed sources are available in this scope — response is not backed by uploaded source documents.'
          : useDocuments
            ? 'Not supported by the uploaded sources — the available documents do not contain evidence for this query.'
            : 'Answered without document context (general chat mode).'

    let finalAnswer = response.answer
    if (
      notebookId &&
      !isSourceSupported &&
      !/not supported by/i.test(finalAnswer)
    ) {
      finalAnswer = `Not supported by the provided notebook sources: ${finalAnswer}`
    }

    // Save conversation & messages
    if (!targetConversationId) {
      const createdConv = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: query.slice(0, 80),
          projectId: projectId || null,
          notebookId: notebookId || null,
        },
      })
      targetConversationId = createdConv.id
    }

    const serializedSources = (isSourceSupported ? effectiveContextForGenerationFinal : []).map(r => ({
      id: r.id,
      documentId: r.documentId,
      documentTitle: r.document.title,
      pageNumber: r.pageNumber,
      sectionTitle: r.sectionTitle,
      similarity: r.similarity,
      excerpt: r.content.slice(0, 200),
    }))

    if (targetConversationId) {
      await prisma.message.createMany({
        data: [
          {
            conversationId: targetConversationId,
            senderId: user.id,
            role: 'user',
            content: query,
          },
          {
            conversationId: targetConversationId,
            senderId: user.id,
            role: 'assistant',
            content: finalAnswer,
            metadata: {
              citations: finalCitations,
              sources: serializedSources,
              isSourceSupported,
              groundingStatus,
              groundingNote,
              provider: response.provider,
              model: response.model,
            } as any,
          },
        ],
      })
    }

    return NextResponse.json({
      answer: finalAnswer,
      citations: finalCitations,
      isSourceSupported,
      groundingStatus,
      groundingNote,
      provider: response.provider,
      model: response.model,
      conversationId: targetConversationId,
      sources: serializedSources,
      tokenUsage: response.tokenUsage,
      searchContext: {
        searchMode: searchContext.searchMode,
        embeddingModel: searchContext.embeddingModel,
        hasVectors: searchContext.hasVectors,
      },
    })
  } catch (error) {
    console.error('[RAG Query] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Query failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
