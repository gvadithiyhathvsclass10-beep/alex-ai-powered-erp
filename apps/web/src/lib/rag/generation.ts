/**
 * RAG Generation - Unified Gateway Architecture
 * 
 * Delegates all LLM generation to the Universal AI Gateway
 * (@/lib/ai/gateway). Maintains backward compatibility with existing
 * RAG interfaces (RAGResponse, Citation, GenerationOptions, etc.).
 */

import { prisma } from '@/lib/prisma'
import {
  gatewayChat,
  gatewayChatStream,
  resolveGatewayConfig,
  getProvidersForTask,
  GatewayConfigError,
  type GatewayChatInput,
  type GatewayStreamChunk,
} from '@/lib/ai/gateway'
import { SearchResult } from './vector-search'

export type AIProviderType = 'MOCK' | 'OPENAI' | 'GOOGLE_GEMINI' | 'ANTHROPIC' | 'NVIDIA_NEMOTRON' | 'MISTRAL' | 'GROQ' | 'OPENROUTER' | 'TOGETHER_AI' | 'OTHER' | 'UNIVERSAL_GATEWAY'

export interface RAGResponse {
  answer: string
  citations: Citation[]
  sources: SearchResult[]
  provider?: string
  model: string
  tokenUsage: { prompt: number; completion: number; total: number }
}

export interface Citation {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  excerpt: string
  relevanceScore: number
}

export interface GenerationOptions {
  query: string
  context: SearchResult[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export function extractCitationsFromText(answer: string, context: SearchResult[]): Citation[] {
  const citations: Citation[] = []
  const seen = new Set<number>()

  const bracketRegex = /\[Sources?\s+([^\]]+)\]/gi
  let match: RegExpExecArray | null

  while ((match = bracketRegex.exec(answer)) !== null) {
    const inner = match[1]
    const numMatches = [...inner.matchAll(/\b(\d+)\b/g)]
    for (const nm of numMatches) {
      const prefix = inner.slice(0, nm.index || 0).toLowerCase()
      if (/(?:p\.|page\s*)$/.test(prefix.trim())) continue

      const sourceIndex = parseInt(nm[1], 10) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length && !seen.has(sourceIndex)) {
        seen.add(sourceIndex)
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber ?? null,
          sectionTitle: source.sectionTitle ?? null,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
          relevanceScore: source.similarity,
        })
      }
    }
  }

  return citations
}

// ============================================================================
// Gateway-based Chat Provider
// ============================================================================

export class GatewayChatProvider {
  private userId: string
  private provider?: string
  private model?: string
  private taskType: string

  constructor(userId: string, provider?: string, model?: string, taskType: string = 'chat') {
    this.userId = userId
    this.provider = provider
    this.model = model
    this.taskType = taskType
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText =
      options.context.length > 0
        ? options.context
            .map(
              (c, i) =>
                `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
            )
            .join('\n\n---\n\n')
        : 'No document sources retrieved.'

    const systemPrompt =
      options.systemPrompt ||
      `You are ALEX, an AI academic assistant. Answer questions using the provided sources and context.
- Cite sources using [Source X] format when referencing documents
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`

    const input: GatewayChatInput = {
      userId: this.userId,
      provider: this.provider,
      model: this.model,
      taskType: this.taskType as any,
      systemPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
      ],
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 2000,
    }

    const response = await gatewayChat(input)

    return {
      answer: response.text,
      citations: extractCitationsFromText(response.text, options.context),
      sources: options.context,
      provider: response.provider,
      model: response.model,
      tokenUsage: {
        prompt: response.tokenUsage.prompt,
        completion: response.tokenUsage.completion,
        total: response.tokenUsage.total,
      },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const contextText =
      options.context.length > 0
        ? options.context
            .map(
              (c, i) =>
                `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
            )
            .join('\n\n---\n\n')
        : 'No document sources retrieved.'

    const systemPrompt =
      options.systemPrompt ||
      `You are ALEX, an AI academic assistant. Answer questions using the provided sources and context.`

    const input: GatewayChatInput = {
      userId: this.userId,
      provider: this.provider,
      model: this.model,
      taskType: this.taskType as any,
      systemPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
      ],
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 2000,
      stream: true,
    }

    for await (const chunk of gatewayChatStream(input)) {
      if (chunk.type === 'token' && chunk.content) {
        yield chunk.content
      }
    }
  }
}

// ============================================================================
// Legacy Provider Classes (backward compatibility)
// ============================================================================

