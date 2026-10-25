import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { validateProviderModel, formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()

    const credential = await prisma.aICredential.findUnique({ where: { id } })
    if (!credential || credential.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { isActive, isDefault, models, usageLimit, providerName } = body

    if (isDefault === true) {
      await prisma.aICredential.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    let validatedModels: string[] | undefined
    if (Array.isArray(models)) {
      validatedModels = models
        .filter(Boolean)
        .map((m: string) => validateProviderModel(credential.provider, String(m).trim(), 'chat'))
    }

    const updated = await prisma.aICredential.update({
      where: { id },
      data: {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
        ...(validatedModels !== undefined ? { models: validatedModels } : {}),
        ...(usageLimit !== undefined ? { usageLimit: usageLimit ? Number(usageLimit) : null } : {}),
        ...(providerName !== undefined ? { providerName: String(providerName).trim() } : {}),
      },
    })

    return NextResponse.json({
      id: updated.id,
      provider: updated.provider,
      providerName: updated.providerName,
      isActive: updated.isActive,
      isDefault: updated.isDefault,
      models: updated.models,
      usageLimit: updated.usageLimit,
      usageCount: updated.usageCount,
      lastUsedAt: updated.lastUsedAt,
      createdAt: updated.createdAt,
    })
  } catch (error) {
    console.error('[AI Credentials] Update error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to update credential')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const credential = await prisma.aICredential.findUnique({
      where: { id },
    })

    if (!credential || credential.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const wasDefault = credential.isDefault

    // Delete the credential
    await prisma.aICredential.delete({
      where: { id },
    })

    // If the deleted credential was the default, clean up associated model configs
    // and optionally promote another credential to default
    if (wasDefault) {
      // Remove model configs that were tied to this provider for this user
      await prisma.aIModelConfig.deleteMany({
        where: {
          userId: user.id,
          provider: credential.provider,
        },
      })

      // Find another active credential to promote as default
      const nextCredential = await prisma.aICredential.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { updatedAt: 'desc' },
      })

      if (nextCredential) {
        await prisma.aICredential.update({
          where: { id: nextCredential.id },
          data: { isDefault: true },
        })

        // Create default model configs for the new default credential
        const { SUPPORTED_AI_PROVIDERS } = await import('@/lib/ai/service')
        const meta = SUPPORTED_AI_PROVIDERS[nextCredential.provider as any]
        if (meta) {
          // Chat model config
          await prisma.aIModelConfig.upsert({
            where: {
              userId_provider_modelId_taskType: {
                userId: user.id,
                provider: nextCredential.provider,
                modelId: meta.defaultChatModel,
                taskType: 'chat',
              },
            },
            update: { isDefault: true },
            create: {
              userId: user.id,
              provider: nextCredential.provider,
              modelId: meta.defaultChatModel,
              taskType: 'chat',
              isDefault: true,
            },
          })

          // Embeddings model config if provider supports it
          if (meta.defaultEmbeddingModel) {
            await prisma.aIModelConfig.upsert({
              where: {
                userId_provider_modelId_taskType: {
                  userId: user.id,
                  provider: nextCredential.provider,
                  modelId: meta.defaultEmbeddingModel,
                  taskType: 'embeddings',
                },
              },
              update: { isDefault: true },
              create: {
                userId: user.id,
                provider: nextCredential.provider,
                modelId: meta.defaultEmbeddingModel,
                taskType: 'embeddings',
                isDefault: true,
              },
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AI Credentials] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 })
  }
}