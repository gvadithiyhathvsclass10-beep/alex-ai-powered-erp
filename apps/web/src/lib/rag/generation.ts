import { AICredential, AIProviderType as PrismaAIProviderType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
<<<<<<< HEAD
import {
  fetchWithAISafeTimeout,
  classifyProviderHttpError,
  generateText,
  resolveAIConfig,
  type AITaskType,
} from '@/lib/ai/service'
import { SearchResult } from './vector-search'

interface ChatCompletionMessageParam {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Extend the Prisma AIProviderType to include MOCK for local dev/test
export type AIProviderType = PrismaAIProviderType | 'MOCK'
=======
import { SearchResult } from './vector-search'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// Extend the Prisma AIProviderType to include NVIDIA_NEMOTRON and MOCK for local dev
type AIProviderType = PrismaAIProviderType | 'NVIDIA_NEMOTRON' | 'MOCK'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export interface RAGResponse {
  answer: string
  citations: Citation[]
  sources: SearchResult[]
<<<<<<< HEAD
  provider?: string
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
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

<<<<<<< HEAD
export function extractCitationsFromText(answer: string, context: SearchResult[]): Citation[] {
  const citations: Citation[] = []
  const seen = new Set<number>()

  // Match [Source 1], [Source 1, p. 2], [Sources 1, 2], [Source 1; Source 2]
  const bracketRegex = /\[Sources?\s+([^\]]+)\]/gi
  let match: RegExpExecArray | null

  while ((match = bracketRegex.exec(answer)) !== null) {
    const inner = match[1]
    const numMatches = [...inner.matchAll(/\b(\d+)\b/g)]
    for (const nm of numMatches) {
      // Skip numbers preceded by 'p.' or 'page'
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
=======
async function getActiveCredential(userId: string, provider: AIProviderType): Promise<AICredential | null> {
  const prismaProvider = provider === 'NVIDIA_NEMOTRON' ? undefined : provider as PrismaAIProviderType | undefined
  return prisma.aICredential.findFirst({
    where: { userId, provider: prismaProvider, isActive: true, isDefault: true },
  })
}

async function getCredentialKey(credential: AICredential): Promise<string> {
  return decrypt(credential.encryptedKey)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}

export class OpenAIChatProvider {
  private apiKey: string
  private model: string
  private baseUrl: string
<<<<<<< HEAD
  private extraHeaders: Record<string, string>
  private providerLabel: string

  constructor(
    apiKey: string,
    model = 'gpt-4o-mini',
    baseUrl = 'https://api.openai.com/v1',
    extraHeaders: Record<string, string> = {},
    providerLabel = 'OPENAI'
  ) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.extraHeaders = extraHeaders
    this.providerLabel = providerLabel
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
=======

  constructor(apiKey: string, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources. 
- Cite sources using [Source X] format
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

<<<<<<< HEAD
    const response = await fetchWithAISafeTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 2000,
          stream: false,
        }),
      },
      this.providerLabel,
      this.model
    )

    if (!response.ok) {
      await classifyProviderHttpError(response, this.providerLabel, this.model)
    }

    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || ''

    return {
      answer,
      citations: extractCitationsFromText(answer, options.context),
      sources: options.context,
      provider: this.providerLabel,
      model: this.model,
      tokenUsage: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
=======
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: options.stream ?? false,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.choices[0].message.content

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
<<<<<<< HEAD
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
=======
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources.`
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

<<<<<<< HEAD
    const response = await fetchWithAISafeTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 2000,
          stream: true,
        }),
      },
      this.providerLabel,
      this.model
    )

    if (!response.ok) {
      await classifyProviderHttpError(response, this.providerLabel, this.model)
=======
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI chat error: ${error.error?.message || response.statusText}`)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
<<<<<<< HEAD

=======
    
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (!reader) return

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
<<<<<<< HEAD

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

=======
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices[0]?.delta?.content
            if (content) yield content
          } catch {}
        }
      }
    }
  }
