import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  discoverModels,
  getCachedModels,
  refreshModels,
  type ModelDiscoveryResult,
} from '@/lib/ai/model-discovery'
import { formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const provider = searchParams.get('provider')
    const credentialId = searchParams.get('credentialId') || undefined
    const forceRefresh = searchParams.get('refresh') === 'true'
    const taskType = searchParams.get('taskType') || undefined

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = [
      'OPENAI',
      'GOOGLE_GEMINI',
      'ANTHROPIC',
      'NVIDIA_NEMOTRON',
      'GROQ',
      'MISTRAL',
      'OPENROUTER',
      'TOGETHER_AI',
      'OTHER',
      'UNIVERSAL_GATEWAY',
    ]

    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      )
    }

    let result: ModelDiscoveryResult

    if (forceRefresh) {
      result = await refreshModels({
        userId: user.id,
        provider: provider as any,
        credentialId,
        taskType: taskType as any,
      })
    } else {
      const cached = await getCachedModels(user.id, provider as any, credentialId)
      if (cached) {
        return NextResponse.json({
          models: cached,
          provider,
          cached: true,
        })
      }

      result = await discoverModels({
        userId: user.id,
        provider: provider as any,
        credentialId,
        taskType: taskType as any,
      })
    }

    return NextResponse.json({
      models: result.models,
      provider: result.provider,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
      error: result.error,
    })
  } catch (error) {
    console.error('[Model Discovery] Fetch error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to discover models')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const { provider, credentialId, taskType, forceRefresh } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    const validProviders = [
      'OPENAI',
      'GOOGLE_GEMINI',
      'ANTHROPIC',
      'NVIDIA_NEMOTRON',
      'GROQ',
      'MISTRAL',
      'OPENROUTER',
      'TOGETHER_AI',
      'OTHER',
      'UNIVERSAL_GATEWAY',
    ]

    if (!['OPENAI', 'GOOGLE_GEMINI', 'ANTHROPIC', 'NVIDIA_NEMOTRON', 'GROQ', 'MISTRAL', 'OPENROUTER', 'TOGETHER_AI', 'OTHER', 'UNIVERSAL_GATEWAY'].includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      )
    }

    const result = await refreshModels({
      userId: user.id,
      provider: provider as any,
      credentialId,
      taskType: taskType as any,
    })

    return NextResponse.json({
      models: result.models,
      provider: result.provider,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
      error: result.error,
    })
  } catch (error) {
    console.error('[Model Discovery] Refresh error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to refresh models')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}