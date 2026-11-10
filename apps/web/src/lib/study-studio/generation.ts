import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessDocument } from '@/lib/document-processing/access'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import {
  summarizeAndAnalyzeDocument,
  generateStructuredOutput,
  formatAIServiceErrorResponse,
  type DocumentSummaryType,
} from '@/lib/ai/service'
import { saveDiagram, generateDiagramFromTemplate, type DiagramDefinition } from '@/lib/diagrams/generator'

export interface GenerationContext {
  userId: string
  sourceDocId: string
  type: 'notes' | 'flashcards' | 'mindmaps' | 'diagrams' | 'quizzes'
  input: Record<string, any>
}

export interface GenerationResult {
  success: boolean
  result?: any
  error?: string
  errorCode?: string
  provider?: string
  model?: string
}

export async function generateStudyMaterial(context: GenerationContext): Promise<GenerationResult> {
  try {
    const userId = context.userId
    const sourceDocId = context.sourceDocId
    const type = context.type
    const input = context.input || {}

    if (!sourceDocId) {
      return { success: false, error: 'sourceDocId is required', errorCode: 'MISSING_SOURCE_DOC' }
    }

    // Verify document access
    const document = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })

    if (!document) {
      return { success: false, error: 'Document not found', errorCode: 'DOCUMENT_NOT_FOUND' }
    }

    const hasAccess = await canAccessDocument({ id: userId, role: 'STUDENT' }, document)
    if (!hasAccess) {
      return { success: false, error: 'Forbidden', errorCode: 'FORBIDDEN' }
    }

    if (!document.chunks || document.chunks.length === 0) {
      return { success: false, error: 'The document has no processed text chunks yet', errorCode: 'EMPTY_DOCUMENT' }
    }

    let result: any

    switch (type) {
      case 'notes': {
        // Only Formula Sheet is allowed per requirements
        const analysisType: DocumentSummaryType = 'formulas'

        const summary = await summarizeAndAnalyzeDocument({
          userId,
          documentTitle: document.title,
          chunks: document.chunks,
          analysisType,
          customInstructions: input.customInstructions,
          provider: input.provider,
          model: input.model,
        })

        const material = await prisma.studyMaterial.create({
          data: {
            userId,
            title: summary.title,
            content: summary.content,
            type: summary.type,
            sourceDocId: document.id,
            subjectId: document.subjectId,
            tags: [summary.type, summary.provider.toLowerCase()],
            metadata: {
              provider: summary.provider,
              model: summary.model,
              tokenUsage: summary.tokenUsage,
            } as Prisma.InputJsonValue,
          },
        })

        result = { materialId: material.id, ...summary }
        break
      }

      case 'flashcards': {
        const targetCount = Math.min(Math.max(Number(input.count) || 10, 1), 50)
        const sourceText = document.chunks
          .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
          .join('\n\n')
          .slice(0, 16000)

        const structured = await generateStructuredOutput<{ cards: Array<{ front: string; back: string }> }>({
          userId,
          provider: input.provider,
          model: input.model,
          systemPrompt: 'You are ALEX, an academic flashcard generator. Create high-signal spaced-repetition flashcards strictly grounded in the provided document text.',
          schemaDescription: `{
  "cards": [
    {
      "front": "Clear, specific question testing a concept, formula, or definition from the text",
      "back": "Concise, accurate answer grounded in the source text with [Source X] citation"
    }
  ]
}`,
          prompt: `Generate up to ${targetCount} flashcards from "${document.title}":\n\n${sourceText}`,
          validate: (parsed) => {
            const rawCards = Array.isArray(parsed) ? parsed : parsed?.cards
            if (!Array.isArray(rawCards) || rawCards.length === 0) {
              throw new Error('Model did not return a non-empty cards array')
            }
            return {
              cards: rawCards
                .filter((c: any) => c && typeof c.front === 'string' && typeof c.back === 'string')
                .slice(0, targetCount)
                .map((c: any) => ({
                  front: c.front.trim(),
                  back: c.back.trim(),
                })),
            }
          },
        })

        const deck = await prisma.flashcardDeck.create({
          data: {
            userId,
            title: input.title || `${document.title} — flashcards`,
            sourceDocId: document.id,
            subjectId: document.subjectId,
            cards: {
              create: structured.data.cards.map(c => ({
                front: c.front,
                back: c.back,
              })),
            },
          },
          include: {
            cards: true,
            _count: { select: { cards: true } },
          },
        })

        result = { deckId: deck.id, deck, provider: structured.provider, model: structured.model }
        break
      }

      case 'mindmaps': {
        const sourceChunks = document.chunks
          .map((c, idx) => `[Source ${idx + 1}] (${document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content.trim()}`)
          .join('\n\n---\n\n')
          .slice(0, 16000)

        const structured = await generateStructuredOutput<{
          nodes: Array<{ id: string; label: string; position: { x: number; y: number }; sourceIds?: number[] }>
          edges: Array<{ id: string; source: string; target: string; sourceIds?: number[] }>
        }>({
          userId,
          provider: input.provider,
          model: input.model,
          systemPrompt: 'You are ALEX, an academic knowledge-graph and mind-map generator. Extract the hierarchy of core concepts and their relationships from the provided document. CRITICAL: Every node and edge MUST be grounded in the provided source text. Do not invent concepts or relationships not present in the source. Include sourceIds arrays (1-indexed chunk numbers) for each node and edge.',
          schemaDescription: `{
  "nodes": [
    { "id": "node-0", "label": "Central Topic", "position": { "x": 0, "y": 0 }, "sourceIds": [1] }
  ],
  "edges": [
    { "id": "edge-0", "source": "node-0", "target": "node-1", "sourceIds": [1, 2] }
  ]
}`,
          prompt: `Generate a structured concept mind map from "${document.title}" strictly based on the provided sources:\n\n${sourceChunks}\n\nRequirements:
- Only include concepts explicitly present in the source text
- Include sourceIds (1-indexed chunk numbers) for each node and edge
- If the source does not contain enough information, indicate this with a node labeled "Insufficient source data"`,
          validate: (parsed) => {
            if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
              throw new Error('Model did not return valid mind map nodes')
            }
            const maxSourceId = document.chunks.length
            
            // Validate source references
            for (const node of parsed.nodes) {
              if (node.sourceIds && Array.isArray(node.sourceIds)) {
                for (const sourceId of node.sourceIds) {
                  if (typeof sourceId !== 'number' || sourceId < 1 || sourceId > maxSourceId) {
                    throw new Error(`Invalid node source reference: ${sourceId}. Must be between 1 and ${maxSourceId}`)
                  }
                }
              }
            }
            for (const edge of parsed.edges || []) {
              if (edge.sourceIds && Array.isArray(edge.sourceIds)) {
                for (const sourceId of edge.sourceIds) {
                  if (typeof sourceId !== 'number' || sourceId < 1 || sourceId > maxSourceId) {
                    throw new Error(`Invalid edge source reference: ${sourceId}. Must be between 1 and ${maxSourceId}`)
                  }
                }
              }
            }

            const nodes = parsed.nodes.map((n: any, idx: number) => ({
              id: String(n.id || `node-${idx}`),
              label: String(n.label || `Concept ${idx + 1}`).slice(0, 160),
              position: {
                x: typeof n.position?.x === 'number' ? n.position.x : (idx % 3) * 260,
                y: typeof n.position?.y === 'number' ? n.position.y : Math.floor(idx / 3) * 140,
              },
              sourceIds: Array.isArray(n.sourceIds) ? n.sourceIds : [],
            }))
            const edges = Array.isArray(parsed.edges)
              ? parsed.edges.map((e: any, idx: number) => ({
                  id: String(e.id || `edge-${idx}`),
                  source: String(e.source || nodes[0]?.id || `node-0`),
                  target: String(e.target || nodes[Math.min(idx + 1, nodes.length - 1)]?.id || `node-0`),
                  sourceIds: Array.isArray(e.sourceIds) ? e.sourceIds : [],
                }))
              : []
            return { nodes, edges }
          },
        })

        const map = await prisma.mindMap.create({
          data: {
            userId,
            title: input.title || `${document.title} — mind map`,
            sourceDocId: document.id,
            subjectId: document.subjectId,
            nodes: structured.data.nodes,
            edges: structured.data.edges,
          },
        })

        result = { mindMap: map, provider: structured.provider, model: structured.model }
        break
      }

      case 'diagrams': {
        let definition: DiagramDefinition
        let usedProvider: string | undefined
        let usedModel: string | undefined

        // Use top-level sourceDocId from context, not from input
        const sourceDocIdForDiagram = sourceDocId

        const isPlaceholderMermaid =
          input.customCode === 'flowchart TD\n  A[Source document] --> B[Key concepts]' && Boolean(sourceDocIdForDiagram)

        if (input.templateId) {
          definition = await generateDiagramFromTemplate(input.templateId, input.variables || {})
          if (input.title) definition.title = input.title
        } else if (input.customCode && input.customType && !isPlaceholderMermaid) {
          definition = {
            type: input.customType,
            code: input.customCode,
            title: input.title || 'Custom Diagram',
          }
        } else if (sourceDocIdForDiagram || input.prompt) {
          let contextText = input.prompt || ''
          let docTitle = input.title || 'Generated Diagram'
          let sourceChunks: Array<{ content: string; pageNumber?: number | null; sectionTitle?: string | null }> = []

          if (sourceDocIdForDiagram) {
            const doc = await prisma.document.findFirst({
              where: { id: sourceDocIdForDiagram },
              include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
            })
            if (!doc) {
              return { success: false, error: 'Source document not found', errorCode: 'DOCUMENT_NOT_FOUND' }
            }
            const hasAccess = await canAccessDocument({ id: userId, role: 'STUDENT' }, doc)
            if (!hasAccess) {
              return { success: false, error: 'Forbidden', errorCode: 'FORBIDDEN' }
            }
            docTitle = input.title || `${doc.title} — diagram`
            sourceChunks = doc.chunks.map(c => ({
              content: c.content.trim(),
              pageNumber: c.pageNumber,
              sectionTitle: c.sectionTitle,
            }))
            contextText = sourceChunks
              .map((c, idx) => `[Source ${idx + 1}] (${docTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`)
              .join('\n\n---\n\n')
              .slice(0, 16000)
          }

          const structured = await generateStructuredOutput<{
            type: 'mermaid' | 'graphviz' | 'plantuml'
            title: string
            code: string
            sourceReferences?: Array<{ elementId: string; sourceIds: number[] }>
          }>({
            userId,
            provider: input.provider,
            model: input.model,
            systemPrompt:
              'You are ALEX, an academic diagram generator. Create a clear Mermaid flowchart or sequence diagram illustrating the core process or architecture in the provided content. CRITICAL: Every element in the diagram MUST be grounded in the provided source text. Do not invent concepts, steps, or relationships not present in the source. Include sourceReferences array mapping diagram elements to source chunk indices.',
            schemaDescription: `{
  "type": "mermaid",
  "title": "Diagram title",
  "code": "flowchart TD\\n  A[Step 1 from Source 1] --> B[Step 2 from Source 2]",
  "sourceReferences": [
    { "elementId": "A", "sourceIds": [1] },
    { "elementId": "B", "sourceIds": [2] }
  ]
}`,
            prompt: `Generate a ${input.customType || 'mermaid'} diagram for "${docTitle}" strictly based on the provided sources:\n\n${contextText}\n\nRequirements:
- Only include concepts, steps, and relationships explicitly present in the source text
- Cite source chunks using [Source X] references in node labels where possible
- If the source does not contain enough information for a complete diagram, indicate this in the diagram (e.g., add a node "Insufficient source data for this section")
- Return sourceReferences array mapping element IDs to source chunk numbers (1-indexed)`,
            validate: (parsed) => {
              if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
                throw new Error('Model did not return valid diagram code')
              }
              
              // Validate source references if provided
              if (parsed.sourceReferences && Array.isArray(parsed.sourceReferences)) {
                for (const ref of parsed.sourceReferences) {
                  if (!ref.elementId || !Array.isArray(ref.sourceIds)) {
                    throw new Error('Invalid sourceReferences format')
                  }
                  for (const sourceId of ref.sourceIds) {
                    if (typeof sourceId !== 'number' || sourceId < 1 || sourceId > sourceChunks.length) {
                      throw new Error(`Invalid source reference: ${sourceId}. Must be between 1 and ${sourceChunks.length}`)
                    }
                  }
                }
              }
              
              return {
                type: (parsed.type || input.customType || 'mermaid') as 'mermaid' | 'graphviz' | 'plantuml',
                title: String(parsed.title || docTitle),
                code: parsed.code.trim(),
                sourceReferences: parsed.sourceReferences,
              }
            },
          })

          definition = structured.data
          usedProvider = structured.provider
          usedModel = structured.model
        } else {
          return { success: false, error: 'Either templateId, customCode+customType, sourceDocId, or prompt is required', errorCode: 'MISSING_INPUT' }
        }

        const saved = await saveDiagram(userId, definition, sourceDocIdForDiagram, input.subjectId)

        result = {
          id: saved.id,
          title: saved.title,
          type: saved.type,
          definition: saved.definition,
          provider: usedProvider,
          model: usedModel,
          createdAt: saved.createdAt,
        }
        break
      }

      case 'quizzes': {
        const targetCount = Math.min(Math.max(Number(input.count) || 10, 1), 30)
        const sourceChunks = document.chunks
          .map((c, idx) => `[Source ${idx + 1}] (${document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content.trim()}`)
          .join('\n\n---\n\n')
          .slice(0, 20000)

        const structured = await generateStructuredOutput<{
          questions: Array<{
            id: string
            prompt: string
            options: string[]
            answer: number
            explanation?: string
            sourceIds?: number[]
            questionType?: 'multiple-choice' | 'true-false' | 'short-answer'
          }>
        }>({
          userId,
          provider: input.provider,
          model: input.model,
          systemPrompt:
            'You are ALEX, an academic assessment generator. Create quiz questions grounded strictly in the provided document text. CRITICAL: Every question MUST be answerable from the source text. Do not invent concepts. Include sourceIds (1-indexed chunk numbers) for each question. Support multiple-choice, true-false, and short-answer types.',
          schemaDescription: `{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question text testing understanding of the source material",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explanation of why the correct option is right, citing [Source X]",
      "sourceIds": [1, 2],
      "questionType": "multiple-choice"
    }
  ]
}`,
          prompt: `Generate up to ${targetCount} ${input.difficulty || 'medium'}-difficulty quiz questions from "${document.title}" strictly based on the provided sources:\n\n${sourceChunks}\n\nRequirements:
- Questions must be answerable from the provided sources only
- Include sourceIds (1-indexed chunk numbers) for each question
- Support types: "multiple-choice" (4 options), "true-false" (2 options), "short-answer" (no options)
- For multiple-choice: exactly one correct answer
- For true-false: answer is 0 (true) or 1 (false)
- If the source does not contain enough information for ${targetCount} questions, generate fewer`,
          validate: (parsed) => {
            const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions
            if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
              throw new Error('Model did not return a non-empty questions array')
            }
            const maxSourceId = document.chunks.length
            
            const validatedQuestions = rawQuestions.slice(0, targetCount).map((q: any, idx: number) => {
              const questionType = q.questionType || (q.options?.length === 2 ? 'true-false' : 'multiple-choice')
              const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options.map(String) : 
                questionType === 'true-false' ? ['True', 'False'] : ['Option A', 'Option B', 'Option C', 'Option D']
              
              // Validate source references
              if (q.sourceIds && Array.isArray(q.sourceIds)) {
                for (const sourceId of q.sourceIds) {
                  if (typeof sourceId !== 'number' || sourceId < 1 || sourceId > maxSourceId) {
                    throw new Error(`Invalid question source reference: ${sourceId}. Must be between 1 and ${maxSourceId}`)
                  }
                }
              }
              
              // Validate answer index
              const answer = typeof q.answer === 'number' ? q.answer : 0
              if (answer < 0 || answer >= options.length) {
                throw new Error(`Invalid answer index: ${answer} for ${options.length} options`)
              }
              
              return {
                id: q.id || `q-${idx + 1}`,
                prompt: String(q.prompt || q.question || ''),
                options,
                answer,
                explanation: q.explanation ? String(q.explanation) : undefined,
                sourceIds: Array.isArray(q.sourceIds) ? q.sourceIds : [],
                questionType,
              }
            })
            
            return { questions: validatedQuestions }
          },
        })

        const quiz = await prisma.quiz.create({
          data: {
            userId,
            title: input.title || `${document.title} — quiz`,
            sourceDocId: document.id,
            subjectId: document.subjectId,
            difficulty: String(input.difficulty || 'medium'),
            questions: structured.data.questions,
          },
        })

        result = { quiz, provider: structured.provider, model: structured.model }
        break
      }

      default:
        return { success: false, error: `Unknown type: ${type}`, errorCode: 'INVALID_TYPE' }
    }

    return { success: true, result, provider: result?.provider, model: result?.model }
  } catch (error) {
    console.error('[StudyStudio] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate study material')
    return {
      success: false,
      error: formatted.body.error,
      errorCode: formatted.body.code,
      provider: formatted.body.provider,
      model: formatted.body.model,
    }
  }
}