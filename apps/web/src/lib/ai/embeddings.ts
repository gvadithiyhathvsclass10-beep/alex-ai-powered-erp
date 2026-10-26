import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { SUPPORTED_AI_PROVIDERS } from '@/lib/ai/service'

type AIProviderType = PrismaAIProviderType | 'MOCK' | 'local'

const EMBEDDING_CAPABLE_PROVIDERS: PrismaAIProviderType[] = [
  'OPENAI',
  'GOOGLE_GEMINI',
  'MISTRAL',
]

/**
 * Local embedding provider using deterministic hashing (TF-IDF-like).
 * This provides semantic-like search without requiring an external API key.
 * Uses 1536 dimensions to match OpenAI text-embedding-3-small for compatibility.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const dims = 1536

    const embeddings = texts.map(text => {
      const vec = new Array(dims).fill(0)
      const normalized = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1)

      if (normalized.length === 0) {
        vec[0] = 1
        return vec
      }

      for (let i = 0; i < normalized.length; i++) {
        const word = normalized[i]
        const stem = word.length > 4 ? word.slice(0, 4) : word
        const h1 = hashTokenToIndex(word, 1, dims)
        const h2 = hashTokenToIndex(stem, 2, dims)

        vec[h1.idx] += h1.sign * 1.5
        vec[h2.idx] += h2.sign * 0.75

        if (i + 1 < normalized.length) {
          const bigram = `${word}_${normalized[i + 1]}`
          const hb = hashTokenToIndex(bigram, 3, dims)
          vec[hb.idx] += hb.sign
        }
      }

      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1
      return vec.map(val => val / norm)
    })

    return {
      embeddings,
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: 'local-hash-1536',
    }
  }
}

/**
 * Determines if a provider supports embeddings based on SUPPORTED_AI_PROVIDERS metadata.
 */
export function providerSupportsEmbeddings(provider: PrismaAIProviderType): boolean {
  const meta = SUPPORTED_AI_PROVIDERS[provider]
  return meta?.capabilities?.includes('embeddings') === true
}

/**
 * Gets the default embedding model for a provider.
 */
export function getDefaultEmbeddingModel(provider: PrismaAIProviderType): string {
  const meta = SUPPORTED_AI_PROVIDERS[provider]
  return meta?.defaultEmbeddingModel || 'text-embedding-3-small'
}

