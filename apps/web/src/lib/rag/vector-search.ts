import { prisma } from '@/lib/prisma'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
<<<<<<< HEAD
import { decodeEmbeddingFromBytes } from '@/lib/document-processing/pipeline'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
import { Prisma } from '@prisma/client'

export interface SearchOptions {
  query: string
  userId: string
<<<<<<< HEAD
  userRole?: string
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  limit?: number
  threshold?: number
  filter?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  metadata: Record<string, unknown>
  document: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

<<<<<<< HEAD
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function buildAccessibleDocumentWhere(options: SearchOptions): Prisma.DocumentWhereInput {
  const { userId, userRole, subjectId, projectId, notebookId, documentIds } = options
  const accessClause: Prisma.DocumentWhereInput =
    userRole === 'ADMIN'
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { subject: { enrollments: { some: { userId, isActive: true } } } },
            { subject: { lecturers: { some: { userId } } } },
            { project: { members: { some: { userId } } } },
            { notebook: { ownerId: userId } },
            { notebook: { isPublic: true } },
          ],
        }

  return {
    AND: [
      accessClause,
      ...(subjectId ? [{ subjectId }] : []),
      ...(projectId ? [{ projectId }] : []),
      ...(notebookId ? [{ notebookId }] : []),
      ...(documentIds && documentIds.length > 0 ? [{ id: { in: documentIds } }] : []),
    ],
  }
}

