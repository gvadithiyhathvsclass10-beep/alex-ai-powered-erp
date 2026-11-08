import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { action } = body // 'start' | 'submit' | 'save-answer'

    const test = await prisma.onlineTest.findFirst({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if test is accessible
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

    // Get or create attempt
    const existingAttempt = await prisma.testAttempt.findFirst({
      where: { testId: id, userId: user.id },
      orderBy: { attemptNumber: 'desc' },
    })

    let attempt = existingAttempt
    let isNewAttempt = false

    if (!attempt || attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED' || attempt.status === 'EXPIRED' || attempt.status === 'GRADED') {
      // Check max attempts
      const attemptCount = await prisma.testAttempt.count({
        where: { testId: id, userId: user.id },
      })
      
      if (attemptCount >= test.maxAttempts) {
        return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 400 })
      }

      attempt = await prisma.testAttempt.create({
        data: {
          testId: id,
          userId: user.id,
          attemptNumber: attemptCount + 1,
          status: 'IN_PROGRESS',
          totalMarks: test.totalMarks,
          timeRemaining: test.durationMinutes * 60,
        },
      })
      isNewAttempt = true
    }

    if (action === 'start') {
      // Initialize answers for all questions
      const answersData = test.questions.map(q => ({
        attemptId: attempt.id,
        questionId: q.id,
        answer: null,
        timeSpent: 0,
      }))

      await prisma.testAnswer.createMany({
        data: answersData,
        skipDuplicates: true,
      })

      return NextResponse.json({ 
        attempt: serializeBigInt(attempt),
        test: {
          id: test.id,
          title: test.title,
          durationMinutes: test.durationMinutes,
          totalMarks: test.totalMarks,
          testType: test.testType,
          questions: test.questions.map(q => ({
            id: q.id,
            questionNumber: q.questionNumber,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            unit: q.unit,
            topic: q.topic,
            difficulty: q.difficulty,
          })),
        },
        isNewAttempt,
      })
    }

    if (action === 'save-answer') {
      const { questionId, answer, timeSpent } = body

      await prisma.testAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: attempt.id,
            questionId,
          },
        },
        update: {
          answer,
          timeSpent: { increment: timeSpent || 0 },
        },
        create: {
          attemptId: attempt.id,
          questionId,
          answer,
          timeSpent: timeSpent || 0,
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'submit') {
      // Calculate score for MCQ questions
      let obtainedMarks = 0
      const mcqQuestions = test.questions.filter(q => ['SINGLE_CORRECT', 'MULTIPLE_SELECT'].includes(q.type))
      
      for (const q of mcqQuestions) {
        const answerRecord = await prisma.testAnswer.findUnique({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: q.id,
            },
          },
        })

        if (answerRecord && answerRecord.answer !== null) {
          let isCorrect = false
          const correctAnswer = q.correctAnswer

          if (q.type === 'SINGLE_CORRECT') {
            isCorrect = answerRecord.answer === correctAnswer
          } else if (q.type === 'MULTIPLE_SELECT') {
            const userAns = Array.isArray(answerRecord.answer) ? answerRecord.answer : []
            const correctAns = Array.isArray(correctAnswer) ? correctAnswer : []
            isCorrect = userAns.length === correctAns.length && userAns.every(v => correctAns.includes(v))
          }

          if (isCorrect) {
            obtainedMarks += q.marks
          } else if (q.negativeMarks > 0) {
            obtainedMarks -= q.negativeMarks
          }

          await prisma.testAnswer.update({
            where: { id: answerRecord.id },
            data: {
              isCorrect,
              marksAwarded: isCorrect ? q.marks : (q.negativeMarks > 0 ? -q.negativeMarks : 0),
            },
          })
        }
      }

      // For written questions, mark as pending grading
      const writtenQuestions = test.questions.filter(q => ['SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL'].includes(q.type))
      for (const q of writtenQuestions) {
        const answerRecord = await prisma.testAnswer.findUnique({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: q.id,
            },
          },
        })
        if (answerRecord) {
          await prisma.testAnswer.update({
            where: { id: answerRecord.id },
            data: { isCorrect: null, marksAwarded: null },
          })
        }
      }

      const submittedAt = new Date()
      const timeRemaining = Math.max(0, attempt.timeRemaining || 0)

      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUBMITTED',
          submittedAt,
          obtainedMarks: test.questions.some(q => ['SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL'].includes(q.type)) ? null : obtainedMarks,
          timeRemaining,
        },
      })

      return NextResponse.json({ 
        success: true,
        attemptId: attempt.id,
        obtainedMarks: test.questions.some(q => ['SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL'].includes(q.type)) ? 'Pending grading' : obtainedMarks,
        totalMarks: test.totalMarks,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Attempt error:', error)
    return NextResponse.json({ error: 'Failed to process attempt' }, { status: 500 })
  }
}