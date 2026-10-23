import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { normalizeProvider, type AITaskType, SUPPORTED_AI_PROVIDERS } from './service'

export type AIProviderType = PrismaAIProviderType | 'MOCK'

export interface DiscoveredModel {
  id: string
  name: string
  object?: string
  ownedBy?: string
  created?: number
  capabilities?: string[]
  contextWindow?: number
  maxOutputTokens?: number
  pricing?: {
    input?: number
    output?: number
  }
  isDeprecated?: boolean
  isCustom?: boolean
  provider: AIProviderType
}

export interface ModelDiscoveryResult {
  models: DiscoveredModel[]
  provider: AIProviderType
  fetchedAt: Date
  cached: boolean
  error?: string
}

export interface ModelDiscoveryOptions {
  provider: AIProviderType
  userId: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  forceRefresh?: boolean
  taskType?: AITaskType
}

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_CONCURRENT_REFRESHES = 3

const refreshLocks = new Map<string, Promise<ModelDiscoveryResult>>()

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
}

async function resolveCredentialForDiscovery(
  options: ModelDiscoveryOptions
): Promise<{ apiKey: string; baseUrl: string; credential: AICredential | null }> {
  const provider = options.provider

  // Handle MOCK provider separately
  if (provider === 'MOCK') {
    return {
      apiKey: 'mock',
      baseUrl: '',
      credential: null,
    }
  }

  // 1. Explicit API key
  if (options.apiKey) {
    const meta = SUPPORTED_AI_PROVIDERS[provider]
    return {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || meta.defaultBaseUrl,
      credential: null,
    }
  }

  // 2. Explicit credential ID
  if (options.credentialId && options.userId) {
    const cred = await prisma.aICredential.findFirst({
      where: { id: options.credentialId, userId: options.userId, isActive: true },
    })
    if (!cred) throw new Error('Credential not found or inactive')

    let apiKey: string
    try {
      apiKey = await decrypt(cred.encryptedKey)
    } catch {
      throw new Error('Failed to decrypt credential')
    }

    const meta = SUPPORTED_AI_PROVIDERS[provider]
    return {
      apiKey,
      baseUrl: options.baseUrl || meta.defaultBaseUrl,
      credential: cred,
    }
  }

  // 3. User's default credential for provider
  if (options.userId) {
    const cred = await prisma.aICredential.findFirst({
      where: {
        userId: options.userId,
        provider: options.provider as PrismaAIProviderType,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    if (cred) {
      let apiKey: string
      try {
        apiKey = await decrypt(cred.encryptedKey)
      } catch {
        throw new Error('Failed to decrypt credential')
      }

      const meta = SUPPORTED_AI_PROVIDERS[provider]
      return {
        apiKey,
        baseUrl: options.baseUrl || meta.defaultBaseUrl,
        credential: cred,
      }
    }
  }

  // 4. Environment variable fallback
  const meta = SUPPORTED_AI_PROVIDERS[provider]
  const envVal = process.env[meta.envKey] || (provider === 'GOOGLE_GEMINI' ? process.env.GEMINI_API_KEY : undefined)
  if (envVal && envVal.trim().length >= 8) {
    return {
      apiKey: envVal.trim(),
      baseUrl: options.baseUrl || meta.defaultBaseUrl,
      credential: null,
    }
  }

  throw new Error(`No API key available for provider ${provider}`)
}

async function fetchModelsFromProvider(
  provider: AIProviderType,
  apiKey: string,
  baseUrl: string
): Promise<DiscoveredModel[]> {
  // Handle MOCK provider
  if (provider === 'MOCK') {
    return [
      {
        id: 'mock',
        name: 'Mock Model',
        object: 'model',
        ownedBy: 'local',
        capabilities: ['chat'],
        contextWindow: 4096,
        maxOutputTokens: 2048,
        provider: 'MOCK',
        isCustom: false,
      },
    ]
  }

  const meta = SUPPORTED_AI_PROVIDERS[provider as PrismaAIProviderType]
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  switch (provider) {
    case 'OPENAI': {
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`OpenAI model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        created: m.created,
        capabilities: ['chat'],
        contextWindow: getContextWindowForOpenAIModel(m.id),
        maxOutputTokens: getMaxOutputTokensForOpenAIModel(m.id),
        provider: 'OPENAI',
      }))
    }

    case 'GOOGLE_GEMINI': {
      const url = `${normalizedBaseUrl}/models?key=${encodeURIComponent(apiKey)}`
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Google Gemini model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.models || []).map((m: any) => ({
        id: m.name?.replace('models/', '') || m.id,
        name: m.displayName || m.name?.replace('models/', '') || m.id,
        object: 'model',
        ownedBy: 'google',
        capabilities: getCapabilitiesForGeminiModel(m.name || m.id),
        contextWindow: m.inputTokenLimit,
        maxOutputTokens: m.outputTokenLimit,
        provider: 'GOOGLE_GEMINI',
      }))
    }

    case 'ANTHROPIC': {
      // Anthropic doesn't have a public model listing API
      // Return static list from config
      return SUPPORTED_AI_PROVIDERS.ANTHROPIC.models.map((modelId) => ({
        id: modelId,
        name: modelId,
        object: 'model',
        ownedBy: 'anthropic',
        capabilities: ['chat', 'reasoning', 'vision'],
        provider: 'ANTHROPIC',
      }))
    }

    case 'NVIDIA_NEMOTRON': {
      // NVIDIA NIM doesn't have a standard model listing API
      // Return static list from config
      return SUPPORTED_AI_PROVIDERS.NVIDIA_NEMOTRON.models.map((modelId) => ({
        id: modelId,
        name: modelId,
        object: 'model',
        ownedBy: 'nvidia',
        capabilities: ['chat', 'reasoning'],
        provider: 'NVIDIA_NEMOTRON',
      }))
    }

    case 'GROQ': {
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Groq model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        created: m.created,
        capabilities: ['chat'],
        contextWindow: m.context_window,
        maxOutputTokens: m.max_tokens,
        provider: 'GROQ',
      }))
    }

    case 'MISTRAL': {
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Mistral model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: 'mistralai',
        capabilities: m.capabilities || ['chat'],
        contextWindow: m.max_context_length,
        maxOutputTokens: m.max_output_tokens,
        provider: 'MISTRAL',
      }))
    }

    case 'OPENROUTER': {
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'ALEX',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`OpenRouter model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        object: 'model',
        ownedBy: m.owned_by,
        capabilities: ['chat'],
        contextWindow: m.context_length,
        maxOutputTokens: m.max_tokens,
        pricing: m.pricing,
        provider: 'OPENROUTER',
      }))
    }

    case 'TOGETHER_AI': {
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Together AI model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        object: 'model',
        ownedBy: m.organization,
        capabilities: ['chat'],
        contextWindow: m.context_length,
        maxOutputTokens: m.max_tokens,
        provider: 'TOGETHER_AI',
      }))
    }

    case 'OTHER': {
      // Custom OpenAI-compatible provider
      const url = `${normalizedBaseUrl}/models`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Custom provider model discovery failed: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        capabilities: ['chat'],
        provider: 'OTHER',
      }))
    }

    default:
      throw new Error(`Model discovery not implemented for provider: ${provider}`)
  }
}

