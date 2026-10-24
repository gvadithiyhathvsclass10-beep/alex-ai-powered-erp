/**
 * Universal AI Gateway - Model Discovery
 * 
 * Discovers models from the configured gateway or provider.
 * Supports live discovery from provider APIs where available.
 */

import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { discoverGatewayModels, GatewayConfigError } from '@/lib/ai/gateway'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const provider = searchParams.get('provider')
    const credentialId = searchParams.get('credentialId') || undefined
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!provider) {
      return NextResponse.json({ error: 'Provider parameter is required' }, { status: 400 })
    }

    const result = await discoverGatewayModels({
      userId: user.id,
      provider,
      credentialId,
      forceRefresh,
    })

    return NextResponse.json({
      models: result.models,
      provider: result.provider,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
      error: result.error,
    })
  } catch (error) {
    console.error('[Gateway Models] Fetch error:', error)
    if (error instanceof GatewayConfigError) {
      return NextResponse.json(
        { error: error.message, code: error.code, provider: error.provider },
        { status: error.statusCode }
      )
    }
    return NextResponse.json({ error: 'Failed to discover models' }, { status: 500 })
  }
}