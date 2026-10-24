/**
 * Universal AI Gateway - Core Service
 * 
 * Unified AI integration architecture that replaces the fragmented
 * provider-specific credential system. Provides:
 * - Credential manager (secure save/retrieve/delete with encryption)
 * - Provider registry (adapter instantiation)
 * - Request router (resolve provider/model/task, validate capabilities)
 * - Unified inference interface (chat, embeddings, structured output)
 * - Connection testing and model discovery
 */

import { prisma } from '@/lib/prisma'
import { decrypt, encrypt, generateKeyHash, maskApiKey } from '@/lib/encryption'
import { AIProviderType, AICredential as PrismaAICredential, AIModelConfig as PrismaAIModelConfig, Prisma } from '@prisma/client'
import {
  BaseProviderAdapter,
  GatewayRequest,
  GatewayResponse,
  GatewayStreamChunk,
  GatewayError,
  GatewayConfigError,
  GatewayAuthError,
  GatewayRateLimitError,
  GatewayModelNotSupportedError,
  GatewayTimeoutError,
  GatewayNetworkError,
  ProviderMetadata,
  AITaskType,
  TokenUsage,
  ChatMessage,
} from './providers/base'
import {
  getProviderAdapterClass,
  getProviderMetadata,
  getAllProviderMetadata,
  getProvidersByCapability,
  isProviderRegistered,
  ProviderCapability,
} from './providers/registry'

export type { AITaskType, TokenUsage, ChatMessage, GatewayStreamChunk, ProviderMetadata, ProviderCapability }
export { getProviderAdapterClass, getProviderMetadata, getAllProviderMetadata, getProvidersByCapability, isProviderRegistered }

// ============================================================================
// Types
// ============================================================================

export type GatewayProviderType = AIProviderType | 'UNIVERSAL_GATEWAY' | 'MOCK'

export interface ResolvedGatewayConfig {
  provider: GatewayProviderType
  model: string
  apiKey: string
  baseUrl: string
  credential: PrismaAICredential | null
  adapter: BaseProviderAdapter
  metadata: ProviderMetadata
}

