/**
 * AI Service - Unified Gateway Architecture
 * 
 * This file maintains backward compatibility with the existing AI service
 * while delegating all operations to the new Universal AI Gateway
 * architecture (@/lib/ai/gateway).
 * 
 * Legacy types and interfaces are preserved for existing imports.
 * New code should import directly from '@/lib/ai/gateway'.
 */

import { AICredential, AIProviderType as PrismaAIProviderType, AIModelConfig as PrismaAIModelConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  gatewayChat,
  gatewayChatStream,
  gatewayEmbeddings,
  gatewayStructuredOutput,
  testGatewayConnection,
  saveGatewayCredential,
  getUserCredentials,
  deleteGatewayCredential,
  resolveGatewayConfig,
  discoverGatewayModels,
  getAllProviders,
  getProvidersForTask,
  getProviderMetadata,
  type GatewayChatInput,
  type GatewayEmbeddingsInput,
  type GatewayStructuredOutputInput,
  type GatewayTestResult,
  GatewayConfigError,
  GatewayAuthError,
  GatewayRateLimitError,
  GatewayModelNotSupportedError,
  GatewayTimeoutError,
  GatewayNetworkError,
  GatewayError,
} from './gateway'
import type { TokenUsage, ChatMessage } from './providers/base'
import type { GatewayProviderType, ResolvedGatewayConfig, StoredCredential } from './gateway'

// ============================================================================
// Legacy Type Aliases (backward compatibility)
// ============================================================================
export type AIProviderType = PrismaAIProviderType | 'MOCK'

export interface ResolvedAIConfig {
  provider: PrismaAIProviderType | 'MOCK'
  model: string
  apiKey: string
  baseUrl: string
  credential: AICredential | null
}

export interface TextGenerationInput {
  userId?: string
  prompt: string
  systemPrompt?: string
  messages?: ChatMessage[]
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  taskType?: AITaskType
  jsonMode?: boolean
  timeoutMs?: number
}

export interface TextGenerationOutput {
  text: string
  provider: string
  model: string
  tokenUsage: TokenUsage
  latencyMs: number
}

export interface StructuredOutputInput<T = any> {
  userId?: string
  prompt: string
  systemPrompt: string
  schemaDescription: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  validate?: (parsed: any) => T
}

export interface TestConnectionInput {
  userId?: string
  provider?: string
  apiKey?: string
  credentialId?: string
  model?: string
  query?: string
  baseUrl?: string
}

export interface TestConnectionOutput {
  success: boolean
  provider: string
  model: string
  response: string
  latencyMs: number
  tokenUsage: TokenUsage
}

// ============================================================================
// Legacy Provider Metadata (backward compatibility)
// ============================================================================

// Legacy SUPPORTED_AI_PROVIDERS registry - kept for backward compatibility
// New code should use getAllProviders() from gateway.ts
export const SUPPORTED_AI_PROVIDERS: Record<string, any> = {}

// ============================================================================
// Backward-Compatible Function Wrappers
// ============================================================================

/**
 * Resolve AI configuration (legacy interface).
 * Delegates to gateway.resolveGatewayConfig.
 */
export async function resolveAIConfig(options: {
  userId?: string
  provider?: string
  model?: string
  credentialId?: string
  apiKey?: string
  baseUrl?: string
  taskType?: AITaskType
}): Promise<ResolvedAIConfig> {
  const config = await resolveGatewayConfig({
    userId: options.userId,
    provider: options.provider,
    model: options.model,
    credentialId: options.credentialId,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    messages: [{ role: 'user', content: '' }],
    taskType: options.taskType || 'chat',
  } as GatewayChatInput)

  return {
    provider: config.provider as PrismaAIProviderType | 'MOCK',
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    credential: config.credential,
  }
}

/**
 * Generate text (legacy interface).
 * Delegates to gateway.gatewayChat.
 */
export async function generateText(input: TextGenerationInput): Promise<TextGenerationOutput> {
  const config = await resolveGatewayConfig({
    userId: input.userId,
    provider: input.provider,
    model: input.model,
    credentialId: input.credentialId,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    messages: input.messages || [{ role: 'user', content: input.prompt }],
    systemPrompt: input.systemPrompt,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    jsonMode: input.jsonMode,
    taskType: input.taskType || 'chat',
    timeoutMs: input.timeoutMs,
  } as GatewayChatInput)

  // For single-prompt inputs, append the prompt as a user message
  const requestInput: GatewayChatInput = {
    ...input,
    provider: config.provider as string,
    model: config.model,
    systemPrompt: input.systemPrompt,
    messages: input.messages || [{ role: 'user', content: input.prompt }],
    jsonMode: input.jsonMode,
    taskType: input.taskType || 'chat',
  }

  const response = await gatewayChat(requestInput)

  return {
    text: response.text,
    provider: response.provider,
    model: response.model,
    tokenUsage: response.tokenUsage,
    latencyMs: response.latencyMs,
  }
}

