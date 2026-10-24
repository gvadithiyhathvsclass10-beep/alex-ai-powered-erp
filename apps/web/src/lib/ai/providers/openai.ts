/**
 * OpenAI Provider Adapter
 * 
 * Implements the OpenAI Chat Completions API and Embeddings API.
 */

import { BaseProviderAdapter, GatewayRequest, GatewayResponse, GatewayStreamChunk, ProviderCapability, ProviderMetadata, GatewayError } from './base'
import { AIProviderType } from '@prisma/client'

export class OpenAIProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'OPENAI',
      name: 'OpenAI',
      type: 'OPENAI' as AIProviderType,
      defaultChatModel: 'gpt-4o-mini',
      defaultEmbeddingModel: 'text-embedding-3-small',
      capabilities: {
        chat: true,
        embeddings: true,
        reasoning: true,
        vision: true,
        structured: true,
        summarization: true,
        audio: false,
        image: false,
        streaming: true,
        toolCalling: true,
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
      },
      authMethod: 'bearer',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'OPENAI_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async chat(request: GatewayRequest): Promise<GatewayResponse> {
    const start = Date.now()
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/chat/completions`

    const messages = request.messages || []
    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt || '' })

    const payload: Record<string, unknown> = {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2048,
      stream: false,
    }

    if (request.jsonMode) {
      payload.response_format = { type: 'json_object' }
    }

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      this.metadata.id,
      request.model
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, request.model)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part: any) => typeof part === 'string' ? part : part?.text || '').join('')
        : ''

    return {
      text,
      provider: this.metadata.id,
      model: request.model,
      taskType: request.taskType,
      tokenUsage: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      finishReason: data.choices?.[0]?.finish_reason,
      rawResponse: data,
    }
  }

  async *chatStream(request: GatewayRequest): AsyncGenerator<GatewayStreamChunk> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/chat/completions`

    const messages = request.messages || []
    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt || '' })

    const payload: Record<string, unknown> = {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2048,
      stream: true,
    }

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      this.metadata.id,
      request.model
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, request.model)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              yield { type: 'done' }
              return
            }
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                yield { type: 'token', content }
              }
              if (parsed.choices?.[0]?.finish_reason) {
                yield { type: 'done', finishReason: parsed.choices[0].finish_reason }
                return
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async embeddings(texts: string[]): Promise<{ embeddings: number[][]; tokenCount: number; model: string }> {
    if (texts.length === 0) {
      return { embeddings: [], tokenCount: 0, model: this.metadata.defaultEmbeddingModel || 'text-embedding-3-small' }
    }

    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const response = await this.fetchWithTimeout(
      `${baseUrl}/embeddings`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          model: this.metadata.defaultEmbeddingModel || 'text-embedding-3-small',
          encoding_format: 'float',
        }),
      },
      this.metadata.id,
      this.metadata.defaultEmbeddingModel || 'text-embedding-3-small'
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, this.metadata.defaultEmbeddingModel || 'text-embedding-3-small')
    }

    const data = await response.json()
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      tokenCount: data.usage?.total_tokens ?? texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.metadata.defaultEmbeddingModel || 'text-embedding-3-small',
    }
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const response = await this.fetchWithTimeout(
      `${baseUrl}/models`,
      {
        method: 'GET',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      },
      this.metadata.id,
      'models'
    )

    if (!response.ok) {
      throw new GatewayError(
        `OpenAI model discovery failed: ${response.statusText}`,
        response.status,
        'DISCOVERY_FAILED',
        this.metadata.id
      )
    }

    const data = await response.json()
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id,
      object: m.object,
      ownedBy: m.owned_by,
      created: m.created,
    }))
  }
}