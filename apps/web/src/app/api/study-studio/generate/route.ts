import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { generateStudyMaterial, type GenerationContext } from '@/lib/study-studio/generation'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { type, sourceDocId, subjectId, input } = body

    if (!type || !['notes', 'flashcards', 'mindmaps', 'diagrams', 'quizzes'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const context: GenerationContext = {
      userId: user.id,
      sourceDocId,
      type: type as GenerationContext['type'],
      input: input || {},
    }

    const result = await generateStudyMaterial(context)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errorCode: result.errorCode, provider: result.provider, model: result.model },
        { status: result.errorCode === 'FORBIDDEN' ? 403 : result.errorCode === 'DOCUMENT_NOT_FOUND' ? 404 : result.errorCode === 'EMPTY_DOCUMENT' ? 422 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      provider: result.provider,
      model: result.model,
    })
  } catch (error) {
    console.error('[StudyStudio Generate] Error:', error)
    return NextResponse.json({ error: 'Failed to generate study material' }, { status: 500 })
  }
}