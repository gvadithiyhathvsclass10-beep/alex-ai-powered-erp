import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { sourceDocId, title } = await request.json()
    const doc = await prisma.document.findFirst({ where: { id: sourceDocId, ownerId: user.id }, include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 20 } } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const lines = doc.chunks.flatMap(c => c.content.split(/\n+/)).map(s => s.trim()).filter(s => s.length > 20).slice(0, 12)
    const nodes = lines.map((label, index) => ({ id: `node-${index}`, label: label.slice(0, 160), position: { x: (index % 3) * 260, y: Math.floor(index / 3) * 140 } }))
    const edges = nodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: nodes[index].id, target: node.id }))
    const map = await prisma.mindMap.create({ data: { userId: user.id, title: title || `${doc.title} — mind map`, sourceDocId: doc.id, subjectId: doc.subjectId, nodes, edges } })
    return NextResponse.json({ mindMap: map })
  } catch (error) { console.error('Mind map generation error:', error); return NextResponse.json({ error: 'Failed to generate mind map' }, { status: 500 }) }
}
