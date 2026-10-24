import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { normalizeProvider, type AITaskType, SUPPORTED_AI_PROVIDERS, type ProviderMetadata } from './service'

export type AIProviderType = PrismaAIProviderType | 'MOCK'

export interface ProviderCapabilities {
  supportsDiscovery: boolean
  supportsPagination: boolean
  supportsEmbeddings: boolean
  supportsVision: boolean
  supportsReasoning: boolean
  supportsStructuredOutput: boolean
  supportsFunctionCalling: boolean
  maxContextWindow?: number
  defaultContextWindow?: number
  rateLimit?: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
}

// Provider capability metadata
export const PROVIDER_CAPABILITIES: Record<PrismaAIProviderType, ProviderCapabilities> = {
  OPENAI: {
    supportsDiscovery: true,
    supportsPagination: false,
    supportsEmbeddings: true,
    supportsVision: true,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    maxContextWindow: 128000,
    defaultContextWindow: 128000,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 2000000 },
  },
  GOOGLE_GEMINI: {
    supportsDiscovery: true,
    supportsPagination: false,
    supportsEmbeddings: true,
    supportsVision: true,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    maxContextWindow: 2000000,
    defaultContextWindow: 1048576,
    rateLimit: { requestsPerMinute: 60, tokensPerMinute: 4000000 },
  },
  ANTHROPIC: {
    supportsDiscovery: false,
    supportsPagination: false,
    supportsEmbeddings: false,
    supportsVision: true,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    maxContextWindow: 200000,
    defaultContextWindow: 200000,
    rateLimit: { requestsPerMinute: 50, tokensPerMinute: 1000000 },
  },
  NVIDIA_NEMOTRON: {
    supportsDiscovery: false,
    supportsPagination: false,
    supportsEmbeddings: false,
    supportsVision: false,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: false,
    maxContextWindow: 128000,
    defaultContextWindow: 128000,
    rateLimit: { requestsPerMinute: 30, tokensPerMinute: 500000 },
  },
  GROQ: {
    supportsDiscovery: true,
    supportsPagination: false,
    supportsEmbeddings: false,
    supportsVision: false,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    maxContextWindow: 131072,
    defaultContextWindow: 8192,
    rateLimit: { requestsPerMinute: 30, tokensPerMinute: 500000 },
  },
  MISTRAL: {
    supportsDiscovery: true,
    supportsPagination: false,
    supportsEmbeddings: true,
    supportsVision: false,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: false,
    maxContextWindow: 32768,
    defaultContextWindow: 32768,
    rateLimit: { requestsPerMinute: 60, tokensPerMinute: 1000000 },
  },
  OPENROUTER: {
    supportsDiscovery: true,
    supportsPagination: true,
    supportsEmbeddings: false,
    supportsVision: true,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: true,
    maxContextWindow: 128000,
    defaultContextWindow: 4096,
    rateLimit: { requestsPerMinute: 100, tokensPerMinute: 2000000 },
  },
  TOGETHER_AI: {
    supportsDiscovery: true,
    supportsPagination: true,
    supportsEmbeddings: false,
    supportsVision: false,
    supportsReasoning: true,
    supportsStructuredOutput: true,
    supportsFunctionCalling: false,
    maxContextWindow: 8192,
    defaultContextWindow: 4096,
    rateLimit: { requestsPerMinute: 100, tokensPerMinute: 2000000 },
  },
  OTHER: {
    supportsDiscovery: true,
    supportsPagination: false,
    supportsEmbeddings: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStructuredOutput: false,
    supportsFunctionCalling: false,
    maxContextWindow: 4096,
    defaultContextWindow: 4096,
    rateLimit: { requestsPerMinute: 30, tokensPerMinute: 500000 },
  },
}

export interface ProviderCapabilityInfo {
  provider: AIProviderType
  capabilities: ProviderCapabilities
  models: DiscoveredModel[]
  deprecatedModels: string[]
  lastUpdated: Date
}

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
  deprecationReason?: string
  deprecationDate?: Date
  isCustom?: boolean
  provider: AIProviderType
  // Test validation status
  testStatus?: 'untested' | 'testing' | 'valid' | 'invalid' | 'unavailable'
  testError?: string
  lastTestedAt?: Date
  // Supported tasks (confirmed by testing)
  confirmedTasks?: AITaskType[]
}

