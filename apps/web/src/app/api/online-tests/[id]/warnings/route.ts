import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { attemptId, warningType, details } = body

    // Valid warning types
    const validTypes = ['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'RIGHT_CLICK']
    if (!validTypes.includes(warningType)) {
      return NextResponse.json({ error: 'Invalid warning type' }, { status: 400 })
    }

    // Verify attempt belongs to user
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: attemptId, userId: user.id, testId: id },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Attempt not in progress' }, { status: 400 })
    }

    // Create warning
    const warning = await prisma.integrityWarning.create({
      data: {
        attemptId,
        warningType,
        details: details || {},
      },
    })

    // Update attempt warning count
    const updatedAttempt = await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        integrityWarnings: { increment: 1 },
        lastWarningAt: new Date(),
      },
    })

    // Check for auto-submission (5 warnings)
    let autoSubmitted = false
    if (updatedAttempt.integrityWarnings >= 5) {
      // Auto-submit the attempt
      await prisma.testAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'AUTO_SUBMITTED',
          autoSubmitted: true,
          autoSubmitReason: `Auto-submitted after 5 integrity warnings (last: ${warningType})`,
          submittedAt: new Date(),
        },
      })
      autoSubmitted = true
    }

    return NextResponse.json({ 
      warning: warning,
      warningsCount: updatedAttempt.integrityWarnings,
      autoSubmitted,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Warning error:', error)
    return NextResponse.json({ error: 'Failed to record warning' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const attemptId = searchParams.get('attemptId')

    if (!attemptId) {
      return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
    }

    // Verify access
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: attemptId, testId: id },
      include: {
        warnings: { orderBy: { timestamp: 'asc' } },
      },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    // Students can only see their own warnings, lecturers can see all for their tests
    if (user.role === 'STUDENT' && attempt.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.role === 'LECTURER') {
      const test = await prisma.onlineTest.findFirst({ where: { id } })
      if (!test || test.createdBy !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ warnings: attempt.warnings })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Warnings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch warnings' }, { status: 500 })
  }
}