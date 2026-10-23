import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client'
import {
  extractContent,
  validateUploadedFile,
  resolveDocumentType,
} from '@/lib/document-processing/extractors'
import { chunkBySemanticUnits } from '@/lib/document-processing/chunker'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { uploadFile, fileExists, downloadFile as storageDownloadFile } from '@/lib/storage/client'
import { canMutateDocument } from '@/lib/document-processing/access'
=======
import { DocumentStatus, DocumentType } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { extractContent } from '@/lib/document-processing/extractors'
import { chunkBySemanticUnits } from '@/lib/document-processing/chunker'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { uploadFile } from '@/lib/storage/client'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export interface ProcessingContext {
  documentId: string
  userId: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  documentType: DocumentType
  subjectId?: string
  projectId?: string
  notebookId?: string
}

<<<<<<< HEAD
export interface ProcessedDocumentSummary {
  id: string
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  documentType: DocumentType
  status: DocumentStatus
  pageCount: number
  chunksCount: number
  errorMessage: string | null
  processedAt: Date | null
  createdAt: Date
}

export function encodeEmbeddingToBytes(embedding: number[]): Buffer {
  const float32 = new Float32Array(embedding)
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength)
}

export function decodeEmbeddingFromBytes(bytes?: Buffer | Uint8Array | null): number[] | null {
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) return null
  const aligned = Buffer.from(bytes)
  const float32 = new Float32Array(
    aligned.buffer,
    aligned.byteOffset,
    aligned.byteLength / 4
  )
  return Array.from(float32)
}

export async function processDocument(
  context: ProcessingContext
): Promise<{ status: DocumentStatus; pageCount: number; chunksCount: number; tokenCount: number }> {
  const { documentId, userId, fileBuffer, mimeType, documentType } = context

  try {
    await updateStatus(documentId, DocumentStatus.EXTRACTING)

    const extracted = await extractContent(fileBuffer, documentType, mimeType)
    const normalizedText = (extracted.text || '').trim()
    if (!normalizedText) {
      throw new Error(`No readable text could be extracted from ${context.fileName}`)
    }
    const pageCount = Math.max(1, extracted.pages.length)
=======
export async function processDocument(context: ProcessingContext): Promise<void> {
  const { documentId, userId, fileBuffer, fileName, mimeType, documentType, subjectId, projectId, notebookId } = context

  try {
    await updateStatus(documentId, DocumentStatus.EXTRACTING)
    
    const extracted = await extractContent(fileBuffer, documentType, mimeType)
    const pageCount = extracted.pages.length
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    await prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount,
        metadata: extracted.metadata as Prisma.InputJsonValue,
        status: DocumentStatus.CHUNKING,
      },
    })

    await updateStatus(documentId, DocumentStatus.CHUNKING)
<<<<<<< HEAD

    const chunks = chunkBySemanticUnits(normalizedText, extracted.pages)
    if (chunks.length === 0) {
      throw new Error(`Document chunking produced 0 chunks for ${context.fileName}`)
    }
=======
    
    const chunks = chunkBySemanticUnits(extracted.text, extracted.pages)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.EMBEDDING },
    })

    await updateStatus(documentId, DocumentStatus.EMBEDDING)
<<<<<<< HEAD

=======
    
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const embeddingProvider = await getUserEmbeddingProvider(userId)
    if (!embeddingProvider) {
      throw new Error('No embedding provider configured for user')
    }

    const chunkTexts = chunks.map(c => c.content)
<<<<<<< HEAD
    const { embeddings, tokenCount } =
      chunkTexts.length > 0
        ? await embeddingProvider.provider.generateEmbeddings(chunkTexts)
        : { embeddings: [] as number[][], tokenCount: 0 }
=======
    const { embeddings, tokenCount } = await embeddingProvider.provider.generateEmbeddings(chunkTexts)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.INDEXING },
    })

    await updateStatus(documentId, DocumentStatus.INDEXING)

<<<<<<< HEAD
    const processedAt = new Date()

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddings[i] || []
        const embeddingBytes = embedding.length > 0 ? encodeEmbeddingToBytes(embedding) : null
        const chunkMetadata = {
          ...(chunk.metadata || {}),
          ...(embedding.length > 0 ? { embeddingModel: embeddingProvider.model } : {}),
        }

        await tx.documentChunk.create({
=======
    await prisma.$transaction(async (tx) => {
      const createdChunks: { id: string; chunkIndex: number }[] = []
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        const created = await tx.documentChunk.create({
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          data: {
            documentId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            sectionTitle: chunk.sectionTitle,
            tokenCount: chunk.tokenCount,
<<<<<<< HEAD
            embedding: embeddingBytes,
            metadata: chunkMetadata as Prisma.InputJsonValue,
          },
        })
=======
            metadata: chunk.metadata as Prisma.InputJsonValue,
          },
        })
        createdChunks.push({ id: created.id, chunkIndex: chunk.chunkIndex })
      }

      // Update embeddings using raw SQL since Prisma doesn't support vector type
      for (let i = 0; i < createdChunks.length; i++) {
        const chunk = createdChunks[i]
        const embedding = embeddings[i]
        const embeddingStr = '[' + embedding.join(',') + ']'
        await tx.$executeRawUnsafe(`UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`, embeddingStr, chunk.id)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.READY,
<<<<<<< HEAD
          errorMessage: null,
          processedAt,
=======
          processedAt: new Date(),
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          processorId: userId,
        },
      })
    })

    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'completed',
        status: DocumentStatus.READY,