export interface ModelDiscoveryResult {
  models: DiscoveredModel[]
  provider: AIProviderType
  fetchedAt: Date
  cached: boolean
  error?: string
  pagination?: {
    hasMore: boolean
    nextCursor?: string
    totalCount?: number
  }
}

export type ValidationTaskType = AITaskType | 'function-calling' | 'structured-output'

export interface ModelDiscoveryOptions {
  provider: AIProviderType
  userId: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  forceRefresh?: boolean
  taskType?: AITaskType
  pageSize?: number
  cursor?: string
}

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_CONCURRENT_REFRESHES = 3

const refreshLocks = new Map<string, Promise<ModelDiscoveryResult>>()
const modelCache = new Map<string, { models: DiscoveredModel[]; fetchedAt: Date }>()

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

  throw new Error('No API key available for provider ' + provider)
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, init)
    
    if (response.ok) return response
    
    // Rate limit handling
    if (response.status === 429 && attempt < retries) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, waitMs))
      continue
    }
    
    if (response.status >= 500 && attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      continue
    }
    
    const error = await response.json().catch(() => ({}))
    throw new Error('Model discovery failed: ' + (error.error?.message || response.statusText))
  }
  
  throw new Error('Max retries exceeded')
}

async function fetchModelsFromProvider(
  provider: AIProviderType,
  apiKey: string,
  baseUrl: string,
  options?: { pageSize?: number; cursor?: string }
): Promise<{ models: DiscoveredModel[]; hasMore: boolean; nextCursor?: string }> {
  // Handle MOCK provider
  if (provider === 'MOCK') {
    return {
      models: [
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
      ],
      hasMore: false,
    }
  }

  const meta = SUPPORTED_AI_PROVIDERS[provider as PrismaAIProviderType]
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const pageSize = options?.pageSize || 100
  const cursor = options?.cursor

  if (provider === 'OPENAI') {
    // OpenAI doesn't support pagination for /models endpoint
    const url = normalizedBaseUrl + '/models'
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        created: m.created,
        capabilities: ['chat'],
        contextWindow: getContextWindowForOpenAIModel(m.id),
        maxOutputTokens: getMaxOutputTokensForOpenAIModel(m.id),
        provider: 'OPENAI',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'GOOGLE_GEMINI') {
    const url = normalizedBaseUrl + '/models?key=' + encodeURIComponent(apiKey)
    const response = await fetchWithRetry(url, {
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()
    return {
      models: (data.models || []).map((m: any) => ({
        id: m.name?.replace('models/', '') || m.id,
        name: m.displayName || m.name?.replace('models/', '') || m.id,
        object: 'model',
        ownedBy: 'google',
        capabilities: getCapabilitiesForGeminiModel(m.name || m.id),
        contextWindow: m.inputTokenLimit,
        maxOutputTokens: m.outputTokenLimit,
        provider: 'GOOGLE_GEMINI',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'ANTHROPIC') {
    // Anthropic doesn't have a public model listing API
    // Return static list from config
    return {
      models: SUPPORTED_AI_PROVIDERS.ANTHROPIC.models.map((modelId) => ({
        id: modelId,
        name: modelId,
        object: 'model',
        ownedBy: 'anthropic',
        capabilities: ['chat', 'reasoning', 'vision'],
        provider: 'ANTHROPIC',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'NVIDIA_NEMOTRON') {
    // NVIDIA NIM doesn't have a standard model listing API
    return {
      models: SUPPORTED_AI_PROVIDERS.NVIDIA_NEMOTRON.models.map((modelId) => ({
        id: modelId,
        name: modelId,
        object: 'model',
        ownedBy: 'nvidia',
        capabilities: ['chat', 'reasoning'],
        provider: 'NVIDIA_NEMOTRON',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'GROQ') {
    // Groq doesn't support pagination for /models
    const url = normalizedBaseUrl + '/models'
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        created: m.created,
        capabilities: ['chat'],
        contextWindow: m.context_window,
        maxOutputTokens: m.max_tokens,
        provider: 'GROQ',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'MISTRAL') {
    // Mistral doesn't support pagination for /models
    const url = normalizedBaseUrl + '/models'
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: 'mistralai',
        capabilities: m.capabilities || ['chat'],
        contextWindow: m.max_context_length,
        maxOutputTokens: m.max_output_tokens,
        provider: 'MISTRAL',
      })),
      hasMore: false,
      nextCursor: undefined,
    }
  }

  if (provider === 'OPENROUTER') {
    // OpenRouter supports pagination
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', String(pageSize))
    
    const url = normalizedBaseUrl + '/models?' + params.toString()
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'ALEX',
      },
    })

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        object: 'model',
        ownedBy: m.owned_by,
        capabilities: ['chat'],
        contextWindow: m.context_length,
        maxOutputTokens: m.max_tokens,
        pricing: m.pricing,
        provider: 'OPENROUTER',
      })),
      hasMore: data.pagination?.has_more || false,
      nextCursor: data.pagination?.next_cursor,
    }
  }

  if (provider === 'TOGETHER_AI') {
    // Together AI supports pagination
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', String(pageSize))
    
    const url = normalizedBaseUrl + '/models?' + params.toString()
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        object: 'model',
        ownedBy: m.organization,
        capabilities: ['chat'],
        contextWindow: m.context_length,
        maxOutputTokens: m.max_tokens,
        provider: 'TOGETHER_AI',
      })),
      hasMore: data.pagination?.has_more || false,
      nextCursor: data.pagination?.next_cursor,
    }
  }

  if (provider === 'OTHER') {
    // Custom OpenAI-compatible provider - try pagination if supported
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', String(pageSize))
    
    const url = normalizedBaseUrl + '/models?' + params.toString()
    const response = await fetchWithRetry(url, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // Fallback to non-paginated request
      const fallbackResponse = await fetchWithRetry(normalizedBaseUrl + '/models', {
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
      })
      const fallbackData = await fallbackResponse.json()
      return {
        models: (fallbackData.data || []).map((m: any) => ({
          id: m.id,
          name: m.id,
          object: m.object,
          ownedBy: m.owned_by,
          capabilities: ['chat'],
          provider: 'OTHER',
        })),
        hasMore: false,
        nextCursor: undefined,
      }
    }

    const data = await response.json()
    return {
      models: (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        object: m.object,
        ownedBy: m.owned_by,
        capabilities: ['chat'],
        provider: 'OTHER',
      })),
      hasMore: data.pagination?.has_more || false,
      nextCursor: data.pagination?.next_cursor,
    }
  }

  throw new Error('Model discovery not implemented for provider: ' + provider)
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

