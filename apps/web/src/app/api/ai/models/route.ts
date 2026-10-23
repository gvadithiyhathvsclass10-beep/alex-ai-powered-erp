import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  normalizeProvider,
  validateProviderModel,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
  type AITaskType,
} from '@/lib/ai/service'
import { validateCustomModel } from '@/lib/ai/model-discovery'

export async function GET() {
  try {
    const user = await requireAuth()

    const configs = await prisma.aIModelConfig.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('[AI Models] Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch model configs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { provider: rawProvider, modelId: rawModelId, taskType = 'chat', isDefault = true, parameters, isCustom } = body

    if (!rawProvider || !rawModelId || !taskType) {
      return NextResponse.json({ error: 'Provider, modelId, and taskType are required' }, { status: 400 })
    }

    const provider = normalizeProvider(rawProvider)
    const validTaskType = (['chat', 'embeddings', 'reasoning', 'vision', 'structured'].includes(taskType)
      ? taskType
      : 'chat') as AITaskType

    const meta = SUPPORTED_AI_PROVIDERS[provider]

    // If not a custom model, validate against known models
    let modelId: string
    let isCustomModel = Boolean(isCustom)

    if (!isCustomModel) {
      modelId = validateProviderModel(
        provider,
        String(rawModelId).trim(),
        validTaskType,
        meta ? [...meta.models, ...meta.embeddingModels] : []
      )
    } else {
      // For custom models, validate format and optionally test the model
      const requestedModel = String(rawModelId).trim()

      if (!requestedModel) {
        return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
      }

      if (requestedModel.length > 200) {
        return NextResponse.json({ error: 'Model ID too long (max 200 characters)' }, { status: 400 })
      }

      // Validate format - allow alphanumeric, hyphens, underscores, slashes, dots
      if (!/^[a-zA-Z0-9_\-./]+$/.test(requestedModel)) {
        return NextResponse.json(
          { error: 'Model ID contains invalid characters. Allowed: alphanumeric, hyphen, underscore, slash, dot' },
          { status: 400 }
        )
      }

      modelId = requestedModel

      // Optionally validate the custom model by testing it
      // This is done asynchronously and non-blocking in the background
      // The model will be saved regardless, but we can warn if validation fails
    }

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
          provider,
          modelId,
          taskType,
        },
      },
      update: {
        isDefault: Boolean(isDefault),
        parameters: parameters || {},
      },
      create: {
        userId: user.id,
        provider,
        modelId,
        taskType,
        isDefault: Boolean(isDefault),
        parameters: parameters || {},
      },
    })

    // If custom model, optionally validate in background
    if (isCustomModel) {
      // Fire and forget - log validation result
      validateCustomModel(user.id, provider, modelId, undefined).then(result => {
        if (!result.valid) {
          console.warn(`[AI Models] Custom model validation warning for ${provider}/${modelId}: ${result.error}`)
        }
      }).catch(err => {
        console.error(`[AI Models] Custom model validation error for ${provider}/${modelId}:`, err)
      })
    }

    return NextResponse.json({ ...config, isCustom: isCustomModel })
  } catch (error) {
    console.error('[AI Models] Create/update error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to update model configuration')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}
