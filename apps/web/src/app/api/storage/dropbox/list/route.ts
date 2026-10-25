import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getDropboxToken, dropboxRpc } from '@/lib/dropbox'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const path = url.searchParams.get('path') || ''
    const cursor = url.searchParams.get('cursor') || undefined

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

    const listParams: Record<string, unknown> = {
      path: path || '',
      recursive: false,
      include_media_info: false,
      include_deleted: false,
      include_has_explicit_shared_members: false,
      include_mounted_folders: true,
      include_non_downloadable_files: true,
    }

    if (cursor) {
      listParams.cursor = cursor
    }

    const result = await dropboxRpc<{
      entries: Array<{
        '.tag': 'file' | 'folder'
        name: string
        path_lower: string
        path_display: string
        id: string
        size?: number
        client_modified?: string
        server_modified?: string
        content_hash?: string
      }>
      cursor: string
      has_more: boolean
    }>(accessToken, 'files/list_folder', listParams)

    // Filter to supported file types for import
    const supportedExtensions = new Set([
      'pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx',
      'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'webp'
    ])

    const entries = result.entries.map(entry => ({
      id: entry.id,
      name: entry.name,
      path: entry.path_display,
      type: entry['.tag'],
      size: entry.size,
      modified: entry.server_modified || entry.client_modified,
      isImportable: entry['.tag'] === 'file' && supportedExtensions.has(entry.name.split('.').pop()?.toLowerCase() || ''),
    }))

    return NextResponse.json({
      entries,
      cursor: result.cursor,
      hasMore: result.has_more,
    })
  } catch (error) {
    console.error('[Dropbox List] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list Dropbox files' },
      { status: 500 }
    )
  }
}