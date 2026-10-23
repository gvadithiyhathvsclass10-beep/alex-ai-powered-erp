import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import { validateProviderModel, formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function PATCH(
=======

export async function DELETE(
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
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
=======

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const { id } = await params

    const credential = await prisma.aICredential.findUnique({
      where: { id },
    })

    if (!credential || credential.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.aICredential.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
<<<<<<< HEAD
    console.error('[AI Credentials] Delete error:', error)
=======
    console.error('AI credential delete error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 })
  }
}