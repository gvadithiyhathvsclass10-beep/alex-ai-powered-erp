import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { sourceDocId, type = 'concise' } = await request.json()
    if (!sourceDocId) return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })

    const document = await prisma.document.findFirst({
      where: { id: sourceDocId, ownerId: user.id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const source = document.chunks.map(chunk => chunk.content.trim()).filter(Boolean).join('\n\n')
    const content = type === 'concise'
      ? source.split(/\n+/).filter(Boolean).slice(0, 30).map(line => `• ${line.slice(0, 240)}`).join('\n')
      : source.slice(0, 24000)
    const material = await prisma.studyMaterial.create({
      data: { userId: user.id, title: `${document.title} — ${type} notes`, content, type, sourceDocId: document.id, subjectId: document.subjectId, tags: [] },
    })
    return NextResponse.json({ material })
  } catch (error) {
    console.error('Study material generation error:', error)
    return NextResponse.json({ error: 'Failed to generate study material' }, { status: 500 })
  }
}
