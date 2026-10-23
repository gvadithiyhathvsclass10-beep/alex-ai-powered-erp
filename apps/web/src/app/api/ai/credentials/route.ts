import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import {
  saveUserAICredential,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
} from '@/lib/ai/service'
=======
import { encrypt } from '@/lib/encryption'
import { generateKeyHash } from '@/lib/encryption'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function GET() {
  try {
    const user = await requireAuth()

    const credentials = await prisma.aICredential.findMany({
      where: { userId: user.id, isActive: true },
<<<<<<< HEAD
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // Never expose encryptedKey or plaintext API keys to the client
    const safeCredentials = credentials.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: c.providerName || SUPPORTED_AI_PROVIDERS[c.provider]?.name || c.provider,
      isActive: c.isActive,
      isDefault: c.isDefault,
      models: Array.isArray(c.models) ? c.models : [],
=======
      orderBy: { createdAt: 'desc' },
    })

    // Don't return the actual encrypted keys
    const safeCredentials = credentials.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: c.providerName,
      isActive: c.isActive,
      isDefault: c.isDefault,
      models: c.models || [],
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      usageLimit: c.usageLimit,
      usageCount: c.usageCount,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    }))

    return NextResponse.json(safeCredentials)
  } catch (error) {
<<<<<<< HEAD
    console.error('[AI Credentials] Fetch error:', error)
=======
    console.error('AI credentials fetch error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const body = await request.json()
    const { provider, providerName, apiKey, models, isDefault, usageLimit } = body

    const saved = await saveUserAICredential({
      userId: user.id,
      provider,
      providerName,
      apiKey,
      models,
      isDefault,
      usageLimit,
    })

    return NextResponse.json(saved)
  } catch (error) {
    console.error('[AI Credentials] Create error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to create credential')
    return NextResponse.json(formatted.body, { status: formatted.status })
=======

    const body = await request.json()
    const { provider, providerName, apiKey, models, isDefault, usageLimit } = body

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults for this provider
    if (isDefault) {
      await prisma.aICredential.updateMany({
        where: { userId: user.id, provider: provider as any, isDefault: true },
        data: { isDefault: false },
      })
    }

    const encryptedKey = await encrypt(apiKey)
    const keyHash = generateKeyHash(apiKey)

    const credential = await prisma.aICredential.create({
      data: {
        userId: user.id,
        provider: provider as any,
        providerName: providerName || provider,
        encryptedKey,
        keyHash,
        models: models || [],
        isDefault: isDefault || false,
        usageLimit,
        isActive: true,
      },
    })

    return NextResponse.json({
      id: credential.id,
      provider: credential.provider,
      providerName: credential.providerName,
      isActive: credential.isActive,
      isDefault: credential.isDefault,
      models: credential.models,
      usageLimit: credential.usageLimit,
      usageCount: credential.usageCount,
      createdAt: credential.createdAt,
    })
  } catch (error) {
    console.error('AI credential create error:', error)
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}
