import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import { processDocument } from '@/lib/document-processing/pipeline'
import { DocumentStatus } from '@prisma/client'
import { downloadFile } from '@/lib/storage/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, title: true } },
        notebook: { select: { id: true, title: true } },
        _count: { select: { chunks: true } },
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, doc)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify ownership for retry
    if (doc.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Reset document status to QUEUED
    await prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.QUEUED,
        errorMessage: null,
      },
    })

    // Create processing job
    await prisma.documentProcessingJob.create({
      data: {
        documentId: id,
        step: 'queued',
        status: DocumentStatus.QUEUED,
      },
    })

    // Get file from storage
    let buffer: Buffer
    try {
      buffer = await downloadFile(doc.storageBucket, doc.storagePath)
    } catch (storageError) {
      console.error('[Documents] Storage get error:', storageError)
      await prisma.document.update({
        where: { id },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: 'Failed to retrieve file from storage',
        },
      })
      return NextResponse.json({ error: 'Failed to retrieve file from storage' }, { status: 500 })
    }

    // Process document asynchronously
    processDocument({
      documentId: id,
      userId: user.id,
      fileBuffer: buffer,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      documentType: doc.documentType,
      subjectId: doc.subjectId,
      projectId: doc.projectId,
      notebookId: doc.notebookId,
    }).catch(async (err) => {
      console.error('[Documents] Retry processing error:', err)
      await prisma.document.update({
        where: { id },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : 'Processing failed',
        },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Retry error:', error)
    return NextResponse.json({ error: 'Failed to retry document processing' }, { status: 500 })
  }
}