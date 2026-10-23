import { requireAuth } from '@/lib/auth'
<<<<<<< HEAD
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()

    const { id } = await params
    const [resources, subjectDocs] = await Promise.all([
      prisma.subjectResource.findMany({
        where: { subjectId: id, isPublished: true },
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.document?.findMany
        ? prisma.document.findMany({
            where: { subjectId: id },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { chunks: true } } },
          })
        : Promise.resolve([]),
    ])

    const resourcePaths = new Set(resources.map(r => r.storagePath).filter(Boolean))
    const mergedDocs = (subjectDocs || [])
      .filter(d => !resourcePaths.has(d.storagePath))
      .map(d => ({
        id: d.id,
        subjectId: id,
        title: d.title,
        description: d.description,
        category: 'DOCUMENT',
        fileName: d.fileName,
        storagePath: d.storagePath,
        fileSize: d.fileSize.toString(),
        mimeType: d.mimeType,
        documentType: d.documentType,
        status: d.status,
        pageCount: d.pageCount,
        chunksCount: d._count?.chunks ?? 0,
        version: 1,
        isPublished: true,
        uploadedBy: d.ownerId,
        createdAt: d.createdAt,
      }))

    const serialized = [
      ...resources.map(r => ({
        ...r,
        fileSize: r.fileSize.toString(),
      })),
      ...mergedDocs,
    ]

    return NextResponse.json({ resources: serializeBigInt(serialized) })
  } catch (error) {
    console.error('[Subjects] Subject resources list error:', error)
=======
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const resources = await prisma.subjectResource.findMany({
      where: { subjectId: id, isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ resources })
  } catch (error) {
    console.error('Subject resources list error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to list resources' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params
    const body = await request.json()
<<<<<<< HEAD
    const { title, description, category, fileName, storagePath, fileSize, mimeType, isPublished = true } = body
=======
    const { title, description, category, fileName, storagePath, fileSize, mimeType } = body
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    const resource = await prisma.subjectResource.create({
      data: {
        subjectId: id,
        title,
<<<<<<< HEAD
        description: description || null,
        category: category || 'LECTURE_NOTES',
        fileName: fileName || title,
        storagePath: storagePath || '',
        fileSize: BigInt(fileSize || 0),
        mimeType: mimeType || 'application/pdf',
        isPublished: Boolean(isPublished),
        publishedAt: isPublished ? new Date() : null,
=======
        description,
        category,
        fileName,
        storagePath,
        fileSize,
        mimeType,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        uploadedBy: user.id,
      },
    })

<<<<<<< HEAD
    return NextResponse.json({
      resource: serializeBigInt({
        ...resource,
        fileSize: resource.fileSize.toString(),
      }),
    })
  } catch (error) {
    console.error('[Subjects] Subject resource create error:', error)
=======
    return NextResponse.json({ resource })
  } catch (error) {
    console.error('Subject resource create error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}