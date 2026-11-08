import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getUserChatProvider } from '@/lib/rag/generation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id }
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: params.id,
        senderId: user.id,
        role: 'user',
        content: text.trim()
      }
    })

    // Get AI response
    const chatProvider = await getUserChatProvider(user.id)

    // Get conversation history for context
    const history = await prisma.message.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: 'asc' },
      take: 20
    })

    const historyMessages = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    // Add current user message
    historyMessages.push({ role: 'user', content: text.trim() })

    // Build system prompt for academic assistant
    const systemPrompt = `You are ALEX, a personal AI academic mentor for a student.
Your role is to help with academic questions, explanations, study planning, and exam preparation.

Guidelines:
- Be clear, accurate, and concise
- Use academic tone appropriate for students
- Break down complex concepts step by step
- Provide examples when helpful
- Reference the student's academic context when relevant
- If you don't know something, say so honestly
- Encourage critical thinking and independent learning

Current conversation context: The student is using voice input for a natural conversation.`

    // Get AI response
    const response = await chatProvider.generate({
      query: text.trim(),
      context: [],
      systemPrompt,
      history: historyMessages
    })

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: params.id,
        senderId: user.id,
        role: 'assistant',
        content: response.answer
      }
    })

    return NextResponse.json({ 
      response: response.answer,
      provider: response.provider,
      model: response.model
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Voice Assistant] Message send error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}