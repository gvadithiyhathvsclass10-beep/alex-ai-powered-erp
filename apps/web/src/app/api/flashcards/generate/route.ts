import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { sourceDocId, count = 20, title } = await request.json()
    if (!sourceDocId) return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    const document = await prisma.document.findFirst({ where: { id: sourceDocId, ownerId: user.id }, include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } } })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const lines = document.chunks.flatMap(chunk => chunk.content.split(/\n+/)).map(line => line.trim()).filter(line => line.length > 30).slice(0, Math.min(Number(count) || 20, 100))
    if (!lines.length) return NextResponse.json({ error: 'The document has no processed text yet' }, { status: 422 })
    const deck = await prisma.flashcardDeck.create({ data: { userId: user.id, title: title || `${document.title} — flashcards`, sourceDocId: document.id, subjectId: document.subjectId, cards: { create: lines.map(line => ({ front: `What is the key idea in this statement?`, back: line })) } }, include: { _count: { select: { cards: true } } } })
    return NextResponse.json({ deckId: deck.id, deck })
  } catch (error) {
    console.error('Flashcard generation error:', error)
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 })
  }
}
