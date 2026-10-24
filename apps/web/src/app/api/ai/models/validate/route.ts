import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { validateCustomModel, type ValidationTaskType } from '@/lib/ai/model-discovery'
import { formatAIServiceErrorResponse } from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const { provider, modelId, credentialId, apiKey, baseUrl, taskType = 'chat' } = body

    if (!provider || !modelId) {
      return NextResponse.json(
        { error: 'Provider and modelId are required' },
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
    ]

    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      )
    }

    const validTaskTypes: ValidationTaskType[] = ['chat', 'embeddings', 'vision', 'reasoning', 'structured', 'function-calling']
    const validatedTaskType = validTaskTypes.includes(taskType) ? taskType : 'chat'

    const result = await validateCustomModel(
      user.id,
      provider as any,
      modelId,
      credentialId,
      apiKey,
      baseUrl,
      validatedTaskType
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Model Validation] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to validate model')
    return NextResponse.json(formatted.body, { status: formatted.status })
  }
}