/**
 * Generate structured JSON output (legacy interface).
 * Delegates to gateway.gatewayStructuredOutput.
 */
export async function generateStructuredOutput<T = any>(
  input: StructuredOutputInput<T>
): Promise<{
  data: T
  rawText: string
  provider: string
  model: string
  tokenUsage: TokenUsage
  latencyMs: number
}> {
  const result = await gatewayStructuredOutput<T>({
    userId: input.userId,
    provider: input.provider,
    model: input.model,
    credentialId: input.credentialId,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    prompt: input.prompt,
    systemPrompt: input.systemPrompt,
    schemaDescription: input.schemaDescription,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    taskType: 'structured',
    validate: input.validate,
  })

  return {
    data: result.data,
    rawText: result.rawText,
    provider: result.provider,
    model: result.model,
    tokenUsage: result.tokenUsage,
    latencyMs: result.latencyMs,
  }
}

/**
 * Test provider connection (legacy interface).
 * Delegates to gateway.testGatewayConnection.
 */
export async function testProviderConnection(
  input: TestConnectionInput
): Promise<TestConnectionOutput> {
  const result = await testGatewayConnection({
    userId: input.userId,
    provider: input.provider,
    apiKey: input.apiKey,
    credentialId: input.credentialId,
    model: input.model,
    baseUrl: input.baseUrl,
  })

  return {
    success: result.success,
    provider: result.provider,
    model: result.model,
    response: result.response,
    latencyMs: result.latencyMs,
    tokenUsage: result.tokenUsage,
  }
}

/**
 * Format AI service error response (legacy interface).
 */
export function formatAIServiceErrorResponse(
  error: unknown,
  fallbackMessage = 'AI request failed'
): {
  status: number
  body: { error: string; code: string; provider?: string; model?: string; success: false }
} {
  if (error instanceof GatewayError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        provider: error.provider,
        model: error.model,
        success: false,
      },
    }
  }

  const message = error instanceof Error ? error.message : fallbackMessage
  return {
    status: 500,
    body: {
      error: message || fallbackMessage,
      code: 'INTERNAL_AI_ERROR',
      success: false,
    },
  }
}

/**
 * Save user AI credential (legacy interface).
 * Delegates to gateway.saveGatewayCredential.
 */
export async function saveUserAICredential(input: {
  userId: string
  provider: string
  providerName?: string
  apiKey: string
  models?: string[]
  isDefault?: boolean
  usageLimit?: number | null
}) {
  return saveGatewayCredential({
    userId: input.userId,
    provider: input.provider,
    providerName: input.providerName,
    apiKey: input.apiKey,
    models: input.models,
    isDefault: input.isDefault,
    usageLimit: input.usageLimit,
  })
}

/**
 * Extract JSON from model output (legacy utility).
 */
export function extractJsonFromModelOutput(rawText: string): any {
  const trimmed = rawText.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const objStart = candidate.indexOf('{')
    const objEnd = candidate.lastIndexOf('}')
    const arrStart = candidate.indexOf('[')
    const arrEnd = candidate.lastIndexOf(']')

    if (objStart !== -1 && objEnd > objStart && (arrStart === -1 || objStart < arrStart)) {
      return JSON.parse(candidate.slice(objStart, objEnd + 1))
    }
    if (arrStart !== -1 && arrEnd > arrStart) {
      return JSON.parse(candidate.slice(arrStart, arrEnd + 1))
    }
    throw new Error('Response did not contain valid JSON')
  }
}

// ============================================================================
// Re-exports from gateway (new code should use these directly)
// ============================================================================

export {
  GatewayConfigError,
  GatewayAuthError,
  GatewayRateLimitError,
  GatewayModelNotSupportedError,
  GatewayTimeoutError,
  GatewayNetworkError,
  GatewayError,
  saveGatewayCredential,
  getUserCredentials,
  deleteGatewayCredential,
  resolveGatewayConfig,
  discoverGatewayModels,
  getAllProviders,
  getProvidersForTask,
  getProviderMetadata,
  type GatewayProviderType,
  type ResolvedGatewayConfig,
  type StoredCredential,
  type GatewayChatInput,
  type GatewayEmbeddingsInput,
  type GatewayStructuredOutputInput,
  type GatewayTestResult,
} from './gateway'

export type AITaskType = 'chat' | 'embeddings' | 'reasoning' | 'vision' | 'structured' | 'summarization'

// ============================================================================
// Mock test response builder (legacy, only used in test mode)
// ============================================================================

