/**
 * AI Model Discovery - Unified Gateway Architecture
 * 
 * Delegates model discovery to the provider adapters through the
 * Universal AI Gateway. Maintains backward compatibility with existing
 * imports from '@/lib/ai/model-discovery'.
 */

import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import {
  discoverGatewayModels,
  resolveGatewayConfig,
  getProviderAdapterClass,
  getProviderMetadata,
  isProviderRegistered,
  type GatewayProviderType,
} from './gateway'

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
  taskType?: string
}

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const modelCache = new Map<string, { models: DiscoveredModel[]; fetchedAt: Date }>()

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
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

  try {
    const result = await discoverGatewayModels({
      userId: options.userId,
      provider: options.provider as GatewayProviderType,
      credentialId: options.credentialId,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      forceRefresh: options.forceRefresh,
    })

    const models: DiscoveredModel[] = result.models.map(m => ({
      id: m.id,
      name: m.name,
      object: (m as any).object,
      ownedBy: (m as any).ownedBy,
      created: (m as any).created,
      capabilities: (m as any).capabilities,
      contextWindow: (m as any).contextWindow,
      maxOutputTokens: (m as any).maxOutputTokens,
      pricing: (m as any).pricing,
      provider: options.provider,
      isCustom: false,
    }))

    // Update cache
    modelCache.set(cacheKey, { models, fetchedAt: new Date() })

    return {
      models,
      provider: options.provider,
      fetchedAt: new Date(),
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

export async function getModelInfo(
  userId: string,
  provider: AIProviderType,
  modelId: string,
  credentialId?: string
): Promise<DiscoveredModel | null> {
  const models = await discoverModels({ userId, provider, credentialId, forceRefresh: false })
  return models.models.find(m => m.id === modelId) || null
}

export async function validateCustomModel(
  userId: string,
  provider: AIProviderType,
  modelId: string,
  credentialId?: string,
  apiKey?: string,
  baseUrl?: string
): Promise<{ valid: boolean; error?: string; model?: any }> {
  try {
    if (provider === 'MOCK') {
      return { valid: true, model: { id: modelId, provider: 'MOCK' } }
    }

    if (!isProviderRegistered(provider)) {
      return { valid: false, error: `Unsupported provider: ${provider}` }
    }

    // Try to resolve the credential and test the model
    const config = await resolveGatewayConfig({
      userId,
      provider: provider as GatewayProviderType,
      apiKey,
      credentialId,
      baseUrl,
      model: modelId,
      messages: [{ role: 'user', content: 'Test' }],
    } as any)

    // If we can resolve and validate the model, it's valid
    try {
      config.adapter.validateModel(modelId, 'chat')
      return { valid: true, model: { id: modelId, provider } }
    } catch {
      return { valid: false, error: `Model "${modelId}" not supported by ${provider}` }
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    }
  }
}

export function getModelDiscoveryCacheStats(): { size: number; keys: string[] } {
  return {
    size: modelCache.size,
    keys: Array.from(modelCache.keys()),
  }
}