// Check if a model is deprecated based on provider metadata
async function checkModelDeprecation(
  provider: AIProviderType,
  modelId: string,
  baseUrl: string,
  apiKey: string
): Promise<{ isDeprecated: boolean; deprecationReason?: string; deprecationDate?: Date }> {
  // For now, only check deprecation for providers that expose it in their API
  // Most providers don't explicitly expose deprecation status
  
  if (provider === 'OPENAI') {
    // OpenAI sometimes marks models as deprecated in their API
    // Check known deprecated models
    const deprecatedModels: Record<string, { reason: string; date: string }> = {
      'text-davinci-003': { reason: 'Replaced by gpt-3.5-turbo-instruct', date: '2024-01-04' },
      'code-davinci-002': { reason: 'Replaced by gpt-3.5-turbo', date: '2023-03-01' },
      'gpt-3.5-turbo-0301': { reason: 'Snapshot model, use gpt-3.5-turbo', date: '2023-06-13' },
      'gpt-4-0314': { reason: 'Snapshot model, use gpt-4', date: '2023-06-13' },
      'gpt-4-0613': { reason: 'Snapshot model, use gpt-4', date: '2023-09-13' },
    }
    
    if (deprecatedModels[modelId]) {
      return {
        isDeprecated: true,
        deprecationReason: deprecatedModels[modelId].reason,
        deprecationDate: new Date(deprecatedModels[modelId].date),
      }
    }
  }
  
  if (provider === 'ANTHROPIC') {
    const deprecatedModels: Record<string, { reason: string; date: string }> = {
      'claude-2.0': { reason: 'Replaced by claude-2.1', date: '2023-11-21' },
      'claude-1.3': { reason: 'Legacy model', date: '2023-07-01' },
      'claude-instant-1.2': { reason: 'Replaced by claude-3-haiku', date: '2024-03-01' },
    }
    
    if (deprecatedModels[modelId]) {
      return {
        isDeprecated: true,
        deprecationReason: deprecatedModels[modelId].reason,
        deprecationDate: new Date(deprecatedModels[modelId].date),
      }
    }
  }
  
  // For other providers, we don't have reliable deprecation metadata
  // Return unknown status rather than guessing
  return { isDeprecated: false }
}