<<<<<<< HEAD
=======

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}

export class GoogleChatProvider {
  private apiKey: string
  private model: string
<<<<<<< HEAD
  private baseUrl: string

  constructor(
    apiKey: string,
    model = 'gemini-1.5-flash',
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
  ) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText =
      options.context.length > 0
        ? options.context
            .map(
              (c, i) =>
                `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
            )
            .join('\n\n---\n\n')
        : 'No document sources retrieved.'

    const systemPrompt =
      options.systemPrompt ||
      `You are ALEX, an AI academic assistant. Answer using the provided sources and context. Cite sources using [Source X] format.`

    const response = await fetchWithAISafeTimeout(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
=======

  constructor(apiKey: string, model = 'gemini-1.5-pro') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer using ONLY the provided sources. Cite sources using [Source X] format.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
<<<<<<< HEAD
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nQuestion: ${options.query}\n\nSources:\n${contextText}` }],
            },
=======
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nQuestion: ${options.query}\n\nSources:\n${contextText}` }] },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 2000,
          },
        }),
<<<<<<< HEAD
      },
      'GOOGLE_GEMINI',
      this.model
    )

    if (!response.ok) {
      await classifyProviderHttpError(response, 'GOOGLE_GEMINI', this.model)
    }

    const data = await response.json()
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      answer,
      citations: extractCitationsFromText(answer, options.context),
      sources: options.context,
      provider: 'GOOGLE_GEMINI',
=======
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Google chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.candidates[0].content.parts[0].text

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      model: this.model,
      tokenUsage: {
        prompt: data.usageMetadata?.promptTokenCount || 0,
        completion: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
    }
  }
<<<<<<< HEAD
=======

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}

export class AnthropicChatProvider {
  private apiKey: string
  private model: string
<<<<<<< HEAD
  private baseUrl: string

  constructor(
    apiKey: string,
    model = 'claude-3-5-sonnet-20241022',
    baseUrl = 'https://api.anthropic.com/v1'
  ) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText =
      options.context.length > 0
        ? options.context
            .map(
              (c, i) =>
                `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
            )
            .join('\n\n---\n\n')
        : 'No document sources retrieved.'

    const systemPrompt =
      options.systemPrompt ||
      `You are ALEX, an AI academic assistant. Answer using the provided sources and context. Cite sources using [Source X] format.`

    const response = await fetchWithAISafeTimeout(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` }],
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 2000,
        }),
      },
      'ANTHROPIC',
      this.model
    )

    if (!response.ok) {
      await classifyProviderHttpError(response, 'ANTHROPIC', this.model)
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text || ''

    return {
      answer,
      citations: extractCitationsFromText(answer, options.context),
      sources: options.context,
      provider: 'ANTHROPIC',
      model: this.model,
      tokenUsage: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    }
  }
}

export class NemotronChatProvider extends OpenAIChatProvider {
  constructor(apiKey: string, model = 'nvidia/nemotron-3-ultra', baseUrl?: string) {
    super(
      apiKey,
      model,
      baseUrl || process.env.NVIDIA_NEMOTRON_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      {},
      'NVIDIA_NEMOTRON'
    )
=======

  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer using ONLY the provided sources. Cite sources using [Source X] format.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` }],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Anthropic chat error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const answer = data.content[0].text

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
  }
}

export class NemotronChatProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model = 'nvidia/nemotron-3-ultra') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
    this.model = model
  }

  async generate(options: GenerationOptions): Promise<RAGResponse> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources. 
