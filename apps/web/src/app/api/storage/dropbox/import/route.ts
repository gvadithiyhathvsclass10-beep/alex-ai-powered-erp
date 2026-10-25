import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getDropboxToken, dropboxRpc, dropboxUpload } from '@/lib/dropbox'
import { createDocumentRecord, processDocument } from '@/lib/document-processing/pipeline'
import { validateUploadedFile } from '@/lib/document-processing/extractors'
import { DocumentStatus } from '@prisma/client'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { paths, subjectId, projectId, notebookId } = body

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: 'No files specified for import' }, { status: 400 })
    }

    if (paths.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 files per import' }, { status: 400 })
    }

    const connection = await prisma.dropboxConnection.findUnique({
      where: { userId: user.id },
      select: { encryptedAccessToken: true, encryptedRefreshToken: true, expiresAt: true },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Dropbox not connected' }, { status: 404 })
    }

    const { accessToken, refreshed, expiresAt, encryptedAccessToken } = await getDropboxToken(
      connection.encryptedAccessToken,
      connection.encryptedRefreshToken,
      connection.expiresAt
    )

    // If token was refreshed, update the database
    if (refreshed) {
      await prisma.dropboxConnection.update({
        where: { userId: user.id },
        data: {
          accessToken: encryptedAccessToken,
          expiresAt,
        },
      })
    }

    const results = await Promise.all(
      paths.map(async (dropboxPath: string) => {
        try {
          // Get file metadata first
          const metadata = await dropboxRpc<{
            name: string
            path_display: string
            size: number
            '.tag': 'file' | 'folder'
            content_hash: string
          }>(accessToken, 'files/get_metadata', { path: dropboxPath, include_media_info: false })

          if (metadata['.tag'] !== 'file') {
            return { path: dropboxPath, success: false, error: 'Not a file' }
          }

          if (metadata.size > MAX_FILE_SIZE) {
            return { path: dropboxPath, success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }
          }

          // Download file from Dropbox
          const downloadResponse = await fetch(`${process.env.DROPBOX_CONTENT_HOST || 'https://content.dropboxapi.com'}/2/files/download`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath }),
            },
          })

          if (!downloadResponse.ok) {
            throw new Error(`Download failed: ${downloadResponse.status}`)
          }

          const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer())

          // Validate file type
          const { documentType, normalizedMimeType } = validateUploadedFile(
            metadata.name,
            downloadResponse.headers.get('content-type') || 'application/octet-stream',
            fileBuffer
          )

          // Create document record
          const { document, storagePath } = await createDocumentRecord(user.id, new File([fileBuffer], metadata.name), subjectId, projectId, notebookId)

          // Process document
          await processDocument({
            documentId: document.id,
            userId: user.id,
            fileBuffer,
            fileName: metadata.name,
            mimeType: normalizedMimeType,
            documentType,
            subjectId,
            projectId,
            notebookId,
          })

          return {
            path: dropboxPath,
            success: true,
            document: {
              id: document.id,
              title: document.title,
              fileName: document.fileName,
              documentType: document.documentType,
              status: document.status,
            },
          }
        } catch (error) {
          console.error(`[Dropbox Import] Failed to import ${dropboxPath}:`, error)
          return {
            path: dropboxPath,
            success: false,
            error: error instanceof Error ? error.message : 'Import failed',
          }
        }
      })
    )

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    return NextResponse.json({
      imported: successful.length,
      failed: failed.length,
      results,
    })
  } catch (error) {
    console.error('[Dropbox Import] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}