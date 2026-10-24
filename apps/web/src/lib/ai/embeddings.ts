/**
 * AI Embeddings - Unified Gateway Architecture
 * 
 * Delegates all embedding operations to the new Universal AI Gateway
 * (@/lib/ai/gateway). Maintains backward compatibility with existing
 * imports from '@/lib/ai/embeddings'.
 */

import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  gatewayEmbeddings,
  resolveGatewayConfig,
  type GatewayEmbeddingsInput,
  GatewayModelNotSupportedError,
  GatewayConfigError,
} from './gateway'

export type AIProviderType = PrismaAIProviderType | 'MOCK'

export interface EmbeddingResult {
  embeddings: number[][]
  tokenCount: number
  model: string
}

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<EmbeddingResult>
}

export const EMBEDDING_CAPABLE_PROVIDERS: PrismaAIProviderType[] = [
  'OPENAI',
  'GOOGLE_GEMINI',
  'MISTRAL',
]

export function getAIRequestTimeoutMs(): number {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000
}

// ============================================================================
// Legacy Provider Classes (backward compatibility)
// ============================================================================

// These classes are kept for backward compatibility but delegate to gateway
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const result = await gatewayEmbeddings({
      texts,
      provider: 'OPENAI',
      model: this.model,
      apiKey: this.apiKey,
      baseUrl: process.env.OPENAI_BASE_URL,
    })
    return {
      embeddings: result.embeddings,
      tokenCount: result.tokenCount,
      model: result.model,
    }
  }
}

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'text-embedding-004') {
    this.apiKey = apiKey
    this.model = model
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const result = await gatewayEmbeddings({
      texts,
      provider: 'GOOGLE_GEMINI',
      model: this.model,
      apiKey: this.apiKey,
      baseUrl: process.env.GOOGLE_GEMINI_BASE_URL,
    })
    return {
      embeddings: result.embeddings,
      tokenCount: result.tokenCount,
      model: result.model,
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
    const result = await gatewayEmbeddings({
      texts,
      provider: 'MISTRAL',
      model: this.model,
      apiKey: this.apiKey,
      baseUrl: process.env.MISTRAL_BASE_URL,
    })
    return {
      embeddings: result.embeddings,
      tokenCount: result.tokenCount,
      model: result.model,
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
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
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

// ============================================================================
// Unified Embedding Resolution (uses gateway)
// ============================================================================

export async function getUserEmbeddingProvider(
  userId: string,
  provider?: AIProviderType
): Promise<{ provider: EmbeddingProvider; model: string; credential: AICredential | null }> {
  const mockAllowed =
    process.env.NODE_ENV !== 'production' &&
    (provider === 'MOCK' || (process.env.AI_MODE || '').toLowerCase() === 'mock')

  if (mockAllowed) {
    return { provider: new MockEmbeddingProvider(), model: 'mock', credential: null }
  }

  // Use gateway to resolve embedding provider
  try {
    // We need to resolve the config but the gatewayEmbeddings function handles
    // the actual embedding call. Here we resolve to determine which provider/model.
    const config = await resolveGatewayConfig({
      userId,
      provider: provider as string,
      model: undefined,
      taskType: 'embeddings',
      messages: [{ role: 'user', content: '' }],
    } as any)

    if (config.provider === 'MOCK') {
      return { provider: new MockEmbeddingProvider(), model: 'mock', credential: null }
    }

    // Return an adapter-based embedding provider
    return {
      provider: new GatewayEmbeddingAdapter(config.apiKey, config.provider, config.model, config.baseUrl),
      model: config.model,
      credential: config.credential,
    }
  } catch {
    // Fall back to environment variables
    const envProviders: Array<{ provider: PrismaAIProviderType; key?: string; model: string }> = [
      { provider: 'OPENAI', key: process.env.OPENAI_API_KEY, model: 'text-embedding-3-small' },
      {
        provider: 'GOOGLE_GEMINI',
        key: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        model: 'text-embedding-004',
      },
      { provider: 'MISTRAL', key: process.env.MISTRAL_API_KEY, model: 'mistral-embed' },
    ]

    const requestedProvider = provider && provider !== 'MOCK' ? provider as PrismaAIProviderType : undefined
    const envCredential = envProviders.find(
      item => (!requestedProvider || item.provider === requestedProvider) && item.key?.trim()
    )

    if (envCredential?.key) {
      return {
        provider: createEmbeddingProvider(envCredential.provider, envCredential.key.trim()),
        model: envCredential.model,
        credential: null,
      }
    }

    throw new GatewayConfigError(
      requestedProvider
        ? `No active ${requestedProvider} API credential is configured for embeddings.`
        : 'No embeddings API key is configured.',
      requestedProvider
    )
  }
}

// ============================================================================
// Gateway-backed embedding adapter
// ============================================================================

class GatewayEmbeddingAdapter implements EmbeddingProvider {
  private apiKey: string
  private providerType: string
  private model: string
  private baseUrl?: string

  constructor(apiKey: string, providerType: string, model: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.providerType = providerType
    this.model = model
    this.baseUrl = baseUrl
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const result = await gatewayEmbeddings({
      texts,
      provider: this.providerType,
      model: this.model,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    })
    return {
      embeddings: result.embeddings,
      tokenCount: result.tokenCount,
      model: result.model,
    }
  }
}

export { GatewayModelNotSupportedError, GatewayConfigError }