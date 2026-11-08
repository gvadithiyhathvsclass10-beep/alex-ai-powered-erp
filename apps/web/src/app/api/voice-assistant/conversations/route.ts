import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    const conversations = await prisma.conversation.findMany({
      where: { 
        userId: user.id,
        // Filter for voice assistant conversations
        title: { startsWith: "Voice Assistant" }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } }
      }
    })

    return NextResponse.json({ 
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c._count.messages
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Voice Assistant] Conversations list error:', error)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { title } = body

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || 'Voice Assistant Chat',
      }
    })

    return NextResponse.json({ 
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: 0
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Voice Assistant] Conversation create error:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}