import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const test = await prisma.onlineTest.findFirst({
      where: { id },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const questions = await prisma.testQuestion.findMany({
      where: { testId: id },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ questions: questions.map(serializeBigInt) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Questions list error:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()

    const test = await prisma.onlineTest.findFirst({
      where: { id },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const maxOrder = await prisma.testQuestion.aggregate({
      where: { testId: id },
      _max: { order: true },
    })

    const question = await prisma.testQuestion.create({
      data: {
        testId: id,
        questionNumber: String(body.questionNumber ?? String((maxOrder._max.order || 0) + 1)) as any,
        type: body.type,
        prompt: body.prompt,
        options: body.options || null,
        correctAnswer: body.correctAnswer || null,
        marks: Number(body.marks) || 1,
        negativeMarks: Number(body.negativeMarks) || 0,
        explanation: body.explanation?.trim() || null,
        unit: body.unit?.trim() || null,
        topic: body.topic?.trim() || null,
        difficulty: body.difficulty || 'MEDIUM',
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json({ question: serializeBigInt(question) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Question create error:', error)
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}