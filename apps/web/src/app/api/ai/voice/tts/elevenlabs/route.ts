import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { text, voice, modelId, voiceSettings } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text exceeds maximum length of 5000 characters' }, { status: 400 })
    }

    const voiceCreds = await prisma.aICredential.findFirst({
      where: {
        userId: user.id,
        provider: 'OTHER',
        providerName: 'elevenlabs',
        isActive: true,
      },
    })

    if (!voiceCreds) {
      return NextResponse.json({ error: 'ElevenLabs credentials not configured' }, { status: 400 })
    }

    let apiKey: string
    try {
      apiKey = await decrypt(voiceCreds.encryptedKey)
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
    }

    const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'
    const model = modelId || 'eleven_monolingual_v1'

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: model,
        voice_settings: voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status} ${response.statusText}`, details: errorText },
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
    console.error('[ElevenLabs TTS] Error:', error)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}