<<<<<<< HEAD
        completedAt: processedAt,
        metadata: { chunksCreated: chunks.length, tokensUsed: tokenCount, pageCount },
      },
    })

    return {
      status: DocumentStatus.READY,
      pageCount,
      chunksCount: chunks.length,
      tokenCount,
    }
  } catch (error) {
    console.error('[Document Pipeline] Processing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown document processing error'
=======
        completedAt: new Date(),
        metadata: { chunksCreated: chunks.length, tokensUsed: tokenCount },
      },
    })
  } catch (error) {
    console.error('Document processing error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
<<<<<<< HEAD
        errorMessage,
      },
    })

=======
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    await prisma.documentProcessingJob.create({
      data: {
        documentId,
        step: 'failed',
        status: DocumentStatus.FAILED,
<<<<<<< HEAD
        errorMessage,
=======
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        completedAt: new Date(),
      },
    })
    throw error
  }
}

async function updateStatus(documentId: string, status: DocumentStatus) {
  await prisma.documentProcessingJob.create({
    data: {
      documentId,
      step: status.toLowerCase(),
      status,
      startedAt: new Date(),
    },
  })
}

export async function createDocumentRecord(
  userId: string,
  file: File,
  subjectId?: string,
  projectId?: string,
<<<<<<< HEAD
  notebookId?: string,
  customTitle?: string,
  description?: string
) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { documentType, normalizedMimeType } = validateUploadedFile(
    file.name,
    file.type,
    buffer
  )

  const crypto = await import('crypto')
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${userId}/${Date.now()}-${safeFileName}`
  const bucket = process.env.STORAGE_BUCKET_DOCUMENTS || 'documents'

  const uploadResult = await uploadFile(bucket, storagePath, buffer, {
    contentType: normalizedMimeType,
  })

  // Verify the file was actually persisted in storage
  const storedExists = await fileExists(bucket, uploadResult.path || storagePath)
  if (!storedExists) {
    throw new Error('Failed to verify stored file after upload')
  }

  const document = await prisma.document.create({
    data: {
      title: (customTitle || file.name).trim(),
      description: description ? description.trim() : null,
      fileName: file.name,
      fileSize: BigInt(buffer.byteLength),
      mimeType: normalizedMimeType,
      documentType,
      storagePath: uploadResult.path || storagePath,
      storageBucket: bucket,
=======
  notebookId?: string
) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  const crypto = await import('crypto')
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
  
  const documentType = getDocumentType(file.name, file.type)
  const storagePath = `${userId}/${Date.now()}-${file.name}`

  await uploadFile(
    process.env.STORAGE_BUCKET_DOCUMENTS || 'documents',
    storagePath,
    file,
    { contentType: file.type }
  )

  const document = await prisma.document.create({
    data: {
      title: file.name,
      fileName: file.name,
      fileSize: BigInt(file.size),
      mimeType: file.type,
      documentType,
      storagePath,
      storageBucket: process.env.STORAGE_BUCKET_DOCUMENTS || 'documents',
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      checksum,
      ownerId: userId,
      subjectId,
      projectId,
      notebookId,
      status: DocumentStatus.UPLOADED,
    },
  })

<<<<<<< HEAD
  return { document, buffer, storagePath: uploadResult.path || storagePath }
}

export function getDocumentType(fileName: string, mimeType = ''): DocumentType {
  return resolveDocumentType(fileName, mimeType)
}

export async function reprocessDocument(
  documentId: string,
  userId: string,
  userRole?: string
) {
=======
  return { document, buffer, storagePath }
}

function getDocumentType(fileName: string, mimeType: string): DocumentType {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const typeMap: Record<string, DocumentType> = {
    pdf: DocumentType.PDF,
    doc: DocumentType.DOC,
    docx: DocumentType.DOCX,
    txt: DocumentType.TXT,
    md: DocumentType.MARKDOWN,
    csv: DocumentType.CSV,
    xls: DocumentType.XLS,
    xlsx: DocumentType.XLSX,
    ppt: DocumentType.PPT,
    pptx: DocumentType.PPTX,
    png: DocumentType.PNG,
    jpg: DocumentType.JPG,
    jpeg: DocumentType.JPEG,
  }
  
  return typeMap[ext || ''] || DocumentType.OTHER
}

export async function reprocessDocument(documentId: string, userId: string) {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) throw new Error('Document not found')
<<<<<<< HEAD
  if (!canMutateDocument({ id: userId, role: userRole }, document)) {
    throw new Error('Unauthorized')
  }
=======
  if (document.ownerId !== userId) throw new Error('Unauthorized')
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

  await prisma.documentChunk.deleteMany({ where: { documentId } })
  await prisma.documentProcessingJob.deleteMany({ where: { documentId } })

  await prisma.document.update({
    where: { id: documentId },
<<<<<<< HEAD
    data: { status: DocumentStatus.QUEUED, errorMessage: null },
  })

  const buffer = await storageDownloadFile(document.storageBucket, document.storagePath)

  return processDocument({
=======
    data: { status: DocumentStatus.QUEUED },
  })

  const file = await downloadFile(document.storageBucket, document.storagePath)
  const buffer = file

  await processDocument({
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    documentId,
    userId,
    fileBuffer: buffer,
    fileName: document.fileName,
    mimeType: document.mimeType,
    documentType: document.documentType,
    subjectId: document.subjectId || undefined,
    projectId: document.projectId || undefined,
    notebookId: document.notebookId || undefined,
  })
}
<<<<<<< HEAD
=======

async function downloadFile(bucket: string, path: string): Promise<Buffer> {
  const { downloadFile: storageDownloadFile } = await import('@/lib/storage/client')
  return storageDownloadFile(bucket, path)
}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