function getContextWindowForOpenAIModel(modelId: string): number {
  if (modelId.includes('gpt-4o')) return 128000
  if (modelId.includes('gpt-4-turbo')) return 128000
  if (modelId.includes('gpt-4')) return 8192
  if (modelId.includes('gpt-3.5-turbo')) return 16385
  if (modelId.includes('o1')) return 200000
  if (modelId.includes('o3')) return 200000
  return 4096
}

function getMaxOutputTokensForOpenAIModel(modelId: string): number {
  if (modelId.includes('o1') || modelId.includes('o3')) return 100000
  if (modelId.includes('gpt-4o')) return 16384
  if (modelId.includes('gpt-4-turbo')) return 4096
  if (modelId.includes('gpt-4')) return 4096
  if (modelId.includes('gpt-3.5-turbo')) return 4096
  return 4096
}

function getCapabilitiesForGeminiModel(modelName: string): string[] {
  const name = modelName.toLowerCase()
  const capabilities = ['chat']
  if (name.includes('vision') || name.includes('1.5-pro') || name.includes('1.5-flash')) {
    capabilities.push('vision')
  }
  if (name.includes('embedding')) {
    capabilities.push('embeddings')
  }
  return capabilities
}

export async function discoverModels(options: ModelDiscoveryOptions): Promise<ModelDiscoveryResult> {
  const cacheKey = `${options.userId}:${options.provider}:${options.credentialId || 'default'}`

  // Check cache first
  if (!options.forceRefresh) {
    const cached = modelCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt.getTime() < MODEL_CACHE_TTL_MS) {
      return {
        models: cached.models,
        provider: options.provider,
        fetchedAt: cached.fetchedAt,
        cached: true,
      }
    }
  }

  // Check for concurrent refresh
  if (refreshLocks.has(cacheKey)) {
    return refreshLocks.get(cacheKey)!
  }

  // Perform discovery
  const discoveryPromise = performDiscovery(options, cacheKey)
  refreshLocks.set(cacheKey, discoveryPromise)

  try {
    const result = await discoveryPromise
    return result
  } finally {
    refreshLocks.delete(cacheKey)
  }
}

const modelCache = new Map<string, { models: DiscoveredModel[]; fetchedAt: Date }>()

