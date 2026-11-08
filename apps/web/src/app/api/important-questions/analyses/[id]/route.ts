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

    const analysis = await prisma.questionAnalysis.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        priorityItems: {
          orderBy: [
            { priority: 'desc' },
            { frequency: 'desc' },
          ],
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    return NextResponse.json({ analysis: serializeBigInt(analysis) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Analysis detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const analysis = await prisma.questionAnalysis.findFirst({
      where: { id, userId: user.id },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    await prisma.questionAnalysis.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Analysis delete error:', error)
    return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 })
  }
}