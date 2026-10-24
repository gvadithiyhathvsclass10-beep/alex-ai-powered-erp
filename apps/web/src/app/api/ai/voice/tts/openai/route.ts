import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { text, voice, modelId, speed } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 4096) {
      return NextResponse.json({ error: 'Text exceeds maximum length of 4096 characters' }, { status: 400 })
    }

    const voiceCreds = await prisma.aICredential.findFirst({
      where: {
        userId: user.id,
        provider: 'OTHER',
        providerName: 'openai-tts',
        isActive: true,
      },
    })

    if (!voiceCreds) {
      return NextResponse.json({ error: 'OpenAI TTS credentials not configured' }, { status: 400 })
    }

    let apiKey: string
    try {
      apiKey = await decrypt(voiceCreds.encryptedKey)
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
    }

    const ttsVoice = voice || 'alloy'
    const model = modelId || 'tts-1'
    const speedValue = typeof speed === 'number' ? Math.max(0.25, Math.min(4.0, speed)) : 1.0

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text.trim(),
        voice: ttsVoice,
        response_format: 'mp3',
        speed: speedValue,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return NextResponse.json(
        { error: `OpenAI TTS error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[OpenAI TTS] Error:', error)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}