async function performDiscovery(options: ModelDiscoveryOptions, cacheKey: string): Promise<ModelDiscoveryResult> {
  try {
    const { apiKey, baseUrl, credential } = await resolveCredentialForDiscovery(options)

    const models = await fetchModelsFromProvider(options.provider, apiKey, baseUrl)

    // Filter models based on task type if specified - but don't filter out models just because
    // they're not in our static capability list. Provider APIs may have newer models.
    let filteredModels = models
    if (options.taskType) {
      if (options.provider === 'MOCK') {
        // MOCK provider only supports chat
        if (options.taskType !== 'chat') {
          filteredModels = []
        }
      } else {
        const meta = SUPPORTED_AI_PROVIDERS[options.provider as PrismaAIProviderType]
        // Only filter if we know the provider doesn't support the task at all
        // For discovered models, we trust the provider's capability reporting
        if (meta && !meta.capabilities.includes(options.taskType as any)) {
          // Provider itself doesn't support this task type at all
          filteredModels = []
        } else if (options.taskType === 'embeddings') {
          // For embeddings, filter to models that declare embeddings capability
          // But if capabilities array is empty/unknown, don't filter (provider may have updated)
          filteredModels = models.filter(m => 
            !m.capabilities || m.capabilities.length === 0 || m.capabilities?.includes('embeddings')
          )
        }
      }
    }

    // Update cache
    const fetchedAt = new Date()
    modelCache.set(cacheKey, { models: filteredModels, fetchedAt })

    return {
      models: filteredModels,
      provider: options.provider,
      fetchedAt,
      cached: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Model Discovery] Failed for ${options.provider}:`, error)

    // Return cached models if available
    const cached = modelCache.get(cacheKey)
    if (cached) {
      return {
        models: cached.models,
        provider: options.provider,
        fetchedAt: cached.fetchedAt,
        cached: true,
        error: errorMessage,
      }
    }

    throw new Error(`Model discovery failed: ${errorMessage}`)
  }
}

export async function getCachedModels(
  userId: string,
  provider: AIProviderType,
  credentialId?: string
): Promise<DiscoveredModel[] | null> {
  const cacheKey = `${userId}:${provider}:${credentialId || 'default'}`
  const cached = modelCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt.getTime() < MODEL_CACHE_TTL_MS) {
    return cached.models
  }
  return null
}

export async function refreshModels(options: ModelDiscoveryOptions): Promise<ModelDiscoveryResult> {
  return discoverModels({ ...options, forceRefresh: true })
}

export function clearModelCache(userId?: string, provider?: AIProviderType): void {
  if (userId && provider) {
    const cacheKey = `${userId}:${provider}:default`
    modelCache.delete(cacheKey)
  } else if (userId) {
    for (const key of modelCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        modelCache.delete(key)
      }
    }
  } else {
    modelCache.clear()
  }
}

export function getModelDiscoveryCacheStats(): { size: number; keys: string[] } {
  return {
    size: modelCache.size,
    keys: Array.from(modelCache.keys()),
  }
}

// Helper to get model info by ID from cache or discovery
export async function getModelInfo(
  userId: string,
  provider: AIProviderType,
  modelId: string,
  credentialId?: string
): Promise<DiscoveredModel | null> {
  const models = await discoverModels({ userId, provider, credentialId, forceRefresh: false })
  return models.models.find(m => m.id === modelId) || null
}

// Validate a custom model ID by attempting a test request
export async function validateCustomModel(
  userId: string,
  provider: AIProviderType,
  modelId: string,
  credentialId?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<{ valid: boolean; error?: string; model?: any }> {
  try {
    // Handle MOCK provider
    if (provider === 'MOCK') {
      return { valid: true, model: { id: modelId, provider: 'MOCK' } }
    }

    const meta = SUPPORTED_AI_PROVIDERS[provider as PrismaAIProviderType]

    // First check if model exists in discovered models
    const models = await discoverModels({ userId, provider, credentialId, forceRefresh: false })
    const existing = models.models.find(m => m.id === modelId)
    if (existing) {
      return { valid: true, model: existing }
    }

    // Try a test request to validate the model
    const { apiKey: resolvedKey, baseUrl: resolvedUrl } = await resolveCredentialForDiscovery({
      userId,
      provider,
      credentialId,
      apiKey,
      baseUrl,
    })

    const testPrompt = 'Test'
    const testUrl = `${baseUrl || meta.defaultBaseUrl}/chat/completions`
    const testPayload = {
      model: modelId,
      messages: [{ role: 'user', content: testPrompt }],
      max_tokens: 5,
      temperature: 0,
    }

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    if (response.ok) {
      return { valid: true }
    }

    if (response.status === 404) {
      return { valid: false, error: `Model "${modelId}" not found or not accessible` }
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' }
    }

    if (response.status === 403) {
      return { valid: false, error: 'Access denied to this model' }
    }

    return { valid: false, error: `Provider returned ${response.status}: ${response.statusText}` }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' }
  }
}