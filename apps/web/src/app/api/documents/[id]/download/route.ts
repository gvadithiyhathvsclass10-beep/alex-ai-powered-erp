import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canAccessDocument } from '@/lib/document-processing/access'
import { getSignedUrl } from '@/lib/storage/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
        storageBucket: true,
        ownerId: true,
      },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, doc as any)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const signedUrl = await getSignedUrl(doc.storageBucket, doc.storagePath, 60 * 5) // 5 minutes

    // For local storage, getSignedUrl returns a relative path like /api/documents/local/...
    // We need to construct an absolute URL for NextResponse.redirect
    const url = new URL(signedUrl, request.url)
    
    // Return redirect to signed URL
    return NextResponse.redirect(url.toString())
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Documents] Download error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}