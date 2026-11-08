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
      include: {
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            questionNumber: true,
            type: true,
            prompt: true,
            options: true,
            correctAnswer: true,
            marks: true,
            negativeMarks: true,
            explanation: true,
            unit: true,
            topic: true,
            difficulty: true,
            order: true,
          },
        },
        _count: { select: { questions: true, attempts: true } },
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // For students, check if they can access this test
    if (user.role === 'STUDENT') {
      if (!test.isPublished) {
        return NextResponse.json({ error: 'Test not available' }, { status: 403 })
      }
      const now = new Date()
      if (test.startTime && test.startTime > now) {
        return NextResponse.json({ error: 'Test has not started yet' }, { status: 403 })
      }
      if (test.endTime && test.endTime < now) {
        return NextResponse.json({ error: 'Test has ended' }, { status: 403 })
      }
    }

    // Check if user is lecturer and owns this test
    if (user.role === 'LECTURER' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // For students, remove correct answers from questions
    let questions: any[] = test.questions
    if (user.role === 'STUDENT') {
      questions = questions.map(q => {
        const { correctAnswer, ...rest } = q
        return rest
      })
    }

    return NextResponse.json({ 
      test: serializeBigInt({ ...test, questions }) 
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 })
  }
}

export async function PUT(
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

    const updatedTest = await prisma.onlineTest.update({
      where: { id },
      data: {
        title: body.title?.trim(),
        description: body.description?.trim() || null,
        instructions: body.instructions?.trim() || null,
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
        totalMarks: body.totalMarks ? Number(body.totalMarks) : undefined,
        passingMarks: body.passingMarks ? Number(body.passingMarks) : undefined,
        negativeMarking: body.negativeMarking ? Number(body.negativeMarking) : undefined,
        maxAttempts: body.maxAttempts ? Number(body.maxAttempts) : undefined,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : undefined,
        isProctored: body.isProctored !== undefined ? Boolean(body.isProctored) : undefined,
        shuffleQuestions: body.shuffleQuestions !== undefined ? Boolean(body.shuffleQuestions) : undefined,
        shuffleOptions: body.shuffleOptions !== undefined ? Boolean(body.shuffleOptions) : undefined,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ test: serializeBigInt(updatedTest) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Update error:', error)
    return NextResponse.json({ error: 'Failed to update test' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Delete related data first
    await prisma.integrityWarning.deleteMany({
      where: { attempt: { testId: id } },
    })
    await prisma.testAnswer.deleteMany({
      where: { attempt: { testId: id } },
    })
    await prisma.testAttempt.deleteMany({
      where: { testId: id },
    })
    await prisma.testQuestion.deleteMany({
      where: { testId: id },
    })
    await prisma.onlineTest.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
  }
}