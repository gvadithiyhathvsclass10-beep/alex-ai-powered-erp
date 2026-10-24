import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canMutateDocument } from '@/lib/document-processing/access'
import { enqueueJob } from '@/lib/job-queue'
import { DocumentStatus } from '@prisma/client'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const document = await prisma.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!canMutateDocument(user, document)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Reset document to queued state
    await prisma.documentChunk.deleteMany({ where: { documentId: id } })
    await prisma.documentProcessingJob.deleteMany({ where: { documentId: id } })

    await prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.QUEUED, errorMessage: null },
    })

    // Create processing job record
    await prisma.documentProcessingJob.create({
      data: {
        documentId: id,
        step: 'queued',
        status: DocumentStatus.QUEUED,
      },
    })

    // Enqueue async document processing job
    const jobId = await enqueueJob({
      type: 'document_reprocess',
      documentId: id,
      userId: user.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      documentType: document.documentType,
      storageBucket: document.storageBucket,
      storagePath: document.storagePath,
    })

    return NextResponse.json({
      success: true,
      message: 'Document queued for reprocessing',
      jobId,
      status: DocumentStatus.QUEUED,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Retry error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry processing' },
      { status: 422 }
    )
  }
}