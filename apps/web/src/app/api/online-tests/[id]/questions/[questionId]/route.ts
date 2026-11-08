import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const user = await requireAuth()
    const { id, questionId } = await params
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

    const question = await prisma.testQuestion.findFirst({
      where: { id: questionId, testId: id },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const updatedQuestion = await prisma.testQuestion.update({
      where: { id: questionId },
      data: {
        type: body.type,
        prompt: body.prompt,
        options: body.options,
        correctAnswer: body.correctAnswer,
        marks: Number(body.marks) || 1,
        negativeMarks: Number(body.negativeMarks) || 0,
        explanation: body.explanation?.trim() || null,
        unit: body.unit?.trim() || null,
        topic: body.topic?.trim() || null,
        difficulty: body.difficulty,
      },
    })

    return NextResponse.json({ question: serializeBigInt(updatedQuestion) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Question update error:', error)
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const user = await requireAuth()
    const { id, questionId } = await params

    const test = await prisma.onlineTest.findFirst({
      where: { id },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const question = await prisma.testQuestion.findFirst({
      where: { id: questionId, testId: id },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    await prisma.testQuestion.delete({
      where: { id: questionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Question delete error:', error)
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }
}