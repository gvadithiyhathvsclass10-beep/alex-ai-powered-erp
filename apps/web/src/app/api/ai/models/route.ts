import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import {
  normalizeProvider,
  validateProviderModel,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
  type AITaskType,
} from '@/lib/ai/service'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function GET() {
  try {
    const user = await requireAuth()

    const configs = await prisma.aIModelConfig.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
<<<<<<< HEAD
    console.error('[AI Models] Fetch error:', error)
=======
    console.error('AI model configs fetch error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to fetch model configs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
<<<<<<< HEAD
    const { provider: rawProvider, modelId: rawModelId, taskType = 'chat', isDefault = true, parameters } = body

    if (!rawProvider || !rawModelId || !taskType) {
      return NextResponse.json({ error: 'Provider, modelId, and taskType are required' }, { status: 400 })
    }

    const provider = normalizeProvider(rawProvider)
    const validTaskType = (['chat', 'embeddings', 'reasoning', 'vision', 'structured'].includes(taskType)
      ? taskType
      : 'chat') as AITaskType

    const meta = SUPPORTED_AI_PROVIDERS[provider]
    const modelId = validateProviderModel(
      provider,
      String(rawModelId).trim(),
      validTaskType,
      meta ? [...meta.models, ...meta.embeddingModels] : []
    )

=======
    const { provider, modelId, taskType, isDefault, parameters } = body

    if (!provider || !modelId || !taskType) {
      return NextResponse.json({ error: 'Provider, modelId, and taskType are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults for this task type
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { userId: user.id, taskType, isDefault: true },
        data: { isDefault: false },
      })
    }

    const config = await prisma.aIModelConfig.upsert({
      where: {
        userId_provider_modelId_taskType: {
          userId: user.id,
<<<<<<< HEAD
          provider,
=======
          provider: provider as any,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          modelId,
          taskType,
        },
      },
      update: {
<<<<<<< HEAD
        isDefault: Boolean(isDefault),
=======
        isDefault: isDefault || false,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        parameters: parameters || {},
      },
      create: {
        userId: user.id,
<<<<<<< HEAD
        provider,
        modelId,
        taskType,
        isDefault: Boolean(isDefault),
=======
        provider: provider as any,
        modelId,
        taskType,
        isDefault: isDefault || false,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        parameters: parameters || {},
      },
    })

    return NextResponse.json(config)
  } catch (error) {
<<<<<<< HEAD
    console.error('[AI Models] Create/update error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to update model configuration')
    return NextResponse.json(formatted.body, { status: formatted.status })
=======
    console.error('AI model config create error:', error)
    return NextResponse.json({ error: 'Failed to create model config' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}
