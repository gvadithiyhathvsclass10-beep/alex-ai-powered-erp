import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hybridSearch } from '@/lib/rag/vector-search'
<<<<<<< HEAD
import { getUserChatProvider, type AIProviderType } from '@/lib/rag/generation'
import { canAccessDocument } from '@/lib/document-processing/access'
import { formatAIServiceErrorResponse, extractJsonFromModelOutput } from '@/lib/ai/service'
=======
import { getUserChatProvider } from '@/lib/rag/generation'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
<<<<<<< HEAD
    const {
      question: rawQuestion,
      questionBank,
      sourceDocumentIds,
      supportingDocumentIds = [],
      answerMode = 'detailed',
      subjectId,
      provider,
      model,
    } = body

    const resolvedQuestion =
      typeof rawQuestion === 'string' && rawQuestion.trim()
        ? rawQuestion.trim()
        : typeof questionBank === 'string'
          ? questionBank
              .split(/\r?\n/)
              .map((l: string) => l.trim())
              .find(Boolean) || ''
          : ''

    if (!resolvedQuestion) {
=======
    const { question, sourceDocumentIds, supportingDocumentIds, answerMode, subjectId } = body

    if (!question || typeof question !== 'string') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }
    if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      return NextResponse.json({ error: 'At least one source document is required' }, { status: 400 })
    }

