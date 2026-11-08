import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role === 'LECTURER' || user.role === 'ADMIN') {
      const whereClause =
        user.role === 'ADMIN'
          ? {}
          : { createdBy: user.id }

      const tests = await prisma.onlineTest.findMany({
        where: whereClause,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { questions: true, attempts: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ tests: tests.map(serializeBigInt) })
    }

    // For students, show published tests they can take
    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        subject: {
          include: {
            onlineTests: {
              include: {
                questions: true,
                attempts: {
                  where: { userId: user.id },
                },
              },
            },
          },
        },
      },
    })

    // Filter and transform in JavaScript
    const now = new Date()
    const tests = enrollments.flatMap(e =>
      e.subject.onlineTests
        .filter(t => t.isPublished && (!t.startTime || t.startTime <= now) && (!t.endTime || t.endTime >= now))
        .map(t => {
          // Count user attempts
          const userAttempts = t.attempts?.filter(a => a.userId === user.id) || []
          return {
            ...t,
            subject: { id: e.subject.id, name: e.subject.name, code: e.subject.code },
            _count: { questions: t.questions?.length || 0, attempts: t.attempts?.length || 0 },
            userAttempts,
            canAttempt: t.maxAttempts > userAttempts.length,
          }
        })
    )

    return NextResponse.json({ tests })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] List error:', error)
    return NextResponse.json({ error: 'Failed to list tests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (user.role !== 'LECTURER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only lecturers can create tests' }, { status: 403 })
    }

    const body = await request.json()
    const {
      subjectId,
      title,
      description,
      instructions,
      durationMinutes,
      totalMarks,
      passingMarks,
      testType,
      negativeMarking = 0,
      maxAttempts = 1,
      startTime,
      endTime,
      isProctored = false,
      shuffleQuestions = false,
      shuffleOptions = false,
    } = body

    if (!subjectId || !title || !durationMinutes || !totalMarks || !testType) {
      return NextResponse.json(
        { error: 'subjectId, title, durationMinutes, totalMarks, and testType are required' },
        { status: 400 }
      )
    }

    if (!['MCQ', 'WRITTEN', 'MIXED'].includes(testType)) {
      return NextResponse.json(
        { error: 'testType must be MCQ, WRITTEN, or MIXED' },
        { status: 400 }
      )
    }

    const test = await prisma.onlineTest.create({
      data: {
        subjectId,
        title: title.trim(),
        description: description?.trim() || null,
        instructions: instructions?.trim() || null,
        durationMinutes: Number(durationMinutes),
        totalMarks: Number(totalMarks),
        passingMarks: passingMarks ? Number(passingMarks) : null,
        testType,
        negativeMarking: Number(negativeMarking) || 0,
        maxAttempts: Number(maxAttempts) || 1,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isProctored: Boolean(isProctored),
        shuffleQuestions: Boolean(shuffleQuestions),
        shuffleOptions: Boolean(shuffleOptions),
        createdBy: user.id,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ test: serializeBigInt(test) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Create error:', error)
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }
}