export interface GatewayChatInput {
  userId?: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  messages: ChatMessage[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  jsonMode?: boolean
  toolCalls?: boolean
  taskType?: AITaskType
  timeoutMs?: number
  gatewayKey?: string  // Universal gateway key (Mode A)
  gatewayType?: string  // Gateway type (e.g., "openrouter", "custom")
}

export interface GatewayEmbeddingsInput {
  userId?: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  texts: string[]
  taskType?: AITaskType
  timeoutMs?: number
}

export interface GatewayStructuredOutputInput<T = any> {
  userId?: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  prompt: string
  systemPrompt: string
  schemaDescription: string
  temperature?: number
  maxTokens?: number
  taskType?: AITaskType
  validate?: (parsed: any) => T
}

export interface GatewayTestResult {
  success: boolean
  provider: string
  model: string
  response: string
  latencyMs: number
  tokenUsage: TokenUsage
}

export interface StoredCredential {
  id: string
  provider: string
  providerName: string
  isActive: boolean
  isDefault: boolean
  models: string[]
  usageLimit: number | null
  usageCount: number
  lastUsedAt: Date | null
  createdAt: Date
  maskedKey: string
  gatewayType: string | null
  baseUrl: string | null
}

// ============================================================================
// Error Hierarchy (re-exported for convenience)
// ============================================================================

export {
  GatewayError,
  GatewayConfigError,
  GatewayAuthError,
  GatewayRateLimitError,
  GatewayModelNotSupportedError,
  GatewayTimeoutError,
  GatewayNetworkError,
}

// ============================================================================
// Credential Manager
// ============================================================================

/**
 * Securely save a user's AI credential (gateway key or provider key).
 * Encrypts the key at rest and never returns plaintext to the client.
 */
export async function saveGatewayCredential(input: {
  userId: string
  provider: string
  providerName?: string
  apiKey: string
  models?: string[]
  isDefault?: boolean
  usageLimit?: number | null
  gatewayType?: string
  baseUrl?: string
}): Promise<StoredCredential> {
  const normalizedProvider = input.provider.toUpperCase() as AIProviderType

  // Validate provider is registered
  if (!isProviderRegistered(normalizedProvider)) {
    throw new GatewayConfigError(`Unsupported provider: ${input.provider}`, normalizedProvider)
  }

  // Validate API key format
  const cleanKey = input.apiKey.trim()
  if (!cleanKey || cleanKey.length < 8) {
    throw new GatewayAuthError('API key is required (minimum 8 characters)', normalizedProvider, 400, 'INVALID_API_KEY_FORMAT')
  }
  if (/\s/.test(cleanKey)) {
    throw new GatewayAuthError('API key must not contain spaces', normalizedProvider, 400, 'INVALID_API_KEY_FORMAT')
  }

  const meta = getProviderMetadata(normalizedProvider)
  const providerName = input.providerName?.trim() || meta?.name || normalizedProvider

  // Validate models if provided
  const validatedModels: string[] = []
  if (input.models && input.models.length > 0) {
    for (const m of input.models) {
      if (m && String(m).trim()) {
        validatedModels.push(String(m).trim())
      }
    }
  } else if (meta?.defaultChatModel) {
    validatedModels.push(meta.defaultChatModel)
  }

  // Set as default if requested
  if (input.isDefault) {
    await prisma.aICredential.updateMany({
      where: { userId: input.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const encryptedKey = await encrypt(cleanKey)
  const keyHash = generateKeyHash(cleanKey)

  const credential = await prisma.aICredential.create({
    data: {
      userId: input.userId,
      provider: normalizedProvider,
      providerName,
      encryptedKey,
      keyHash,
      models: validatedModels.length > 0 ? (validatedModels as unknown as Prisma.InputJsonValue) : undefined,
      isDefault: Boolean(input.isDefault),
      usageLimit: input.usageLimit ? Number(input.usageLimit) : null,
      isActive: true,
      gatewayType: input.gatewayType || null,
      baseUrl: input.baseUrl || null,
    },
  })

  // Auto-create default model configs for chat and embeddings
  if (meta?.defaultChatModel) {
    const existing = await prisma.aIModelConfig.findFirst({
      where: {
        userId: input.userId,
        provider: normalizedProvider,
        taskType: 'chat',
        isDefault: true,
      },
    })
    if (!existing) {
      await prisma.aIModelConfig.create({
        data: {
          userId: input.userId,
          provider: normalizedProvider,
          modelId: meta.defaultChatModel,
          taskType: 'chat',
          isDefault: true,
        },
      })
    }
  }

  return {
    id: credential.id,
    provider: credential.provider,
    providerName: credential.providerName,
    isActive: credential.isActive,
    isDefault: credential.isDefault,
    models: Array.isArray(credential.models) ? (credential.models as unknown as string[]) : [],
    usageLimit: credential.usageLimit,
    usageCount: credential.usageCount,
    lastUsedAt: credential.lastUsedAt,
    createdAt: credential.createdAt,
    maskedKey: maskApiKey(cleanKey),
    gatewayType: credential.gatewayType,
    baseUrl: credential.baseUrl,
  }
}

/**
 * Get all credentials for a user (never returns plaintext keys).
 */
export async function getUserCredentials(userId: string): Promise<StoredCredential[]> {
  const credentials = await prisma.aICredential.findMany({
    where: { userId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  return credentials.map(c => ({
    id: c.id,
    provider: c.provider,
    providerName: c.providerName,
    isActive: c.isActive,
    isDefault: c.isDefault,
    models: (Array.isArray(c.models) ? c.models : []) as string[],
    usageLimit: c.usageLimit,
    usageCount: c.usageCount,
    lastUsedAt: c.lastUsedAt,
    createdAt: c.createdAt,
    maskedKey: '••••••••',
    gatewayType: c.gatewayType,
    baseUrl: c.baseUrl,
  }))
}

/**
 * Get the user's default gateway/credential for a given provider.
 * Falls back to environment variables if no saved credential exists.
 */
export async function getUserGatewayCredential(
  userId: string,
  provider?: GatewayProviderType
): Promise<{ apiKey: string; baseUrl: string; credential: PrismaAICredential | null; providerType: GatewayProviderType } | null> {
  // 1. Look for saved credential
  if (provider && provider !== 'MOCK') {
    const cred = await prisma.aICredential.findFirst({
      where: {
        userId,
        provider: provider as AIProviderType,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
    if (cred) {
      let apiKey: string
      try {
        apiKey = await decrypt(cred.encryptedKey)
      } catch {
        throw new GatewayConfigError(
          'The saved API key could not be decrypted. Verify that ENCRYPTION_KEY matches the key used when it was saved.',
          cred.provider
        )
      }
      return {
        apiKey,
        baseUrl: cred.baseUrl || '',
        credential: cred,
        providerType: (cred.provider as GatewayProviderType),
      }
    }
  }

  // 2. Fall back to environment variables
  const envProviders: Array<{ provider: GatewayProviderType; key?: string; baseUrl?: string }> = [
    { provider: 'UNIVERSAL_GATEWAY', key: process.env.UNIVERSAL_AI_API_KEY, baseUrl: process.env.UNIVERSAL_AI_BASE_URL },
    { provider: 'OPENAI', key: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL },
    { provider: 'ANTHROPIC', key: process.env.ANTHROPIC_API_KEY, baseUrl: process.env.ANTHROPIC_BASE_URL },
    { provider: 'GROQ', key: process.env.GROQ_API_KEY, baseUrl: process.env.GROQ_BASE_URL },
    { provider: 'MISTRAL', key: process.env.MISTRAL_API_KEY, baseUrl: process.env.MISTRAL_BASE_URL },
    { provider: 'TOGETHER_AI', key: process.env.TOGETHER_AI_API_KEY, baseUrl: process.env.TOGETHER_AI_BASE_URL },
    { provider: 'NVIDIA_NEMOTRON', key: process.env.NVIDIA_NEMOTRON_API_KEY, baseUrl: process.env.NVIDIA_NEMOTRON_BASE_URL },
    { provider: 'GOOGLE_GEMINI', key: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY, baseUrl: process.env.GOOGLE_GEMINI_BASE_URL },
    { provider: 'OPENROUTER', key: process.env.OPENROUTER_API_KEY, baseUrl: process.env.OPENROUTER_BASE_URL },
  ]

  const providersToCheck = provider ? [provider] : envProviders.map(p => p.provider)
  for (const prov of providersToCheck) {
    const env = envProviders.find(p => p.provider === prov)
    if (env?.key && env.key.trim().length >= 8) {
      return {
        apiKey: env.key.trim(),
        baseUrl: env.baseUrl || '',
        credential: null,
        providerType: prov,
      }
    }
  }

  return null
}

/**
 * Delete a user's credential.
 */
export async function deleteGatewayCredential(userId: string, credentialId: string): Promise<void> {
  const credential = await prisma.aICredential.findUnique({
    where: { id: credentialId },
  })
  if (!credential || credential.userId !== userId) {
    throw new GatewayError('Credential not found', 404, 'NOT_FOUND')
  }
  await prisma.aICredential.delete({ where: { id: credentialId } })
}

// ============================================================================
// Request Router
// ============================================================================

/**
 * Resolve the gateway configuration for a request.
 * Priority:
 * 1. Explicit apiKey + provider (one-time use)
 * 2. Saved credential (by credentialId or default for provider)
 * 3. Universal gateway key from env
 * 4. Direct provider key from env
 * 5. Mock mode (non-production only)
 */
export async function resolveGatewayConfig(input: GatewayChatInput): Promise<ResolvedGatewayConfig> {
  const taskType = input.taskType || 'chat'

  // 1. Explicit API key + provider
  if (input.apiKey && input.provider) {
    const providerType = normalizeProviderType(input.provider)
    const AdapterClass = getProviderAdapterClass(providerType)
    const meta = getProviderMetadata(providerType)
    if (!meta) {
      throw new GatewayConfigError(`Unknown provider: ${input.provider}`, providerType)
    }

    const adapter = new AdapterClass(input.apiKey, input.baseUrl)
    const model = input.model || meta.defaultChatModel
    adapter.validateModel(model, taskType)

    return {
      provider: providerType,
      model,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl || meta.baseUrl || '',
      credential: null,
      adapter,
      metadata: meta,
    }
  }

  // 2. Explicit credential ID
  if (input.credentialId && input.userId) {
    const cred = await prisma.aICredential.findFirst({
      where: { id: input.credentialId, userId: input.userId, isActive: true },
    })
    if (!cred) {
      throw new GatewayConfigError('Credential not found or inactive')
    }
    return await resolveFromCredential(cred, input, taskType)
  }

  // 3. User's default credential for provider
  if (input.userId) {
    const providerType = input.provider ? normalizeProviderType(input.provider) : undefined

    let targetProvider: AIProviderType | undefined
    let configuredModel = input.model

    if (!targetProvider || !configuredModel) {
      const modelConfig = await prisma.aIModelConfig.findFirst({
        where: {
          userId: input.userId,
          taskType: taskType === 'structured' ? 'chat' : taskType,
          isDefault: true,
          ...(targetProvider ? { provider: targetProvider } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      })
      if (modelConfig) {
        if (!targetProvider) targetProvider = modelConfig.provider
        if (!configuredModel) configuredModel = modelConfig.modelId
      }
    }

    // Try to find a credential for the target provider
    const credWhere: any = {
      userId: input.userId,
      isActive: true,
    }
    if (targetProvider) {
      credWhere.provider = targetProvider
    }

    const cred = await prisma.aICredential.findFirst({
      where: credWhere,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })

    if (cred) {
      return await resolveFromCredential(cred, { ...input, model: configuredModel }, taskType)
    }
  }

  // 4. Environment variable fallback
  const providerOrder: GatewayProviderType[] = input.provider
    ? [normalizeProviderType(input.provider)]
    : ['UNIVERSAL_GATEWAY', 'OPENAI', 'GOOGLE_GEMINI', 'ANTHROPIC', 'NVIDIA_NEMOTRON', 'GROQ', 'MISTRAL', 'OPENROUTER', 'TOGETHER_AI']

  for (const prov of providerOrder) {
    const envKey =
      prov === 'GOOGLE_GEMINI' ? process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      : prov === 'UNIVERSAL_GATEWAY' ? process.env.UNIVERSAL_AI_API_KEY
      : process.env[`${prov}_API_KEY` as string]

    if (envKey && envKey.trim().length >= 8) {
      const providerType = prov as AIProviderType
      const AdapterClass = getProviderAdapterClass(providerType)
      const meta = getProviderMetadata(providerType)
      if (!meta) continue

      const envBaseUrl = prov === 'UNIVERSAL_GATEWAY' ? process.env.UNIVERSAL_AI_BASE_URL : undefined
      const adapter = new AdapterClass(envKey.trim(), input.baseUrl || envBaseUrl || meta.baseUrl || '')
      const model = input.model || meta.defaultChatModel
      adapter.validateModel(model, taskType)

      return {
        provider: providerType,
        model,
        apiKey: envKey.trim(),
        baseUrl: input.baseUrl || envBaseUrl || meta.baseUrl || '',
        credential: null,
        adapter,
        metadata: meta,
      }
    }
  }

  // 5. Mock mode (non-production only)
  if (process.env.NODE_ENV !== 'production' && (process.env.AI_MODE || '').toLowerCase() === 'mock') {
    return resolveMockConfig(input, taskType)
  }

  throw new GatewayConfigError(
    input.provider
      ? `No API key configured for ${input.provider}. Please configure a Universal AI API Key or provider credentials.`
      : 'No AI provider API key is configured. Please set UNIVERSAL_AI_API_KEY or configure provider credentials.'
  )
}

async function resolveFromCredential(
  cred: PrismaAICredential,
  input: GatewayChatInput,
  taskType: AITaskType
): Promise<ResolvedGatewayConfig> {
  let apiKey: string
  try {
    apiKey = await decrypt(cred.encryptedKey)
  } catch {
    throw new GatewayConfigError(
      'The saved API key could not be decrypted. Verify ENCRYPTION_KEY matches.',
      cred.provider
    )
  }

  if (cred.usageLimit && cred.usageCount >= cred.usageLimit) {
    throw new GatewayRateLimitError(
      `Usage limit (${cred.usageLimit}) reached for ${cred.providerName || cred.provider}`,
      cred.provider
    )
  }

  const providerType = cred.provider as AIProviderType
  const AdapterClass = getProviderAdapterClass(providerType)
  const meta = getProviderMetadata(providerType)
  if (!meta) {
    throw new GatewayConfigError(`Unknown provider: ${cred.provider}`, providerType)
  }

  const adapter = new AdapterClass(apiKey, input.baseUrl || cred.baseUrl || meta.baseUrl || '')
  const customModels = Array.isArray(cred.models) ? (cred.models as string[]) : []
  let modelToUse = input.model

  if (!modelToUse) {
    const modelCfg = await prisma.aIModelConfig.findFirst({
      where: {
        userId: input.userId!,
        provider: cred.provider,
        taskType: taskType === 'structured' ? 'chat' : taskType,
        isDefault: true,
      },
    })
    modelToUse = (modelCfg?.modelId as string | undefined) || customModels[0] || meta.defaultChatModel
  }

  adapter.validateModel(modelToUse as string, taskType)

  return {
    provider: providerType,
    model: modelToUse,
    apiKey,
    baseUrl: input.baseUrl || cred.baseUrl || meta.baseUrl || '',
    credential: cred,
    adapter,
    metadata: meta,
  }
}

function resolveMockConfig(input: GatewayChatInput, taskType: AITaskType): ResolvedGatewayConfig {
  const meta: ProviderMetadata = {
    id: 'MOCK',
    name: 'Mock',
    type: 'MOCK' as AIProviderType,
    defaultChatModel: 'mock',
    capabilities: {
      chat: true, embeddings: true, reasoning: true, vision: false,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: false,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: false,
    supportsStreaming: true,
    keyEnvVar: 'MOCK_API_KEY',
  }

  class MockAdapter extends BaseProviderAdapter {
    async chat(_request: GatewayRequest): Promise<GatewayResponse> {
      return {
        text: 'Mock AI response (development mode only)',
        provider: 'MOCK',
        model: 'mock',
        taskType: _request.taskType,
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        latencyMs: 10,
      }
    }

    async *chatStream(_request: GatewayRequest): AsyncGenerator<GatewayStreamChunk> {
      yield { type: 'token', content: 'Mock ' }
      yield { type: 'done' }
    }

    async embeddings(_texts: string[]): Promise<{ embeddings: number[][]; tokenCount: number; model: string }> {
      return { embeddings: [], tokenCount: 0, model: 'mock' }
    }

    async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
      return [{ id: 'mock', name: 'Mock Model' }]
    }
  }

  return {
    provider: 'MOCK',
    model: 'mock',
    apiKey: 'mock',
    baseUrl: '',
    credential: null,
    adapter: new MockAdapter(meta, 'mock'),
    metadata: meta,
  }
}

function normalizeProviderType(input: string): AIProviderType {
  const upper = input.trim().toUpperCase() as AIProviderType
  const aliases: Record<string, AIProviderType> = {
    OPENAI: 'OPENAI',
    GOOGLE: 'GOOGLE_GEMINI',
    GOOGLE_GEMINI: 'GOOGLE_GEMINI',
    GEMINI: 'GOOGLE_GEMINI',
    ANTHROPIC: 'ANTHROPIC',
    CLAUDE: 'ANTHROPIC',
    NVIDIA: 'NVIDIA_NEMOTRON',
    NVIDIA_NEMOTRON: 'NVIDIA_NEMOTRON',
    NEMOTRON: 'NVIDIA_NEMOTRON',
    GROQ: 'GROQ',
    MISTRAL: 'MISTRAL',
    OPENROUTER: 'OPENROUTER',
    TOGETHER: 'TOGETHER_AI',
    TOGETHER_AI: 'TOGETHER_AI',
    OTHER: 'OTHER',
    UNIVERSAL_GATEWAY: 'UNIVERSAL_GATEWAY',
    GATEWAY: 'UNIVERSAL_GATEWAY',
  }

  const alias = aliases[input.trim().toLowerCase()]
  if (alias) return alias

  if (upper in PROVIDER_ALIASES_MAP) {
    return PROVIDER_ALIASES_MAP[upper]
  }

  throw new GatewayConfigError(`Unsupported AI provider: ${input}`, upper)
}

const PROVIDER_ALIASES_MAP: Record<string, AIProviderType> = {
  OPENAI: 'OPENAI',
  GOOGLE_GEMINI: 'GOOGLE_GEMINI',
  ANTHROPIC: 'ANTHROPIC',
  NVIDIA_NEMOTRON: 'NVIDIA_NEMOTRON',
  GROQ: 'GROQ',
  MISTRAL: 'MISTRAL',
  OPENROUTER: 'OPENROUTER',
  TOGETHER_AI: 'TOGETHER_AI',
  OTHER: 'OTHER',
  UNIVERSAL_GATEWAY: 'UNIVERSAL_GATEWAY',
}

// ============================================================================
// Unified Inference Interface
// ============================================================================

export async function gatewayChat(input: GatewayChatInput): Promise<GatewayResponse> {
  if (!input.messages || input.messages.length === 0) {
    throw new GatewayConfigError('Messages are required for chat')
  }

  const config = await resolveGatewayConfig(input)
  const start = Date.now()

  try {
    const request: GatewayRequest = {
      provider: config.provider,
      model: config.model,
      taskType: input.taskType || 'chat',
      messages: input.messages,
      prompt: input.messages[input.messages.length - 1].content,
      systemPrompt: input.systemPrompt,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      stream: false,
      jsonMode: input.jsonMode,
      toolCalls: input.toolCalls,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }

    const response = await config.adapter.chat(request)

    await recordUsage(config.credential)

    return {
      ...response,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    if (error instanceof GatewayError) throw error
    throw new GatewayNetworkError(
      error instanceof Error ? error.message : 'Chat request failed',
      config.provider,
      config.model
    )
  }
}

export async function* gatewayChatStream(input: GatewayChatInput): AsyncGenerator<GatewayStreamChunk> {
  const config = await resolveGatewayConfig({ ...input, stream: true })

  if (!config.adapter.chatStream) {
    throw new GatewayModelNotSupportedError(
      `Provider ${config.provider} does not support streaming`,
      config.provider,
      config.model
    )
  }

  const request: GatewayRequest = {
    provider: config.provider,
    model: config.model,
    taskType: input.taskType || 'chat',
    messages: input.messages,
    prompt: input.messages[input.messages.length - 1].content,
    systemPrompt: input.systemPrompt,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    stream: true,
    jsonMode: input.jsonMode,
    toolCalls: input.toolCalls,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  }

  let chunkCount = 0
  for await (const chunk of config.adapter.chatStream(request)) {
    chunkCount++
    yield chunk
  }

  await recordUsage(config.credential)
}

export async function gatewayEmbeddings(input: GatewayEmbeddingsInput): Promise<{
  embeddings: number[][]
  tokenCount: number
  model: string
  provider: string
}> {
  if (!input.texts || input.texts.length === 0) {
    throw new GatewayConfigError('Texts are required for embeddings')
  }

  const config = await resolveGatewayConfig({
    ...input,
    taskType: 'embeddings',
    messages: [{ role: 'user', content: input.texts[0] }],
  } as GatewayChatInput)

  if (!config.adapter.embeddings) {
    throw new GatewayModelNotSupportedError(
      `Provider ${config.provider} does not support embeddings`,
      config.provider,
      config.model
    )
  }

  const result = await config.adapter.embeddings(input.texts)
  await recordUsage(config.credential)

  return {
    embeddings: result.embeddings,
    tokenCount: result.tokenCount,
    model: result.model,
    provider: config.provider,
  }
}

export async function gatewayStructuredOutput<T = any>(input: GatewayStructuredOutputInput<T>): Promise<{
  data: T
  rawText: string
  provider: string
  model: string
  tokenUsage: TokenUsage
  latencyMs: number
}> {
  const config = await resolveGatewayConfig({
    ...input,
    messages: [{ role: 'user', content: input.prompt }],
    taskType: 'structured',
  } as GatewayChatInput)

  const fullSystemPrompt = `${input.systemPrompt}\n\nYou MUST respond with valid JSON only (no markdown prose outside JSON) matching this schema:\n${input.schemaDescription}`

  const response = await gatewayChat({
    ...input,
    provider: config.provider,
    model: config.model,
    systemPrompt: fullSystemPrompt,
    messages: [{ role: 'user', content: input.prompt }],
    jsonMode: true,
    taskType: 'structured',
  })

  let parsed: any
  try {
    const trimmed = response.text.trim()
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed
    parsed = JSON.parse(candidate)
  } catch {
    const objStart = response.text.indexOf('{')
    const objEnd = response.text.lastIndexOf('}')
    if (objStart !== -1 && objEnd > objStart) {
      parsed = JSON.parse(response.text.slice(objStart, objEnd + 1))
    } else {
      throw new GatewayError(
        `Failed to parse structured JSON output from ${config.provider}`,
        502,
        'INVALID_STRUCTURED_OUTPUT',
        config.provider,
        config.model
      )
    }
  }

  const validated = input.validate ? input.validate(parsed) : (parsed as T)

  return {
    data: validated,
    rawText: response.text,
    provider: config.provider,
    model: config.model,
    tokenUsage: response.tokenUsage,
    latencyMs: response.latencyMs,
  }
}

async function recordUsage(credential: PrismaAICredential | null): Promise<void> {
  if (!credential?.id) return
  try {
    await prisma.aICredential.update({
      where: { id: credential.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// Connection Testing
// ============================================================================

export async function testGatewayConnection(input: {
  userId?: string
  provider?: string
  apiKey?: string
  credentialId?: string
  model?: string
  baseUrl?: string
  gatewayKey?: string
}): Promise<GatewayTestResult> {
  const config = await resolveGatewayConfig({
    userId: input.userId,
    provider: input.provider,
    apiKey: input.apiKey,
    credentialId: input.credentialId,
    model: input.model,
    baseUrl: input.baseUrl,
    messages: [{ role: 'user', content: 'Respond with "OK" to confirm the API connection is working.' }],
  } as GatewayChatInput)

  const start = Date.now()
  try {
    const response = await gatewayChat({
      ...input,
      provider: config.provider,
      model: config.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Respond with "OK" to confirm the API connection is working.' }],
      maxTokens: 64,
      temperature: 0,
    })

    return {
      success: true,
      provider: config.provider,
      model: config.model,
      response: response.text,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    }
  } catch (error) {
    if (error instanceof GatewayConfigError) throw error
    if (error instanceof GatewayAuthError) throw error
    if (error instanceof GatewayModelNotSupportedError) throw error
    throw new GatewayNetworkError(
      error instanceof Error ? error.message : 'Connection test failed',
      config.provider,
      config.model
    )
  }
}

// ============================================================================
// Model Catalog
// ============================================================================

export async function discoverGatewayModels(input: {
  userId: string
  provider: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  forceRefresh?: boolean
}): Promise<{
  provider: string
  models: Array<{ id: string; name: string; [key: string]: unknown }>
  fetchedAt: Date
  cached: boolean
  error?: string
}> {
  const config = await resolveGatewayConfig({
    userId: input.userId,
    provider: input.provider,
    apiKey: input.apiKey,
    credentialId: input.credentialId,
    baseUrl: input.baseUrl,
    messages: [{ role: 'user', content: '' }],
  } as GatewayChatInput)

  if (!config.adapter.discoverModels) {
    // Return static models from metadata
    const meta = config.metadata
    const models = [
      { id: meta.defaultChatModel, name: meta.defaultChatModel, provider: config.provider },
    ]
    if (meta.defaultEmbeddingModel) {
      models.push({ id: meta.defaultEmbeddingModel, name: meta.defaultEmbeddingModel, provider: config.provider })
    }
    return {
      provider: config.provider,
      models,
      fetchedAt: new Date(),
      cached: false,
    }
  }

  const models = await config.adapter.discoverModels()
  return {
    provider: config.provider,
    models,
    fetchedAt: new Date(),
    cached: false,
  }
}

export function getAllProviders(): ProviderMetadata[] {
  return getAllProviderMetadata()
}

export function getProvidersForTask(taskType: AITaskType): ProviderMetadata[] {
  const capabilityMap: Record<AITaskType, keyof ProviderCapability> = {
    chat: 'chat',
    embeddings: 'embeddings',
    reasoning: 'reasoning',
    vision: 'vision',
    structured: 'structured',
    summarization: 'summarization',
    audio: 'audio',
    image: 'image',
  }
  const capability = capabilityMap[taskType]
  return capability ? getProvidersByCapability(capability) : []
}