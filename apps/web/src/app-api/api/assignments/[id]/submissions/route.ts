import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id, userId: user.id },
      orderBy: { submissionNumber: 'desc' },
      include: {
        attachments: true,
      },
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('Assignment submissions list error:', error)
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 })
  }
}