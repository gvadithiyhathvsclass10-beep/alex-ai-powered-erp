/**
 * Universal AI Gateway - Provider Adapter Base Classes
 * 
 * Defines the common interface that all AI provider adapters must implement.
 * Providers are capability-aware: each declares what operations it supports,
 * and the gateway routes requests accordingly.
 */

import { AIProviderType, Prisma } from '@prisma/client'

// ============================================================================
// Core Types
// ============================================================================

export type AITaskType = 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization' | 'audio' | 'image'

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
  [key: string]: unknown
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: any[]
  tool_call_id?: string
}

export interface ProviderCapability {
  chat: boolean
  embeddings: boolean
  reasoning: boolean
  vision: boolean
  structured: boolean
  summarization: boolean
  audio: boolean
  image: boolean
  streaming: boolean
  toolCalling: boolean
  maxContextTokens?: number
  maxOutputTokens?: number
}

export interface ProviderMetadata {
  id: string
  name: string
  type: AIProviderType | 'UNIVERSAL_GATEWAY'
  defaultChatModel: string
  defaultEmbeddingModel?: string
  capabilities: ProviderCapability
  authMethod: 'bearer' | 'x-api-key' | 'query-param' | 'custom'
  supportsModelDiscovery: boolean
  supportsStreaming: boolean
  baseUrl?: string
  keyEnvVar?: string
}

export interface GatewayRequest {
  provider: string
  model: string
  taskType: AITaskType
  messages?: ChatMessage[]
  prompt?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  jsonMode?: boolean
  toolCalls?: boolean
  apiKey: string
  baseUrl?: string
  [key: string]: unknown
}

export interface GatewayResponse {
  text: string
  provider: string
  model: string
  taskType: AITaskType
  tokenUsage: TokenUsage
  latencyMs: number
  finishReason?: string
  rawResponse?: any
}

export interface GatewayStreamChunk {
  type: 'token' | 'done' | 'error'
  content?: string
  error?: string
  finishReason?: string
  tokenUsage?: TokenUsage
}

// ============================================================================
// Errors
// ============================================================================

export class GatewayError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly provider?: string
  public readonly model?: string

  constructor(
    message: string,
    statusCode = 500,
    code = 'GATEWAY_ERROR',
    provider?: string,
    model?: string
  ) {
    super(message)
    this.name = 'GatewayError'
    this.statusCode = statusCode
    this.code = code
    this.provider = provider
    this.model = model
  }
}

export class GatewayConfigError extends GatewayError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 422, 'MISSING_API_KEY', provider, model)
    this.name = 'GatewayConfigError'
  }
}

export class GatewayAuthError extends GatewayError {
  constructor(message: string, provider?: string, statusCode = 401, code = 'INVALID_API_KEY') {
    super(message, statusCode, code, provider)
    this.name = 'GatewayAuthError'
  }
}

export class GatewayRateLimitError extends GatewayError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', provider, model)
    this.name = 'GatewayRateLimitError'
  }
}

export class GatewayModelNotSupportedError extends GatewayError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 400, 'UNSUPPORTED_MODEL', provider, model)
    this.name = 'GatewayModelNotSupportedError'
  }
}

export class GatewayTimeoutError extends GatewayError {
  constructor(message: string, provider?: string, model?: string) {
    super(message, 504, 'GATEWAY_TIMEOUT', provider, model)
    this.name = 'GatewayTimeoutError'
  }
}

export class GatewayNetworkError extends GatewayError {
  constructor(message: string, provider?: string, model?: string, statusCode = 502) {
    super(message, statusCode, 'UPSTREAM_ERROR', provider, model)
    this.name = 'GatewayNetworkError'
  }
}

// ============================================================================
// Base Provider Adapter
// ============================================================================

export abstract class BaseProviderAdapter {
  protected readonly metadata: ProviderMetadata
  protected readonly apiKey: string
  protected readonly baseUrl?: string