<<<<<<< HEAD
    const safeSupportingIds = Array.isArray(supportingDocumentIds) ? supportingDocumentIds : []

    // Verify document existence and user access permissions
    const allDocIds = [...new Set([...sourceDocumentIds, ...safeSupportingIds])]
    const docs = await prisma.document.findMany({
      where: { id: { in: allDocIds } },
      select: { id: true, ownerId: true, subjectId: true, projectId: true, notebookId: true },
    })

    if (docs.length === 0) {
      return NextResponse.json({ error: 'Selected documents not found' }, { status: 404 })
    }

    for (const doc of docs) {
      const hasAccess = await canAccessDocument(user, doc)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden: you do not have access to one or more selected documents' },
          { status: 403 }
        )
      }
    }

    const accessibleSourceIds = docs
      .filter(d => sourceDocumentIds.includes(d.id))
      .map(d => d.id)

    const chatProvider = await getUserChatProvider(
      user.id,
      provider as AIProviderType | undefined,
      model
    )

    // Perform hybrid search on source documents
    let searchResults = await hybridSearch({
      query: resolvedQuestion,
      userId: user.id,
      userRole: user.role,
      subjectId,
      documentIds: accessibleSourceIds,
      limit: 15,
      threshold: 0.3,
    })

    if (searchResults.length === 0 && accessibleSourceIds.length > 0) {
      const directChunks = await prisma.documentChunk.findMany({
        where: { documentId: { in: accessibleSourceIds } },
        orderBy: { chunkIndex: 'asc' },
        take: 10,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              fileName: true,
              documentType: true,
              ownerId: true,
            },
          },
        },
      })
      searchResults = directChunks.map(c => ({
        id: c.id,
        documentId: c.documentId,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
        tokenCount: c.tokenCount,
        similarity: 0.75,
        metadata: (c.metadata || {}) as Record<string, unknown>,
        document: c.document,
      }))
    }

    let supportingResults: Awaited<ReturnType<typeof hybridSearch>> = []
    if (safeSupportingIds.length > 0) {
      supportingResults = await hybridSearch({
        query: resolvedQuestion,
        userId: user.id,
        userRole: user.role,
        subjectId,
        documentIds: safeSupportingIds,
        limit: 10,
        threshold: 0.3,
=======
    const chatProvider = await getUserChatProvider(user.id)
    if (!chatProvider) {
      return NextResponse.json({ error: 'No AI provider configured for chat' }, { status: 400 })
    }

    // Verify document access
    const docs = await prisma.document.findMany({
      where: { id: { in: [...sourceDocumentIds, ...supportingDocumentIds] } },
      select: { id: true, ownerId: true },
    })
    const unauthorized = docs.some(d => d.ownerId !== user.id)
    if (unauthorized) {
      return NextResponse.json({ error: 'Unauthorized access to documents' }, { status: 403 })
    }

    // Perform hybrid search on source documents
    const searchResults = await hybridSearch({
      query: question,
      userId: user.id,
      subjectId,
      documentIds: sourceDocumentIds,
      limit: 15,
      threshold: 0.6,
    })

    // Also search supporting documents
    let supportingResults: Awaited<ReturnType<typeof hybridSearch>> = []
    if (supportingDocumentIds.length > 0) {
      supportingResults = await hybridSearch({
        query: question,
        userId: user.id,
        subjectId,
        documentIds: supportingDocumentIds,
        limit: 10,
        threshold: 0.5,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      })
    }

    const allResults = [...searchResults, ...supportingResults]

    if (allResults.length === 0) {
<<<<<<< HEAD
      return NextResponse.json(
        {
          error: 'No relevant information found in the selected documents',
          answer: 'I could not find any relevant information in your selected documents to answer this question.',
          citations: [],
          sources: [],
        },
        { status: 404 }
      )
    }

=======
      return NextResponse.json({
        error: 'No relevant information found in the selected documents',
        answer: 'I could not find any relevant information in your selected documents to answer this question.',
        citations: [],
        sources: [],
      }, { status: 404 })
    }

    // Build context for the model
    const primaryContext = searchResults.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const supportingContext = supportingResults.length > 0 
      ? '\n\nSUPPORTING REFERENCES:\n' + supportingResults.map((c, i) => 
          `[Ref ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
        ).join('\n\n---\n\n')
      : ''

    // Build system prompt based on answer mode
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const modePrompts = {
      short: `Provide a concise, direct answer. Include only the essential steps and final result.`,
      exam: `Provide a structured answer suitable for an exam response. Include: key definitions, relevant formulas, step-by-step derivation, and final answer clearly marked.`,
      detailed: `Provide a comprehensive, detailed solution. Include: topic overview, all relevant definitions, formulas with explanations, step-by-step calculations, tables where appropriate, diagram descriptions, and final answer with verification.`,
    }

    const systemPrompt = `You are ALEX, an expert academic solution generator. Generate a structured solution for the given question using ONLY the provided sources.

<<<<<<< HEAD
ANSWER MODE: ${String(answerMode).toUpperCase()}
${modePrompts[answerMode as keyof typeof modePrompts] || modePrompts.detailed}
=======
ANSWER MODE: ${answerMode.toUpperCase()}
${modePrompts[answerMode as keyof typeof modePrompts]}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

OUTPUT FORMAT (JSON):
{
  "questionNumber": "1",
<<<<<<< HEAD
  "originalQuestion": ${JSON.stringify(resolvedQuestion)},
  "topic": "Main topic/subject area",
  "explanation": "Clear explanation of the approach and key concepts",
  "definitions": ["Definition 1", "Definition 2"],
  "formulas": ["Formula 1", "Formula 2"],
  "calculations": "Step-by-step mathematical derivations",
  "tables": [{"headers": ["col1", "col2"], "rows": [["val1", "val2"]]}],
  "diagrams": [{"type": "mermaid", "definition": "flowchart TD\\n  A --> B", "title": "Diagram title"}],
=======
  "originalQuestion": "${question}",
  "topic": "Main topic/subject area",
  "explanation": "Clear explanation of the approach and key concepts",
  "definitions": ["Definition 1", "Definition 2", ...],
  "formulas": ["Formula 1", "Formula 2", ...],
  "calculations": "Step-by-step mathematical derivations",
  "tables": [{"headers": ["col1", "col2"], "rows": [["val1", "val2"]]}],
  "diagrams": [{"type": "mermaid|graphviz|plantuml|description", "definition": "diagram code or description", "title": "Diagram title"}],
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  "finalAnswer": "Final answer clearly stated",
  "citations": [{"id": "source-id", "documentTitle": "Title", "pageNumber": 1, "excerpt": "relevant excerpt"}]
}

RULES:
- Use ONLY information from the provided sources
- Cite sources using [Source X] format in explanations
<<<<<<< HEAD
- Never fabricate citations, page numbers, or formulas`

    const response = await chatProvider.generate({
      query: resolvedQuestion,
=======
- If sources don't support an answer, state "Not supported by sources"
- Never fabricate citations, page numbers, or formulas
- Distinguish between source-derived claims and general knowledge
- For diagrams, provide actual Mermaid/GraphViz code when applicable`

    const response = await chatProvider.generate({
      query: question,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      context: allResults,
      systemPrompt,
      temperature: 0.2,
      maxTokens: 4000,
    })

<<<<<<< HEAD
    let solutionData: Record<string, any>
    try {
      solutionData = extractJsonFromModelOutput(response.answer)
    } catch {
      solutionData = {
        questionNumber: '1',
        originalQuestion: resolvedQuestion,
        topic: 'Academic Solution',
        explanation: response.answer,
        definitions: [],
        formulas: [],
        calculations: '',
=======
    // Parse the JSON response
    let solutionData
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      const jsonMatch = response.answer.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : response.answer
      solutionData = JSON.parse(jsonStr)
    } catch (_parseError) {
      // Fallback: structure the response manually
      solutionData = {
        questionNumber: "1",
        originalQuestion: question,
        topic: "General",
        explanation: response.answer,
        definitions: [],
        formulas: [],
        calculations: "",
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        tables: [],
        diagrams: [],
        finalAnswer: response.answer,
        citations: response.citations,
      }
    }

<<<<<<< HEAD
    solutionData.questionNumber = String(solutionData.questionNumber || '1')
    solutionData.originalQuestion = String(solutionData.originalQuestion || resolvedQuestion)
    solutionData.topic = String(solutionData.topic || 'Academic Solution')
    solutionData.explanation = String(solutionData.explanation || response.answer)
    solutionData.finalAnswer = String(solutionData.finalAnswer || solutionData.explanation || response.answer)
    solutionData.calculations = String(solutionData.calculations || '')
    solutionData.definitions = Array.isArray(solutionData.definitions) ? solutionData.definitions : []
    solutionData.formulas = Array.isArray(solutionData.formulas) ? solutionData.formulas : []
    solutionData.tables = Array.isArray(solutionData.tables) ? solutionData.tables : []
    solutionData.diagrams = Array.isArray(solutionData.diagrams) ? solutionData.diagrams : []

    solutionData.citations = (response.citations.length > 0 ? response.citations : allResults.slice(0, 3)).map(
      (c: any, i: number) => ({
        id: c.id || allResults[i]?.id || `cite-${i}`,
        documentTitle: c.documentTitle || c.document?.title || allResults[i]?.document?.title || 'Document',
        pageNumber: c.pageNumber ?? allResults[i]?.pageNumber ?? null,
        excerpt:
          c.excerpt ||
          c.text ||
          (allResults[i]?.content
            ? allResults[i].content.slice(0, 150) + (allResults[i].content.length > 150 ? '...' : '')
            : ''),
      })
    )

    return NextResponse.json({
      ...solutionData,
      answerMode,
      provider: response.provider,
      model: response.model,
      sourcesUsed: allResults.length,
      tokenUsage: response.tokenUsage,
    })
  } catch (error) {
    console.error('[Solution Generate] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Solution generation failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
=======
    // Ensure citations are properly formatted
    solutionData.citations = response.citations.map((c: any, i: number) => ({
      id: c.id || allResults[i]?.id || `cite-${i}`,
      documentTitle: c.documentTitle || allResults[i]?.document?.title || "Unknown",
      pageNumber: c.pageNumber || allResults[i]?.pageNumber || null,
      excerpt: c.excerpt || allResults[i]?.content?.slice(0, 200) || "",
    }))

    solutionData.sources = allResults.map(r => ({
      id: r.id,
      documentId: r.documentId,
      content: r.content,
      pageNumber: r.pageNumber,
      similarity: r.similarity,
    }))
    solutionData.answerMode = answerMode
    solutionData.generatedAt = new Date().toISOString()

    return NextResponse.json(solutionData)
  } catch (error) {
    console.error('Solution generation error:', error)
    return NextResponse.json({ error: 'Solution generation failed' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}
