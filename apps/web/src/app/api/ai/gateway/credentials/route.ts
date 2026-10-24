/**
 * Universal AI Gateway - Credential Management
 * 
 * Single primary configuration interface for the Universal AI API Key.
 * Supports both Mode A (universal gateway key) and Mode B (direct provider credentials).
 */

import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  saveGatewayCredential,
  getUserCredentials,
  deleteGatewayCredential,
  GatewayConfigError,
  GatewayAuthError,
} from '@/lib/ai/gateway'

export async function GET() {
  try {
    const user = await requireAuth()
    const credentials = await getUserCredentials(user.id)
    return NextResponse.json(credentials)
  } catch (error) {
    console.error('[Gateway Credentials] Fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const {
      provider,
      providerName,
      apiKey,
      models,
      isDefault,
      usageLimit,
      gatewayType,
      baseUrl,
    } = body

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required', success: false },
        { status: 400 }
      )
    }

    const saved = await saveGatewayCredential({
      userId: user.id,
      provider,
      providerName,
      apiKey,
      models,
      isDefault,
      usageLimit,
      gatewayType,
      baseUrl,
    })

    return NextResponse.json(saved)
  } catch (error) {
    console.error('[Gateway Credentials] Create error:', error)
    if (error instanceof GatewayConfigError) {
      return NextResponse.json(
        { error: error.message, code: error.code, provider: error.provider },
        { status: error.statusCode }
      )
    }
    if (error instanceof GatewayAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code, provider: error.provider },
        { status: error.statusCode }
      )
    }
    return NextResponse.json({ error: 'Failed to create credential' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { credentialId, isActive, isDefault, models, usageLimit, providerName, apiKey } = body

    if (!credentialId) {
      return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 })
    }

    // If updating the API key, re-encrypt and save
    if (apiKey) {
      // Find existing credential to preserve provider info
      const { prisma } = require('@/lib/prisma')
      const existing = await prisma.aICredential.findUnique({ where: { id: credentialId } })
      if (!existing || existing.userId !== user.id) {
        return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
      }

      // Delete old and create new with updated key
      await prisma.aICredential.delete({ where: { id: credentialId } })

      const saved = await saveGatewayCredential({
        userId: user.id,
        provider: existing.provider,
        providerName: providerName || existing.providerName,
        apiKey,
        models,
        isDefault: isDefault ?? existing.isDefault,
        usageLimit: usageLimit ?? existing.usageLimit,
        gatewayType: existing.gatewayType,
        baseUrl: existing.baseUrl,
      })
      return NextResponse.json(saved)
    }

    // Simple field updates
    const { prisma } = require('@/lib/prisma')
    const credential = await prisma.aICredential.findUnique({ where: { id: credentialId } })
    if (!credential || credential.userId !== user.id) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    if (isDefault === true) {
      await prisma.aICredential.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.aICredential.update({
      where: { id: credentialId },
      data: {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
        ...(providerName !== undefined ? { providerName: String(providerName).trim() } : {}),
        ...(usageLimit !== undefined ? { usageLimit: usageLimit ? Number(usageLimit) : null } : {}),
      },
    })

    return NextResponse.json({
      id: updated.id,
      provider: updated.provider,
      providerName: updated.providerName,
      isActive: updated.isActive,
      isDefault: updated.isDefault,
      models: Array.isArray(updated.models) ? updated.models : [],
      usageLimit: updated.usageLimit,
      usageCount: updated.usageCount,
      lastUsedAt: updated.lastUsedAt,
      createdAt: updated.createdAt,
      maskedKey: '••••••••',
      gatewayType: updated.gatewayType,
      baseUrl: updated.baseUrl,
    })
  } catch (error) {
    console.error('[Gateway Credentials] Update error:', error)
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const credentialId = searchParams.get('id')

    if (!credentialId) {
      return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 })
    }

    await deleteGatewayCredential(user.id, credentialId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Gateway Credentials] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 })
  }
}