- Cite sources using [Source X] format
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: false,
    })

    if (!response.choices[0]?.message?.content) {
      throw new Error('Nemotron returned empty response')
    }

    const answer = response.choices[0].message.content

    return {
      answer,
      citations: this.extractCitations(answer, options.context),
      sources: options.context,
      model: this.model,
      tokenUsage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    const systemPrompt = options.systemPrompt || `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources.`

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Question: ${options.query}\n\nSources:\n${contextText}` },
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  private extractCitations(answer: string, context: SearchResult[]): Citation[] {
    const citations: Citation[] = []
    const sourceRegex = /\[Source (\d+)\]/g
    let match
    
    while ((match = sourceRegex.exec(answer)) !== null) {
      const sourceIndex = parseInt(match[1]) - 1
      if (sourceIndex >= 0 && sourceIndex < context.length) {
        const source = context[sourceIndex]
        citations.push({
          id: source.id,
          documentId: source.documentId,
          documentTitle: source.document.title,
          pageNumber: source.pageNumber,
          sectionTitle: source.sectionTitle,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
          relevanceScore: source.similarity,
        })
      }
    }
    
    return citations
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}

export class MockChatProvider {
  async generate(options: GenerationOptions): Promise<RAGResponse> {
<<<<<<< HEAD
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
=======
    const contextText = options.context.map((c, i) => 
      `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}${c.sectionTitle ? `, ${c.sectionTitle}` : ''}):\n${c.content}`
    ).join('\n\n---\n\n')

    // Mock response based on query
    const answer = this.generateMockResponse(options.query, contextText)

    return {
      answer,
      citations: [],
      sources: options.context,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      model: 'mock',
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
    }
  }

  async *generateStream(options: GenerationOptions): AsyncGenerator<string> {
<<<<<<< HEAD
    const contextText = options.context
      .map((c, i) => `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`)
      .join('\n\n---\n\n')
    const answer = this.generateMockResponse(options.query, contextText, options.context.length)

    const words = answer.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  private generateMockResponse(query: string, context: string, sourceCount = 0): string {
    const lowerQuery = query.toLowerCase()

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return "Hello! I'm running in mock mode (no external AI provider key configured). I can help you explore the ALEX platform. Try asking about your documents, assignments, or academic schedule!"
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

export class SharedServiceChatAdapter {
  private userId: string
  private provider?: string
  private model?: string
  private taskType: AITaskType

  constructor(userId: string, provider?: string, model?: string, taskType: AITaskType = 'chat') {
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

    const res = await generateText({
      userId: this.userId,
      provider: this.provider,
      model: this.model,
      taskType: this.taskType,
      systemPrompt,
      prompt: `Question: ${options.query}\n\nSources:\n${contextText}`,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 2000,
    })

    return {
      answer: res.text,
      citations: extractCitationsFromText(res.text, options.context),
      sources: options.context,
      provider: res.provider,
      model: res.model,
      tokenUsage: res.tokenUsage,
    }
=======
    const answer = this.generateMockResponse(options.query, 
      options.context.map((c, i) => 
        `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
      ).join('\n\n---\n\n')
    )
    
    // Simulate streaming
    const words = answer.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

  private generateMockResponse(query: string, context: string): string {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return 'Hello! I\'m running in mock mode (no AI provider configured). I can help you explore the ALEX platform. Try asking about your documents, assignments, or academic schedule!'
    }
    
    if (lowerQuery.includes('mock') || lowerQuery.includes('test')) {
      return 'Mock mode is working! This is a simulated response for local development testing.'
    }
    
    if (context && context.length > 0) {
      return `Based on your documents (mock response): ${context.slice(0, 300)}...\n\nNote: This is a mock response. Configure an AI provider in Settings → AI Settings for real AI responses.`
    }
    
    return `I'm running in mock mode for local development. To get real AI responses, configure an AI provider (NVIDIA Nemotron, OpenAI, Gemini, etc.) in Settings → AI Settings. Your question was: "${query}"`
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}

