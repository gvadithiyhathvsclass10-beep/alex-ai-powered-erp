import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import {
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'

export async function GET() {
  try {
    const user = await requireAuth()

    const quizzes = await prisma.quiz.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ quizzes })
  } catch (error) {
    console.error('Get quizzes error:', error)
    return NextResponse.json({ error: 'Failed to get quizzes' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('id')

    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 })
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
    if (!quiz || quiz.userId !== user.id) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    await prisma.quiz.delete({ where: { id: quizId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete quiz error:', error)
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { sourceDocId, title, count = 10, difficulty = 'medium', provider, model } = body

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const doc = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, doc)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!doc.chunks || doc.chunks.length === 0) {
      return NextResponse.json(
        { error: 'The document has no processed text yet' },
        { status: 422 }
      )
    }

    const targetCount = Math.min(Math.max(Number(count) || 10, 1), 30)
    const sourceChunks = doc.chunks
      .map((c, idx) => `[Source ${idx + 1}] (${doc.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content.trim()}`)
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
      userId: user.id,
      provider,
      model,
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
      prompt: `Generate up to ${targetCount} ${difficulty}-difficulty quiz questions from "${doc.title}" strictly based on the provided sources:\n\n${sourceChunks}\n\nRequirements:
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
        const maxSourceId = doc.chunks.length
        
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
        userId: user.id,
        title: title || `${doc.title} — quiz`,
        sourceDocId: doc.id,
        subjectId: doc.subjectId,
        difficulty: String(difficulty),
        questions: structured.data.questions,
      },
    })

    return NextResponse.json({
      quiz,
      provider: structured.provider,
      model: structured.model,
    })
  } catch (error) {
    console.error('[Quizzes] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate quiz')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
