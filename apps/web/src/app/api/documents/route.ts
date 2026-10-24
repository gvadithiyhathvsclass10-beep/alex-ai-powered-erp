import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createDocumentRecord } from '@/lib/document-processing/pipeline'
import { DocumentValidationError } from '@/lib/document-processing/extractors'
import {
  canUploadToTarget,
  buildAccessibleDocumentsWhere,
} from '@/lib/document-processing/access'
import { DocumentStatus } from '@prisma/client'
import { enqueueJob } from '@/lib/job-queue'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = (formData.get('title') as string | null) || undefined
    const description = (formData.get('description') as string | null) || undefined
    const subjectId = ((formData.get('subjectId') as string | null) || '').trim() || undefined
    const projectId = ((formData.get('projectId') as string | null) || '').trim() || undefined
    const notebookId = ((formData.get('notebookId') as string | null) || '').trim() || undefined

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { error: 'No file provided', code: 'MISSING_FILE' },
        { status: 400 }
      )
    }

    // Verify user has permission to upload to the specified subject, project, or notebook
    if (subjectId || projectId || notebookId) {
      const targetCheck = await canUploadToTarget(user, { subjectId, projectId, notebookId })
      if (!targetCheck.allowed) {
        return NextResponse.json(
          { error: targetCheck.reason || 'Forbidden', code: 'FORBIDDEN_TARGET' },
          { status: targetCheck.statusCode || 403 }
        )
      }
    }

    const { document, buffer } = await createDocumentRecord(
      user.id,
      file,
      subjectId,
      projectId,
      notebookId,
      title,
      description
    )

    // Create processing job record
    await prisma.documentProcessingJob.create({
      data: {
        documentId: document.id,
        step: 'queued',
        status: DocumentStatus.QUEUED,
      },
    })

    // Enqueue async document processing job
    const jobId = await enqueueJob({
      type: 'document_process',
      documentId: document.id,
      userId: user.id,
      fileName: file.name,
      mimeType: document.mimeType,
      documentType: document.documentType,
      storageBucket: document.storageBucket,
      storagePath: document.storagePath,
    })

    // If uploaded into a research notebook, ensure a ResearchSource entry is linked
    if (notebookId && prisma.researchSource?.create) {
      try {
        await prisma.researchSource.create({
          data: {
            notebookId,
            documentId: document.id,
            title: document.title,
          },
        })
      } catch {
        // Non-fatal if source already exists
      }
    }

    return NextResponse.json({
      document: serializeBigInt({
        id: document.id,
        title: document.title,
        description: document.description ?? null,
        fileName: document.fileName,
        fileSize: document.fileSize.toString(),
        mimeType: document.mimeType,
        documentType: document.documentType,
        status: DocumentStatus.QUEUED,
        pageCount: null,
        chunksCount: 0,
        errorMessage: null,
        subject: null,
        project: null,
        notebook: null,
        processedAt: null,
        createdAt: document.createdAt,
      }),
      jobId,
      status: DocumentStatus.QUEUED,
      message: 'Document uploaded and queued for processing',
    })
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const subjectId = searchParams.get('subjectId')
    const projectId = searchParams.get('projectId')
    const notebookId = searchParams.get('notebookId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const scope = searchParams.get('scope')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    // If explicitly querying a specific subject/project/notebook, verify access
    if (
      (subjectId && subjectId !== 'current' && subjectId !== 'all') ||
      (projectId && projectId !== 'all') ||
      (notebookId && notebookId !== 'all')
    ) {
      const check = await canUploadToTarget(user, {
        subjectId: subjectId && subjectId !== 'current' && subjectId !== 'all' ? subjectId : undefined,
        projectId: projectId && projectId !== 'all' ? projectId : undefined,
        notebookId: notebookId && notebookId !== 'all' ? notebookId : undefined,
      })
      // Note: For notebooks, public notebooks are also readable
      if (!check.allowed && notebookId && prisma.researchNotebook?.findFirst) {
        const pubNb = await prisma.researchNotebook.findFirst({
          where: { id: notebookId, isPublic: true },
        })
        if (!pubNb) {
          return NextResponse.json(
            { error: check.reason || 'Forbidden' },
            { status: check.statusCode || 403 }
          )
        }
      } else if (!check.allowed) {
        return NextResponse.json(
          { error: check.reason || 'Forbidden' },
          { status: check.statusCode || 403 }
        )
      }
    }

    const where =
      scope === 'personal'
        ? { ownerId: user.id, ...(status && status !== 'all' ? { status: status as any } : {}) }
        : buildAccessibleDocumentsWhere(user, {
            subjectId,
            projectId,
            notebookId,
            status,
            search,
          })

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, title: true } },
          notebook: { select: { id: true, title: true } },
          _count: { select: { chunks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count ? prisma.document.count({ where }) : Promise.resolve(0),
    ])

    const effectiveTotal = total || documents.length

    return NextResponse.json({
      documents: documents.map(d =>
        serializeBigInt({
          id: d.id,
          title: d.title,
          description: d.description,
          fileName: d.fileName,
          fileSize: d.fileSize.toString(),
          mimeType: d.mimeType,
          documentType: d.documentType,
          status: d.status,
          errorMessage: d.errorMessage,
          pageCount: d.pageCount,
          subject: d.subject,
          project: d.project,
          notebook: d.notebook,
          chunksCount: d._count?.chunks ?? 0,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          processedAt: d.processedAt,
        })
      ),
      pagination: {
        page,
        limit,
        total: effectiveTotal,
        totalPages: Math.max(1, Math.ceil(effectiveTotal / limit)),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] List error:', error)
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
}