  constructor(metadata: ProviderMetadata, apiKey: string, baseUrl?: string) {
    this.metadata = metadata
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  getMetadata(): ProviderMetadata {
    return this.metadata
  }

  getProviderId(): string {
    return this.metadata.id
  }

  getType(): AIProviderType | 'UNIVERSAL_GATEWAY' {
    return this.metadata.type
  }

  getCapabilities(): ProviderCapability {
    return this.metadata.capabilities
  }

  supportsTask(taskType: AITaskType): boolean {
    switch (taskType) {
      case 'chat': return this.metadata.capabilities.chat
      case 'embeddings': return this.metadata.capabilities.embeddings
      case 'reasoning': return this.metadata.capabilities.reasoning
      case 'vision': return this.metadata.capabilities.vision
      case 'structured': return this.metadata.capabilities.structured
      case 'summarization': return this.metadata.capabilities.summarization
      case 'audio': return this.metadata.capabilities.audio
      case 'image': return this.metadata.capabilities.image
      default: return false
    }
  }

  validateModel(model: string, taskType: AITaskType): string {
    if (!this.supportsTask(taskType)) {
      throw new GatewayModelNotSupportedError(
        `Provider ${this.metadata.name} (${this.metadata.id}) does not support task type "${taskType}"`,
        this.metadata.id,
        model
      )
    }
    return model
  }

  getAuthHeaders(): Record<string, string> {
    switch (this.metadata.authMethod) {
      case 'bearer':
        return { Authorization: `Bearer ${this.apiKey}` }
      case 'x-api-key':
        return { 'x-api-key': this.apiKey }
      case 'query-param':
        return {}
      case 'custom':
        return {}
      default:
        return { Authorization: `Bearer ${this.apiKey}` }
    }
  }

  getQueryParams(): Record<string, string> {
    if (this.metadata.authMethod === 'query-param' && this.apiKey) {
      return { key: this.apiKey }
    }
    return {}
  }

  protected getBaseUrl(): string {
    return this.baseUrl || this.metadata.baseUrl || ''
  }

  protected async fetchWithTimeout(
    url: string,
    init: RequestInit,
    provider: string,
    model: string,
    timeoutMs = 30000
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutError(
          `Request to ${provider} (${model}) timed out after ${timeoutMs}ms`,
          provider,
          model
        )
      }
      throw new GatewayNetworkError(
        `Network error communicating with ${provider}.`,
        provider,
        model,
        502
      )
    } finally {
      clearTimeout(timer)
    }
  }

  protected async classifyHttpError(
    response: Response,
    provider: string,
    model: string
  ): Promise<never> {
    let detail = response.statusText || `HTTP ${response.status}`
    try {
      const body = await response.json()
      const extracted =
        body?.error?.message ||
        body?.error ||
        body?.message ||
        body?.detail
      if (typeof extracted === 'string' && extracted.trim()) {
        detail = extracted.trim()
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (response.status === 401 || response.status === 403) {
      throw new GatewayAuthError(
        `${provider} authentication failed (${response.status}): ${detail}`,
        provider,
        response.status === 403 ? 403 : 401,
        'INVALID_API_KEY'
      )
    }

    if (response.status === 429) {
      throw new GatewayRateLimitError(
        `${provider} rate limit or quota exceeded: ${detail}`,
        provider,
        model
      )
    }

    if (
      response.status === 404 ||
      (response.status === 400 && /model|not found|unsupported|does not exist/i.test(detail))
    ) {
      throw new GatewayModelNotSupportedError(
        `${provider} rejected model "${model}": ${detail}`,
        provider,
        model
      )
    }

    if (response.status >= 400 && response.status < 500) {
      throw new GatewayError(
        `${provider} request error (${response.status}): ${detail}`,
        400,
        'GATEWAY_BAD_REQUEST',
        provider,
        model
      )
    }

    throw new GatewayNetworkError(
      `${provider} upstream error (${response.status}): ${detail}`,
      provider,
      model,
      502
    )
  }

  // Abstract methods that each provider must implement
  abstract chat(request: GatewayRequest): Promise<GatewayResponse>
  abstract chatStream?(request: GatewayRequest): AsyncGenerator<GatewayStreamChunk>
  abstract embeddings?(texts: string[]): Promise<{ embeddings: number[][]; tokenCount: number; model: string }>
  abstract discoverModels?(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>>
}