export class OpenAIChatProvider extends GatewayChatProvider {
  constructor(apiKey: string, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1', extraHeaders: Record<string, string> = {}, providerLabel = 'OPENAI') {
    super('', 'OPENAI', model)
    // Legacy constructor - API key handled through gateway credential system
  }
}

export class GoogleChatProvider extends GatewayChatProvider {
  constructor(apiKey: string, model = 'gemini-1.5-flash', baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {
    super('', 'GOOGLE_GEMINI', model)
  }
}

export class AnthropicChatProvider extends GatewayChatProvider {
  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022', baseUrl = 'https://api.anthropic.com/v1') {
    super('', 'ANTHROPIC', model)
  }
}

export class NemotronChatProvider extends GatewayChatProvider {
  constructor(apiKey: string, model = 'nvidia/nemotron-3-ultra', baseUrl?: string) {
    super('', 'NVIDIA_NEMOTRON', model)
  }
}

export class MockChatProvider {
  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context
      .map(
        (c, i) =>
          `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
      )
      .join('\n\n---\n\n')

    const answer = this.generateMockResponse(options.query, contextText, options.context.length)

    return {
      answer,
      citations: extractCitationsFromText(answer, options.context),
      sources: options.context,
      provider: 'MOCK',
      model: 'mock',
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const answer = this.generateMockResponse(options.query, '', options.context.length)
    const words = answer.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  private generateMockResponse(query: string, context: string, sourceCount = 0): string {
    const lowerQuery = query.toLowerCase()

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return "Hello! I'm running in mock mode (no external AI provider key configured)."
    }

    if (lowerQuery.includes('mock') || lowerQuery.includes('test')) {
      return 'Mock mode is working! This is a simulated response for local development testing.'
    }

    if (context && context.length > 0 && sourceCount > 0) {
      return `Based on your documents [Source 1] (mock response): ${context.slice(0, 300)}...\n\nNote: This is a mock response. Configure an AI provider in AI Settings for live LLM responses.`
    }

    return `Not supported by the provided sources: I could not find matching evidence in your uploaded documents for "${query}".`
  }
}

export class SharedServiceChatAdapter extends GatewayChatProvider {
  constructor(userId: string, provider?: string, model?: string, taskType: string = 'chat') {
    super(userId, provider, model, taskType)
  }
}

// ============================================================================
// Provider Factory (backward compatibility)
// ============================================================================

export function createChatProvider(
  provider: AIProviderType,
  apiKey: string,
  model?: string,
  baseUrl?: string
) {
  switch (provider) {
    case 'OPENAI':
      return new GatewayChatProvider('', 'OPENAI', model || 'gpt-4o-mini')
    case 'GROQ':
      return new GatewayChatProvider('', 'GROQ', model || 'llama-3.3-70b-versatile')
    case 'MISTRAL':
      return new GatewayChatProvider('', 'MISTRAL', model || 'mistral-small-latest')
    case 'OPENROUTER':
      return new GatewayChatProvider('', 'OPENROUTER', model || 'openrouter/auto')
    case 'TOGETHER_AI':
      return new GatewayChatProvider('', 'TOGETHER_AI', model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo')
    case 'GOOGLE_GEMINI':
      return new GatewayChatProvider('', 'GOOGLE_GEMINI', model || 'gemini-1.5-flash')
    case 'ANTHROPIC':
      return new GatewayChatProvider('', 'ANTHROPIC', model || 'claude-3-5-sonnet-20241022')
    case 'NVIDIA_NEMOTRON':
      return new GatewayChatProvider('', 'NVIDIA_NEMOTRON', model || 'nvidia/nemotron-3-ultra')
    case 'MOCK':
      return new MockChatProvider()
    case 'UNIVERSAL_GATEWAY':
      return new GatewayChatProvider('', 'UNIVERSAL_GATEWAY', model || 'gpt-4o-mini')
    case 'OTHER':
      return new GatewayChatProvider('', 'OTHER', model || 'default')
    default:
      throw new Error(`Unsupported chat provider: ${provider}`)
  }
}

export async function getUserChatProvider(
  userId: string,
  provider?: AIProviderType,
  model?: string
) {
  // Use gateway to resolve the appropriate provider
  try {
    const config = await resolveGatewayConfig({
      userId,
      provider: provider as string,
      model,
      taskType: 'chat',
      messages: [{ role: 'user', content: '' }],
    } as GatewayChatInput)

    return new GatewayChatProvider(
      userId,
      config.provider as string,
      config.model,
      'chat'
    )
  } catch {
    return new MockChatProvider()
  }
}