// Update model with deprecation info
async function enrichModelWithDeprecation(
  model: DiscoveredModel,
  apiKey: string,
  baseUrl: string
): Promise<DiscoveredModel> {
  const deprecation = await checkModelDeprecation(model.provider, model.id, baseUrl, apiKey)
  return {
    ...model,
    isDeprecated: deprecation.isDeprecated,
    deprecationReason: deprecation.deprecationReason,
    deprecationDate: deprecation.deprecationDate,
  }
}

export async function discoverModels(options: ModelDiscoveryOptions): Promise<ModelDiscoveryResult> {
  const cacheKey = options.userId + ':' + options.provider + ':' + (options.credentialId || 'default')

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

async function performDiscovery(options: ModelDiscoveryOptions, cacheKey: string): Promise<ModelDiscoveryResult> {
  try {
    const { apiKey, baseUrl, credential } = await resolveCredentialForDiscovery(options)

    const { models, hasMore, nextCursor } = await fetchModelsFromProvider(
      options.provider,
      apiKey,
      baseUrl,
      { pageSize: options.pageSize, cursor: options.cursor }
    )

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

    // Enrich models with deprecation info (for non-MOCK providers)
    if (options.provider !== 'MOCK') {
      const enrichedModels = await Promise.all(
        filteredModels.map(m => enrichModelWithDeprecation(m, apiKey, baseUrl))
      )
      filteredModels = enrichedModels
    }

    // Update cache
    const fetchedAt = new Date()
    modelCache.set(cacheKey, { models: filteredModels, fetchedAt })

    return {
      models: filteredModels,
      provider: options.provider,
      fetchedAt,
      cached: false,
      pagination: {
        hasMore,
        nextCursor,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Model Discovery] Failed for ' + options.provider + ': ', error)

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

    throw new Error('Model discovery failed: ' + errorMessage)
  }
}

export async function getCachedModels(
  userId: string,
  provider: AIProviderType,
  credentialId?: string
): Promise<DiscoveredModel[] | null> {
  const cacheKey = userId + ':' + provider + ':' + (credentialId || 'default')
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
    const cacheKey = userId + ':' + provider + ':default'
    modelCache.delete(cacheKey)
  } else if (userId) {
    for (const key of modelCache.keys()) {
      if (key.startsWith(userId + ':')) {
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

// Validate a custom model ID by attempting a test request for a specific task
export async function validateCustomModel(
  userId: string,
  provider: AIProviderType,
  modelId: string,
  credentialId?: string,
  apiKey?: string,
  baseUrl?: string,
  taskType: ValidationTaskType = 'chat'
): Promise<{ valid: boolean; error?: string; model?: DiscoveredModel; testDetails?: any }> {
  try {
    // Handle MOCK provider
    if (provider === 'MOCK') {
      return { valid: true, model: { id: modelId, provider: 'MOCK', capabilities: ['chat'] } as DiscoveredModel }
    }

    const meta = SUPPORTED_AI_PROVIDERS[provider as PrismaAIProviderType]

    // First check if model exists in discovered models
    const models = await discoverModels({ userId, provider, credentialId, forceRefresh: false })
    const existing = models.models.find(m => m.id === modelId)
    if (existing) {
      return { valid: true, model: existing }
    }

    // Try a test request to validate the model for the specific task
    const { apiKey: resolvedKey, baseUrl: resolvedUrl } = await resolveCredentialForDiscovery({
      userId,
      provider,
      credentialId,
      apiKey,
      baseUrl,
    })

    const testResult = await testModelForTask(provider, modelId, resolvedKey, baseUrl || meta.defaultBaseUrl, taskType)

    if (testResult.valid) {
      return { 
        valid: true, 
        model: { 
          id: modelId, 
          provider, 
          capabilities: [taskType],
          confirmedTasks: [taskType]
        } as DiscoveredModel,
        testDetails: testResult.details
      }
    }

    return { valid: false, error: testResult.error, testDetails: testResult.details }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' }
  }
}

// Test a model for a specific task type
async function testModelForTask(
  provider: AIProviderType,
  modelId: string,
  apiKey: string,
  baseUrl: string,
  taskType: ValidationTaskType
): Promise<{ valid: boolean; error?: string; details?: any }> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  
  try {
    switch (taskType) {
      case 'chat': {
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
          temperature: 0,
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      case 'embeddings': {
        const url = normalizedBaseUrl + '/embeddings'
        const payload = {
          model: modelId,
          input: 'test',
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok && data.data && data.data[0]?.embedding) {
          return { 
            valid: true, 
            details: { 
              dimensions: data.data[0].embedding.length,
              usage: data.usage 
            } 
          }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      case 'vision': {
        // Test with a minimal base64 encoded 1x1 pixel PNG
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + testImage } }
            ]
          }],
          max_tokens: 10,
          temperature: 0,
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        // Vision might not be supported - check for specific errors
        if (response.status === 400 && data.error?.message?.toLowerCase().includes('image')) {
          return { valid: false, error: 'Model does not support vision/image inputs', details: { status: response.status } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      case 'reasoning': {
        // For reasoning models, use chat completions with a reasoning prompt
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'Think step by step: What is 2+2?' }],
          max_tokens: 50,
          temperature: 0,
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      case 'structured': {
        // Test structured output with a simple schema
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'Output JSON with a single field "status": "ok"' }],
          max_tokens: 50,
          temperature: 0,
          response_format: { type: 'json_object' },
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        // Structured output might not be supported
        if (response.status === 400 && data.error?.message?.toLowerCase().includes('response_format')) {
          return { valid: false, error: 'Model does not support structured output', details: { status: response.status } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      case 'function-calling': {
        // Test function calling with a simple function
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'What is the weather in San Francisco?' }],
          max_tokens: 50,
          temperature: 0,
          tools: [{
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          }],
          tool_choice: 'auto',
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok && data.choices?.[0]?.message?.tool_calls) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        // Function calling might not be supported
        if (response.status === 400 && data.error?.message?.toLowerCase().includes('tool')) {
          return { valid: false, error: 'Model does not support function calling', details: { status: response.status } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }

      default: {
        // Default to chat test
        const url = normalizedBaseUrl + '/chat/completions'
        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5,
          temperature: 0,
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          return { valid: true, details: { latency: data.usage?.total_tokens || 0 } }
        }
        return { valid: false, error: formatValidationError(response.status, data), details: { status: response.status } }
      }
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Test request failed' }
  }
}

function formatValidationError(status: number, data: any): string {
  if (status === 404) {
    return 'Model not found or not accessible'
  }
  if (status === 401) {
    return 'Invalid API key'
  }
  if (status === 403) {
    return 'Access denied to this model'
  }
  if (status === 429) {
    return 'Rate limited - please try again later'
  }
  if (status >= 500) {
    return 'Provider server error'
  }
  const message = data?.error?.message || 'Unknown error'
  return 'Provider returned ' + status + ': ' + message
}