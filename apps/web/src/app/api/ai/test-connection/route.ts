import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  testProviderConnection,
  formatAIServiceErrorResponse,
  SUPPORTED_AI_PROVIDERS,
} from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { provider, apiKey, credentialId, model, query, baseUrl, useSavedConfig } = body

    // If using saved config, we don't need explicit provider/apiKey
    if (!useSavedConfig && !credentialId && (!provider || !apiKey)) {
      return NextResponse.json(
        { error: 'Either credentialId or both provider and apiKey are required', success: false },
        { status: 400 }
      )
    }

    // Validate provider if provided
    if (provider && !SUPPORTED_AI_PROVIDERS[provider as any]) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}. Supported: ${Object.keys(SUPPORTED_AI_PROVIDERS).join(', ')}`, success: false },
        { status: 400 }
      )
    }

    const result = await testProviderConnection({
      userId: user.id,
      provider,
      apiKey,
      credentialId,
      model,
      query,
      baseUrl,
    })

    return NextResponse.json({ ...result, success: true })
  } catch (error) {
    console.error('[AI Test Connection] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Connection test failed')
    return NextResponse.json({ ...formatted.body, success: false }, { status: formatted.status })
  }
}
