import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import { canAccessDocument } from '@/lib/document-processing/access'
import {
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const body = await request.json()
    const { sourceDocId, title, count = 10, difficulty = 'medium', provider, model } = body

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const doc = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 30 } },
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
    const sourceText = doc.chunks
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
      userId: user.id,
      provider,
      model,
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
      prompt: `Generate up to ${targetCount} ${difficulty}-difficulty multiple-choice questions from "${doc.title}":\n\n${sourceText}`,
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
=======
    const { sourceDocId, title, count = 10 } = await request.json()
    const doc = await prisma.document.findFirst({ where: { id: sourceDocId, ownerId: user.id }, include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 30 } } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const lines = doc.chunks.flatMap(c => c.content.split(/\n+/)).map(s => s.trim()).filter(s => s.length > 30).slice(0, Math.min(Number(count) || 10, 50))
    const questions = lines.map((line, index) => ({ id: `q-${index}`, prompt: `Which statement is supported by the source material?`, options: [line.slice(0, 240), 'None of the above', 'The source does not address this', 'All statements are unrelated'], answer: 0 }))
    const quiz = await prisma.quiz.create({ data: { userId: user.id, title: title || `${doc.title} — quiz`, sourceDocId: doc.id, subjectId: doc.subjectId, difficulty: 'medium', questions } })
    return NextResponse.json({ quiz })
  } catch (error) { console.error('Quiz generation error:', error); return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 }) }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}