export function createChatProvider(
  provider: AIProviderType,
  apiKey: string,
<<<<<<< HEAD
  model?: string,
  baseUrl?: string
) {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIChatProvider(
        apiKey,
        model || 'gpt-4o-mini',
        baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        {},
        'OPENAI'
      )
    case 'GROQ':
      return new OpenAIChatProvider(
        apiKey,
        model || 'llama-3.3-70b-versatile',
        baseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        {},
        'GROQ'
      )
    case 'MISTRAL':
      return new OpenAIChatProvider(
        apiKey,
        model || 'mistral-small-latest',
        baseUrl || process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
        {},
        'MISTRAL'
      )
    case 'OPENROUTER':
      return new OpenAIChatProvider(
        apiKey,
        model || 'openrouter/auto',
        baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', 'X-Title': 'ALEX' },
        'OPENROUTER'
      )
    case 'TOGETHER_AI':
      return new OpenAIChatProvider(
        apiKey,
        model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        baseUrl || process.env.TOGETHER_AI_BASE_URL || 'https://api.together.xyz/v1',
        {},
        'TOGETHER_AI'
      )
    case 'GOOGLE_GEMINI':
      return new GoogleChatProvider(
        apiKey,
        model || 'gemini-1.5-flash',
        baseUrl || process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
      )
    case 'ANTHROPIC':
      return new AnthropicChatProvider(
        apiKey,
        model || 'claude-3-5-sonnet-20241022',
        baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'
      )
    case 'NVIDIA_NEMOTRON':
      return new NemotronChatProvider(apiKey, model || 'nvidia/nemotron-3-ultra', baseUrl)
=======
  model?: string
) {
  switch (provider) {
    case 'OPENAI':
      return new OpenAIChatProvider(apiKey, model)
    case 'GROQ':
      return new OpenAIChatProvider(apiKey, model || 'qwen/qwen3.8-27b', 'https://api.groq.com/openai/v1')
    case 'GOOGLE_GEMINI':
      return new GoogleChatProvider(apiKey, model)
    case 'ANTHROPIC':
      return new AnthropicChatProvider(apiKey, model)
    case 'NVIDIA_NEMOTRON':
      return new NemotronChatProvider(apiKey, model)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    case 'MOCK':
      return new MockChatProvider()
    default:
      throw new Error(`Unsupported chat provider: ${provider}`)
  }
}

export async function getUserChatProvider(
  userId: string,
<<<<<<< HEAD
  provider?: AIProviderType,
  model?: string
) {
  const resolved = await resolveAIConfig({
    userId,
    provider,
    model,
    taskType: 'chat',
  })

  if (resolved.provider === 'MOCK') {
    return new MockChatProvider()
  }

  return new SharedServiceChatAdapter(userId, resolved.provider, resolved.model, 'chat')
=======
  provider?: AIProviderType
) {
  // Cast provider to Prisma's AIProviderType for the query, filtering out NVIDIA_NEMOTRON and MOCK
  const prismaProvider = provider === 'NVIDIA_NEMOTRON' || provider === 'MOCK' ? undefined : provider as PrismaAIProviderType | undefined
  
  const cred = await prisma.aICredential.findFirst({
    where: {
      userId,
      provider: prismaProvider,
      isActive: true,
      isDefault: true,
    },
  })

  if (!cred) {
    if (process.env.AI_MODE === 'nemotron' && process.env.NVIDIA_NEMOTRON_API_KEY) {
      return new NemotronChatProvider(process.env.NVIDIA_NEMOTRON_API_KEY, process.env.NVIDIA_NEMOTRON_MODEL || 'nvidia/nemotron-3-ultra')
    }
    // Return an explicitly local mock provider without API keys
    return new MockChatProvider()
  }

  const apiKey = await getCredentialKey(cred)
  const modelConfig = await prisma.aIModelConfig.findFirst({
    where: { userId, provider: cred.provider as PrismaAIProviderType, taskType: 'chat', isDefault: true },
  })

  return createChatProvider(cred.provider as AIProviderType, apiKey, modelConfig?.modelId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}