export async function vectorSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, limit = 10, threshold = 0.5 } = options

  const embeddingProvider = await getUserEmbeddingProvider(userId)
  if (!embeddingProvider) {
=======
interface RawSearchResult {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  metadata: Record<string, unknown>
  document_id: string
  document_title: string
  document_fileName: string
  document_documentType: string
  document_ownerId: string
}

export async function vectorSearch(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, subjectId, projectId, notebookId, documentIds, limit = 10, threshold = 0.7 } = options

  const embeddingProvider = await getUserEmbeddingProvider(userId)
  if (!embeddingProvider) {
    // No embedding provider available, return empty results
    // Keyword search will still work
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return []
  }

  try {
    const { embeddings } = await embeddingProvider.provider.generateEmbeddings([query])
    const queryEmbedding = embeddings[0]
<<<<<<< HEAD
    if (!queryEmbedding || queryEmbedding.length === 0) return []

    const rows = await prisma.documentChunk.findMany({
      where: {
        document: buildAccessibleDocumentWhere(options),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            documentType: true,
            ownerId: true,
          },
        },
      },
      take: 500,
    })

    const effectiveThreshold = embeddingProvider.model === 'mock' ? -1 : threshold

    return rows
      .map(row => {
        const meta = (row.metadata || {}) as Record<string, unknown>
        const vector =
          decodeEmbeddingFromBytes(row.embedding) ||
          (Array.isArray(meta.embedding) ? (meta.embedding as number[]) : null)
        if (!vector) return null
        const sim = cosineSimilarity(queryEmbedding, vector)
        return { row, similarity: sim }
      })
      .filter((item): item is { row: (typeof rows)[number]; similarity: number } =>
        Boolean(item && item.similarity >= effectiveThreshold)
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ row, similarity }) => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: Math.max(0, Number(similarity)),
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
  } catch (error) {
=======

    const chunks = await prisma.$queryRaw<RawSearchResult[]>`
      SELECT 
        dc.id,
        dc."documentId",
        dc.content,
        dc."chunkIndex",
        dc."pageNumber",
        dc."sectionTitle",
        1 - (dc.embedding <=> ${queryEmbedding}::vector) as similarity,
        dc.metadata,
        d.id as "document_id",
        d.title as "document_title",
        d."fileName" as "document_fileName",
        d."documentType" as "document_documentType",
        d."ownerId" as "document_ownerId"
      FROM "DocumentChunk" dc
      JOIN "Document" d ON dc."documentId" = d.id
      WHERE 1 - (dc.embedding <=> ${queryEmbedding}::vector) >= ${threshold}
      AND (
        d."ownerId" = ${userId}
        OR EXISTS (
          SELECT 1 FROM "SubjectEnrollment" se 
          WHERE se."subjectId" = d."subjectId" 
          AND se."userId" = ${userId} 
          AND se."isActive" = true
        )
        OR EXISTS (
          SELECT 1 FROM "ProjectMember" pm 
          WHERE pm."projectId" = d."projectId" 
          AND pm."userId" = ${userId}
        )
        OR EXISTS (
          SELECT 1 FROM "ResearchNotebook" rn 
          WHERE rn.id = d."notebookId" 
          AND rn."ownerId" = ${userId}
        )
      )
      ${subjectId ? Prisma.sql`AND d."subjectId" = ${subjectId}` : Prisma.empty}
      ${projectId ? Prisma.sql`AND d."projectId" = ${projectId}` : Prisma.empty}
      ${notebookId ? Prisma.sql`AND d."notebookId" = ${notebookId}` : Prisma.empty}
      ${documentIds && documentIds.length > 0 ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` : Prisma.empty}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `

    return chunks.map(chunk => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      sectionTitle: chunk.sectionTitle,
      similarity: Number(chunk.similarity),
      metadata: chunk.metadata,
      document: {
        id: chunk.document_id,
        title: chunk.document_title,
        fileName: chunk.document_fileName,
        documentType: chunk.document_documentType,
        ownerId: chunk.document_ownerId,
      },
    }))
  } catch (error) {
    // Vector search failed (e.g., pgvector not available in SQLite)
    // Fall back to keyword search only
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    console.warn('Vector search failed, falling back to keyword search:', error)
    return []
  }
}

export async function keywordSearch(options: SearchOptions): Promise<SearchResult[]> {
<<<<<<< HEAD
  const { query, limit = 10 } = options

  try {
    const rows = await prisma.documentChunk.findMany({
      where: {
        document: buildAccessibleDocumentWhere(options),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            documentType: true,
            ownerId: true,
          },
        },
      },
      take: 500,
    })

    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'why',
      'are', 'was', 'were', 'can', 'you', 'about', 'into', 'tell', 'explain',
      'summarize', 'summary', 'document', 'file', 'uploaded', 'please',
    ])

    const rawTerms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
    const terms = rawTerms.filter(t => !stopWords.has(t))
    const activeTerms = terms.length > 0 ? terms : rawTerms

    if (activeTerms.length === 0) {
      return rows.slice(0, limit).map(row => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: 0.5,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
    }

    const scored = rows
      .map(row => {
        const lowerContent = row.content.toLowerCase()
        const lowerTitle = row.document.title.toLowerCase()
        const matchedCount = activeTerms.filter(
          term => lowerContent.includes(term) || lowerTitle.includes(term)
        ).length
        const score = matchedCount / activeTerms.length
        return { row, score }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: score,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))

    if (scored.length > 0) {
      return scored
    }

    // If user asked a general summarization/analysis query over accessible documents, return leading chunks
    if (rows.length > 0) {
      return rows.slice(0, limit).map(row => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        sectionTitle: row.sectionTitle,
        similarity: 0.35,
        metadata: (row.metadata || {}) as Record<string, unknown>,
        document: {
          id: row.document.id,
          title: row.document.title,
          fileName: row.document.fileName,
          documentType: row.document.documentType,
          ownerId: row.document.ownerId,
        },
      }))
    }

    return []
  } catch (error) {
    console.warn('Keyword search failed:', error)
    return []
  }
=======
  const { query, userId, subjectId, projectId, notebookId, documentIds, limit = 10 } = options

  if ((process.env.DATABASE_URL || '').startsWith('file:')) {
    const rows = await prisma.documentChunk.findMany({ where: { document: { ownerId: userId, ...(subjectId ? { subjectId } : {}), ...(projectId ? { projectId } : {}), ...(notebookId ? { notebookId } : {}), ...(documentIds?.length ? { id: { in: documentIds } } : {}) } }, include: { document: true }, take: 500 })
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.map(row => ({ row, score: terms.filter(term => row.content.toLowerCase().includes(term)).length / Math.max(terms.length, 1) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ row, score }) => ({ id: row.id, documentId: row.documentId, content: row.content, chunkIndex: row.chunkIndex, pageNumber: row.pageNumber, sectionTitle: row.sectionTitle, similarity: score, metadata: (row.metadata || {}) as Record<string, unknown>, document: { id: row.document.id, title: row.document.title, fileName: row.document.fileName, documentType: row.document.documentType, ownerId: row.document.ownerId } }))
  }
  const chunks = await prisma.$queryRaw<RawSearchResult[]>`
    SELECT 
      dc.id,
      dc."documentId",
      dc.content,
      dc."chunkIndex",
      dc."pageNumber",
      dc."sectionTitle",
      ts_rank_cd(to_tsvector('english', dc.content), websearch_to_tsquery('english', ${query})) as similarity,
      dc.metadata,
      d.id as "document_id",
      d.title as "document_title",
      d."fileName" as "document_fileName",
      d."documentType" as "document_documentType",
      d."ownerId" as "document_ownerId"
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    WHERE to_tsvector('english', dc.content) @@ websearch_to_tsquery('english', ${query})
    AND (
      d."ownerId" = ${userId}
      OR EXISTS (
        SELECT 1 FROM "SubjectEnrollment" se 
        WHERE se."subjectId" = d."subjectId" 
        AND se."userId" = ${userId} 
        AND se."isActive" = true
      )
      OR EXISTS (
        SELECT 1 FROM "ProjectMember" pm 
        WHERE pm."projectId" = d."projectId" 
        AND pm."userId" = ${userId}
      )
      OR EXISTS (
        SELECT 1 FROM "ResearchNotebook" rn 
        WHERE rn.id = d."notebookId" 
        AND rn."ownerId" = ${userId}
      )
    )
    ${subjectId ? Prisma.sql`AND d."subjectId" = ${subjectId}` : Prisma.empty}
    ${projectId ? Prisma.sql`AND d."projectId" = ${projectId}` : Prisma.empty}
    ${notebookId ? Prisma.sql`AND d."notebookId" = ${notebookId}` : Prisma.empty}
    ${documentIds && documentIds.length > 0 ? Prisma.sql`AND d.id IN (${Prisma.join(documentIds)})` : Prisma.empty}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `

  return chunks.map(chunk => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    sectionTitle: chunk.sectionTitle,
    similarity: Number(chunk.similarity),
    metadata: chunk.metadata,
    document: {
      id: chunk.document_id,
      title: chunk.document_title,
      fileName: chunk.document_fileName,
      documentType: chunk.document_documentType,
      ownerId: chunk.document_ownerId,
    },
  }))
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}

export async function hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(options),
    keywordSearch(options),
  ])

  const combined = new Map<string, SearchResult>()
<<<<<<< HEAD

  for (const result of vectorResults) {
    combined.set(result.id, { ...result, similarity: result.similarity * 0.7 })
  }

  for (const result of keywordResults) {
    const existing = combined.get(result.id)
    if (existing) {
      existing.similarity = Math.min(1, existing.similarity + result.similarity * 0.3)
=======
  
  for (const result of vectorResults) {
    combined.set(result.id, { ...result, similarity: result.similarity * 0.7 })
  }
  
  for (const result of keywordResults) {
    const existing = combined.get(result.id)
    if (existing) {
      existing.similarity = Math.max(existing.similarity, result.similarity * 0.3)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    } else {
      combined.set(result.id, { ...result, similarity: result.similarity * 0.3 })
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 10)
}
<<<<<<< HEAD
=======

export async function rerankResults(
  query: string,
  results: SearchResult[],
  userId: string
): Promise<SearchResult[]> {
  return results
}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