export function buildDeterministicTestResponse(
  prompt: string,
  systemPrompt?: string,
  jsonMode?: boolean
): string {
  const lower = prompt.toLowerCase()
  if (jsonMode || (systemPrompt && /MUST respond with valid JSON/i.test(systemPrompt || ''))) {
    if (/flashcard/i.test(systemPrompt || '') || /"front"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        cards: [
          { front: 'What is the time complexity of Dijkstra algorithm with a min-priority queue?', back: 'O((V + E) log V) [Source 1]' },
          { front: 'What data structure is used to select the next vertex in Dijkstra algorithm?', back: 'A min-priority queue (binary heap or Fibonacci heap) [Source 1]' },
        ],
      })
    }
    if (/quiz/i.test(systemPrompt || '') || /"options"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        questions: [
          {
            id: 'q-1',
            prompt: 'What is the time complexity of Dijkstra algorithm using a min-priority queue?',
            options: ['O((V + E) log V)', 'O(V^3)', 'O(E)', 'O(log V)'],
            answer: 0,
            explanation: 'Using a binary heap priority queue [Source 1].',
          },
        ],
      })
    }
    if (/mind\s*map/i.test(systemPrompt || '') || /"nodes"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        nodes: [
          { id: 'node-0', label: 'Shortest Path Algorithms', position: { x: 0, y: 0 } },
          { id: 'node-1', label: 'Dijkstra O((V+E) log V)', position: { x: 260, y: 0 } },
        ],
        edges: [{ id: 'edge-0', source: 'node-0', target: 'node-1' }],
      })
    }
    if (/diagram/i.test(systemPrompt || '') || /"code"/i.test(systemPrompt || '')) {
      return JSON.stringify({
        type: 'mermaid',
        title: 'Algorithm Flowchart',
        code: 'flowchart TD\n  A[Initialize Priority Queue] --> B[Extract Min Vertex]\n  B --> C[Relax Outgoing Edges]',
      })
    }
    return JSON.stringify({
      questionNumber: '1',
      originalQuestion: prompt.slice(0, 120),
      topic: 'Algorithms & Data Structures',
      explanation: 'Based on the provided lecture notes [Source 1].',
      definitions: ['Shortest Path: Minimum weight path between two vertices [Source 1].'],
      formulas: ['T(V, E) = O((V + E) log V)'],
    })
  }
  if (lower.includes('hello') || lower.includes('hi')) {
    return "Hello! I'm your ALEX AI academic assistant."
  }
  return `Based on your academic context: ${prompt.slice(0, 240)}`
}

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

export type DocumentSummaryType =
  | 'concise'
  | 'detailed'
  | 'exam'
  | 'formulas'
  | 'definitions'
  | 'comparison'

export function normalizeProvider(input: string): string {
  const upper = input.trim().toUpperCase()
  const valid = ['OPENAI', 'GOOGLE_GEMINI', 'ANTHROPIC', 'NVIDIA_NEMOTRON', 'MISTRAL', 'GROQ', 'OPENROUTER', 'TOGETHER_AI', 'OTHER', 'UNIVERSAL_GATEWAY']
  if (valid.includes(upper)) return upper
  throw new GatewayConfigError(`Unsupported AI provider: ${input}`, upper as any)
}

export function validateProviderModel(
  provider: string,
  model?: string,
  taskType?: string,
  customAllowedModels?: string[],
  allowCustomModels?: boolean
): string {
  if (!model || !model.trim()) {
    return model || 'gpt-4o-mini'
  }
  return model.trim()
}

export async function summarizeAndAnalyzeDocument(
  input: {
    userId?: string
    documentTitle: string
    chunks: Array<{ content: string; pageNumber?: number | null; sectionTitle?: string | null }>
    analysisType: DocumentSummaryType
    customInstructions?: string
    provider?: string
    model?: string
  }
): Promise<{
  title: string
  content: string
  type: DocumentSummaryType
  provider: string
  model: string
  tokenUsage: TokenUsage
}> {
  const formattedChunks = input.chunks
    .slice(0, 40)
    .map(
      (c, idx) =>
        `[Source ${idx + 1}] (${input.documentTitle}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content.trim()}`
    )
    .join('\n\n---\n\n')

  const gen = await gatewayChat({
    userId: input.userId,
    provider: input.provider,
    model: input.model,
    taskType: 'summarization',
    messages: [{ role: 'user', content: `Document Title: ${input.documentTitle}\nAnalysis Type: ${input.analysisType}\nDocument Sources:\n${formattedChunks}` }],
    systemPrompt: `You are ALEX, an academic document analysis assistant. Analyze the provided document sources and generate ${input.analysisType} study material.`,
    temperature: 0.25,
    maxTokens: 3000,
  } as GatewayChatInput)

  return {
    title: `${input.documentTitle} — ${input.analysisType} notes`,
    content: gen.text,
    type: input.analysisType,
    provider: gen.provider,
    model: gen.model,
    tokenUsage: gen.tokenUsage,
  }
}