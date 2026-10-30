import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { type, sourceDocId, subjectId, input } = body

    if (!type || !['notes', 'flashcards', 'mindmaps', 'diagrams', 'quizzes'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    // Verify document access
    const doc = await prisma.document.findFirst({
      where: { id: sourceDocId },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, doc)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for existing pending/processing job for same user+doc+type
    const existingJob = await prisma.studyMaterialJob.findFirst({
      where: {
        userId: user.id,
        sourceDocId,
        type,
        status: { in: ['pending', 'processing'] },
      },
    })

    if (existingJob) {
      return NextResponse.json({
        job: existingJob,
        message: 'Job already in progress',
      })
    }

    // Create job
    const job = await prisma.studyMaterialJob.create({
      data: {
        userId: user.id,
        type,
        status: 'pending',
        sourceDocId,
        subjectId: subjectId || doc.subjectId,
        input: input || {},
      },
    })

    return NextResponse.json({ job })
  } catch (error) {
    console.error('[StudyJobs] Create error:', error)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('id')

    if (jobId) {
      const job = await prisma.studyMaterialJob.findUnique({ where: { id: jobId } })
      if (!job || job.userId !== user.id) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json(job)
    }

    const jobs = await prisma.studyMaterialJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('[StudyJobs] List error:', error)
    return NextResponse.json({ error: 'Failed to get jobs' }, { status: 500 })
  }
}