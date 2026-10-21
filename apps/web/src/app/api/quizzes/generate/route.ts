import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const { sourceDocId, title, count = 10 } = await request.json()
    const doc = await prisma.document.findFirst({ where: { id: sourceDocId, ownerId: user.id }, include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 30 } } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const lines = doc.chunks.flatMap(c => c.content.split(/\n+/)).map(s => s.trim()).filter(s => s.length > 30).slice(0, Math.min(Number(count) || 10, 50))
    const questions = lines.map((line, index) => ({ id: `q-${index}`, prompt: `Which statement is supported by the source material?`, options: [line.slice(0, 240), 'None of the above', 'The source does not address this', 'All statements are unrelated'], answer: 0 }))
    const quiz = await prisma.quiz.create({ data: { userId: user.id, title: title || `${doc.title} — quiz`, sourceDocId: doc.id, subjectId: doc.subjectId, difficulty: 'medium', questions } })
    return NextResponse.json({ quiz })
  } catch (error) { console.error('Quiz generation error:', error); return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 }) }
}
