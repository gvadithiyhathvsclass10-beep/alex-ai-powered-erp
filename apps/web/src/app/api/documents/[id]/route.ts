import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument, canUploadToTarget } from '@/lib/document-processing/access'
import { DocumentStatus } from '@prisma/client'
import { deleteFile } from '@/lib/storage/client'

export async function GET(
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
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          select: {
            id: true,
            content: true,
            chunkIndex: true,
            pageNumber: true,
            sectionTitle: true,
            tokenCount: true,
          },
        },
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

    return NextResponse.json({
      document: serializeBigInt({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileSize: doc.fileSize.toString(),
        mimeType: doc.mimeType,
        documentType: doc.documentType,
        status: doc.status,
        errorMessage: doc.errorMessage,
        pageCount: doc.pageCount,
        subject: doc.subject,
        project: doc.project,
        notebook: doc.notebook,
        chunks: doc.chunks,
        chunksCount: doc._count.chunks,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        processedAt: doc.processedAt,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Detail error:', error)
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const { title, description } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify ownership
    if (doc.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, title: true } },
        notebook: { select: { id: true, title: true } },
        _count: { select: { chunks: true } },
      },
    })

    return NextResponse.json({
      document: serializeBigInt({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        fileName: updated.fileName,
        fileSize: updated.fileSize.toString(),
        mimeType: updated.mimeType,
        documentType: updated.documentType,
        status: updated.status,
        errorMessage: updated.errorMessage,
        pageCount: updated.pageCount,
        subject: updated.subject,
        project: updated.project,
        notebook: updated.notebook,
        chunksCount: updated._count.chunks,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        processedAt: updated.processedAt,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Update error:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify ownership
    if (doc.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete from storage
    try {
      await deleteFile(doc.storageBucket, doc.storagePath)
    } catch (storageError) {
      console.error('[Documents] Storage delete error:', storageError)
      // Continue with database deletion even if storage delete fails
    }

    // Delete related records
    await prisma.$transaction([
      prisma.documentChunk.deleteMany({ where: { documentId: id } }),
      prisma.documentProcessingJob.deleteMany({ where: { documentId: id } }),
      prisma.documentVersion.deleteMany({ where: { documentId: id } }),
      prisma.document.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}