export function getAIRequestTimeoutMs(): number {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = getAIRequestTimeoutMs()
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[AI Embeddings] Request timed out after ${timeoutMs}ms: ${url}`)
      throw new Error(`AI embedding request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export interface EmbeddingResult {
  embeddings: number[][]
  tokenCount: number
  model: string
}

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<EmbeddingResult>
}

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        encoding_format: 'float',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage?.total_tokens ?? texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gemini-embedding-001') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
    const response = await fetchWithTimeout(
      `${baseUrl}/models/${this.model}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Google embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.embeddings?.map((e: { values: number[] }) => e.values) || [],
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export class MistralEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'mistral-embed') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.model }
    }

    const baseUrl = (process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/+$/, '')
    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Mistral embeddings error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage?.total_tokens ?? texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.model,
    }
  }
}

export function createEmbeddingProvider(
  provider: AIProviderType,
  apiKey: string,
  model?: string
): EmbeddingProvider {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIEmbeddingProvider(apiKey, model)
    case 'GOOGLE_GEMINI':
      return new GoogleEmbeddingProvider(apiKey, model)
    case 'MISTRAL':
      return new MistralEmbeddingProvider(apiKey, model)
    case 'MOCK':
      return new MockEmbeddingProvider()
    case 'local':
      return new LocalEmbeddingProvider()
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}

function hashTokenToIndex(token: string, seed = 0, dims = 1536): { idx: number; sign: number } {
  let h = 2166136261 ^ seed

  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  const unsigned = h >>> 0
  return {
    idx: unsigned % dims,
    sign: (unsigned & 1) === 0 ? 1 : -1,
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const dims = 1536

    const embeddings = texts.map(text => {
      const vec = new Array(dims).fill(0)
      const normalized = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1)

      if (normalized.length === 0) {
        vec[0] = 1
        return vec
      }

      for (let i = 0; i < normalized.length; i++) {
        const word = normalized[i]
        const stem = word.length > 4 ? word.slice(0, 4) : word
        const h1 = hashTokenToIndex(word, 1, dims)
        const h2 = hashTokenToIndex(stem, 2, dims)

        vec[h1.idx] += h1.sign * 1.5
        vec[h2.idx] += h2.sign * 0.75

        if (i + 1 < normalized.length) {
          const bigram = `${word}_${normalized[i + 1]}`
          const hb = hashTokenToIndex(bigram, 3, dims)
          vec[hb.idx] += hb.sign
        }
      }

      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1
      return vec.map(val => val / norm)
    })

    return {
      embeddings,
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: 'mock',
    }
  }
}

export async function getUserEmbeddingProvider(
  userId: string,
  provider?: AIProviderType
): Promise<{ provider: EmbeddingProvider; model: string; credential: AICredential | null; searchMode: 'semantic' | 'local' | 'keyword-only' }> {
  const mockAllowed =
    process.env.NODE_ENV !== 'production' &&
    (provider === 'MOCK' || (process.env.AI_MODE || '').toLowerCase() === 'mock')

  if (mockAllowed) {
    return { provider: new MockEmbeddingProvider(), model: 'mock', credential: null, searchMode: 'semantic' }
  }

  // First, try to resolve the user's chat provider configuration to see if it supports embeddings
  // This enables "single AI configuration" - use the same credential for chat and embeddings when possible
  const chatConfig = await prisma.aIModelConfig.findFirst({
    where: { userId, taskType: 'chat', isDefault: true },
    orderBy: { updatedAt: 'desc' },
  })

  const explicitProvider = provider && provider !== 'MOCK'
    ? provider as PrismaAIProviderType
    : undefined

  // Determine the target provider for embeddings:
  // 1. Explicit provider if it supports embeddings
  // 2. Chat provider if it supports embeddings
  // 3. Explicitly configured embedding provider
  // 4. Any available embedding-capable credential
  let targetProvider: PrismaAIProviderType | undefined

  if (explicitProvider && providerSupportsEmbeddings(explicitProvider)) {
    targetProvider = explicitProvider
  } else if (chatConfig?.provider && providerSupportsEmbeddings(chatConfig.provider)) {
    targetProvider = chatConfig.provider
  } else {
    const embeddingConfig = await prisma.aIModelConfig.findFirst({
      where: { userId, taskType: 'embeddings', isDefault: true },
      orderBy: { updatedAt: 'desc' },
    })
    const configuredProvider = embeddingConfig?.provider
    if (configuredProvider && providerSupportsEmbeddings(configuredProvider)) {
      targetProvider = configuredProvider
    }
  }

  const allowedProviders = targetProvider ? [targetProvider] : EMBEDDING_CAPABLE_PROVIDERS

  const cred = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: { in: allowedProviders },
      isActive: true,
    },
    orderBy: [
      ...(targetProvider ? [] : [{ isDefault: 'desc' as const }]),
      { updatedAt: 'desc' },
    ],
  })

  if (cred) {
    let apiKey: string

    try {
      apiKey = await getCredentialKey(cred)
    } catch {
      throw new Error(
        'The saved embeddings API key could not be decrypted. Verify that ENCRYPTION_KEY matches the key used when it was saved, then re-save the credential if necessary.'
      )
    }

    const modelConfig = await prisma.aIModelConfig.findFirst({
      where: { userId, provider: cred.provider, taskType: 'embeddings', isDefault: true },
      orderBy: { updatedAt: 'desc' },
    })

    const defaultModel = getDefaultEmbeddingModel(cred.provider)

    return {
      provider: createEmbeddingProvider(cred.provider, apiKey, modelConfig?.modelId),
      model: modelConfig?.modelId || defaultModel,
      credential: cred,
      searchMode: 'semantic',
    }
  }

  const envProviders: Array<{ provider: PrismaAIProviderType; key?: string; model: string }> = [
    { provider: 'OPENAI', key: process.env.OPENAI_API_KEY, model: 'text-embedding-3-small' },
    {
      provider: 'GOOGLE_GEMINI',
      key: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
      model: 'gemini-embedding-001',
    },
    { provider: 'MISTRAL', key: process.env.MISTRAL_API_KEY, model: 'mistral-embed' },
  ]

  const envCredential = envProviders.find(item =>
    (!targetProvider || item.provider === targetProvider) && item.key?.trim()
  )

  if (envCredential?.key) {
    return {
      provider: createEmbeddingProvider(envCredential.provider, envCredential.key.trim()),
      model: envCredential.model,
      credential: null,
      searchMode: 'semantic',
    }
  }

  const fallbackMode = (process.env.AI_MODE || '').toLowerCase()
  const useMockFallback = Boolean(fallbackMode && !['local', 'mock', 'off'].includes(fallbackMode))

  if (useMockFallback) {
    return {
      provider: new MockEmbeddingProvider(),
      model: 'mock',
      credential: null,
      searchMode: 'semantic',
    }
  }

  // Fallback to local embedding provider (deterministic hashing-based)
  // This provides semantic-like search without requiring an external API key.
  console.info('[Embeddings] No embedding-capable provider configured; using local hashing-based embeddings')
  return {
    provider: new LocalEmbeddingProvider(),
    model: 'local-hash-1536',
    credential: null,
    searchMode: 'local',
  }
}