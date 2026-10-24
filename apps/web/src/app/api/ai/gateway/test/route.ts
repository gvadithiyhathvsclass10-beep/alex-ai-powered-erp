/**
 * Universal AI Gateway - Connection Test
 * 
 * Tests the configured API key against the actual endpoint.
 * Real connectivity test - not a mock.
 */

import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { testGatewayConnection, GatewayConfigError, GatewayAuthError, GatewayModelNotSupportedError } from '@/lib/ai/gateway'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { provider, apiKey, credentialId, model, baseUrl, gatewayKey, gatewayType } = body

    const result = await testGatewayConnection({
      userId: user.id,
      provider,
      apiKey,
      credentialId,
      model,
      baseUrl,
      gatewayKey,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Gateway Test] Error:', error)

    if (error instanceof GatewayConfigError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, provider: error.provider },
        { status: error.statusCode }
      )
    }
    if (error instanceof GatewayAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, provider: error.provider },
        { status: error.statusCode }
      )
    }
    if (error instanceof GatewayModelNotSupportedError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code, provider: error.provider, model: error.model },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 500 }
    )
  }
}