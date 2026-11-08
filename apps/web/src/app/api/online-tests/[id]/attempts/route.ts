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

    // Verify user is lecturer and owns the test
    const test = await prisma.onlineTest.findFirst({
      where: { id },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const attempts = await prisma.testAttempt.findMany({
      where: { testId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json({ attempts: attempts.map(serializeBigInt) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Attempts list error:', error)
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 })
  }
}