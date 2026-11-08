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
    const { orderedIds } = body

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 })
    }

    const test = await prisma.onlineTest.findFirst({
      where: { id },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && test.createdBy !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update order for each question in a transaction
    await prisma.$transaction(
      orderedIds.map((questionId: string, index: number) =>
        prisma.testQuestion.update({
          where: { id: questionId, testId: id },
          data: { order: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[OnlineTests] Questions reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder questions' }, { status: 500 })
  }
}