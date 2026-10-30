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

    const job = await prisma.studyMaterialJob.findUnique({ where: { id } })
    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('[StudyJobs] Get error:', error)
    return NextResponse.json({ error: 'Failed to get job' }, { status: 500 })
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
    const { action } = body

    const job = await prisma.studyMaterialJob.findUnique({ where: { id } })
    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (action === 'retry' && job.status === 'failed') {
      const updated = await prisma.studyMaterialJob.update({
        where: { id },
        data: { status: 'pending', errorMessage: null, result: null },
      })
      return NextResponse.json({ job: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[StudyJobs] Action error:', error)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}