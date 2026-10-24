import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getJobStatus } from '@/lib/job-queue'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    // If jobId is provided, check Redis job status
    if (jobId) {
      const jobStatus = await getJobStatus(jobId)
      if (!jobStatus) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json(jobStatus)
    }

    // Otherwise, check document status from database
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        pageCount: true,
        processedAt: true,
        ownerId: true,
        _count: { select: { chunks: true } },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify access
    if (document.ownerId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      documentId: document.id,
      status: document.status,
      errorMessage: document.errorMessage,
      pageCount: document.pageCount,
      chunksCount: document._count?.chunks ?? 0,
      processedAt: document.processedAt,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get document status' },
      { status: 500 }
    )
  }
}