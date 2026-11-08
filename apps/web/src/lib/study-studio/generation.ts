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
        const sourceText = document.chunks
          .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
          .join('\n\n')
          .slice(0, 12000)

        const structured = await generateStructuredOutput<{
          nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
          edges: Array<{ id: string; source: string; target: string }>
        }>({
          userId,
          provider: input.provider,
          model: input.model,
          systemPrompt: 'You are ALEX, an academic knowledge-graph and mind-map generator. Extract the hierarchy of core concepts and their relationships from the provided document.',
          schemaDescription: `{
  "nodes": [
    { "id": "node-0", "label": "Central Topic", "position": { "x": 0, "y": 0 } }
  ],
  "edges": [
    { "id": "edge-0", "source": "node-0", "target": "node-1" }
  ]
}`,
          prompt: `Generate a structured concept mind map from "${document.title}":\n\n${sourceText}`,
          validate: (parsed) => {
            if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
              throw new Error('Model did not return valid mind map nodes')
            }
            const nodes = parsed.nodes.map((n: any, idx: number) => ({
              id: String(n.id || `node-${idx}`),
              label: String(n.label || `Concept ${idx + 1}`).slice(0, 160),
              position: {
                x: typeof n.position?.x === 'number' ? n.position.x : (idx % 3) * 260,
                y: typeof n.position?.y === 'number' ? n.position.y : Math.floor(idx / 3) * 140,
              },
            }))
            const edges = Array.isArray(parsed.edges)
              ? parsed.edges.map((e: any, idx: number) => ({
                  id: String(e.id || `edge-${idx}`),
                  source: String(e.source || nodes[0].id),
                  target: String(e.target || nodes[Math.min(idx + 1, nodes.length - 1)].id),
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

          if (sourceDocIdForDiagram) {
            const doc = await prisma.document.findFirst({
              where: { id: sourceDocIdForDiagram },
              include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 15 } },
            })
            if (!doc) {
              return { success: false, error: 'Source document not found', errorCode: 'DOCUMENT_NOT_FOUND' }
            }
            const hasAccess = await canAccessDocument({ id: userId, role: 'STUDENT' }, doc)
            if (!hasAccess) {
              return { success: false, error: 'Forbidden', errorCode: 'FORBIDDEN' }
            }
            docTitle = input.title || `${doc.title} — diagram`
            contextText = doc.chunks.map(c => c.content.trim()).join('\n\n').slice(0, 10000)
          }

          const structured = await generateStructuredOutput<{
            type: 'mermaid' | 'graphviz' | 'plantuml'
            title: string
            code: string
          }>({
            userId,
            provider: input.provider,
            model: input.model,
            systemPrompt:
              'You are ALEX, an academic diagram generator. Create a clear Mermaid flowchart or sequence diagram illustrating the core process or architecture in the provided content.',
            schemaDescription: `{
  "type": "mermaid",
  "title": "Diagram title",
  "code": "flowchart TD\\n  A[Step 1] --> B[Step 2]"
}`,
            prompt: `Generate a ${input.customType || 'mermaid'} diagram for "${docTitle}":\n\n${contextText}`,
            validate: (parsed) => {
              if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
                throw new Error('Model did not return valid diagram code')
              }
              return {
                type: (parsed.type || input.customType || 'mermaid') as 'mermaid' | 'graphviz' | 'plantuml',
                title: String(parsed.title || docTitle),
                code: parsed.code.trim(),
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
        const sourceText = document.chunks
          .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
          .join('\n\n')
          .slice(0, 16000)

        const structured = await generateStructuredOutput<{
          questions: Array<{
            id: string
            prompt: string
            options: string[]
            answer: number
            explanation?: string
          }>
        }>({
          userId,
          provider: input.provider,
          model: input.model,
          systemPrompt:
            'You are ALEX, an academic assessment generator. Create multiple-choice quiz questions grounded strictly in the provided document text.',
          schemaDescription: `{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question text testing understanding of the source material",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explanation of why the correct option is right, citing [Source X]"
    }
  ]
}`,
          prompt: `Generate up to ${targetCount} ${input.difficulty || 'medium'}-difficulty multiple-choice questions from "${document.title}":\n\n${sourceText}`,
          validate: (parsed) => {
            const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions
            if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
              throw new Error('Model did not return a non-empty questions array')
            }
            return {
              questions: rawQuestions.slice(0, targetCount).map((q: any, idx: number) => ({
                id: q.id || `q-${idx + 1}`,
                prompt: String(q.prompt || q.question || ''),
                options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.map(String) : ['True', 'False'],
                answer: typeof q.answer === 'number' ? q.answer : 0,
                explanation: q.explanation ? String(q.explanation) : undefined,
              })),
            }
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