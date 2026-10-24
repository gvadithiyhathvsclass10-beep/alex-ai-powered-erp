/**
 * Google Gemini Provider Adapter
 * 
 * Implements the Google Gemini API (generateContent, batchEmbedContents, models listing).
 */

import { BaseProviderAdapter, GatewayRequest, GatewayResponse, GatewayStreamChunk, ProviderCapability, ProviderMetadata, GatewayError } from './base'
import { AIProviderType } from '@prisma/client'

export class GoogleGeminiProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'GOOGLE_GEMINI',
      name: 'Google Gemini',
      type: 'GOOGLE_GEMINI' as AIProviderType,
      defaultChatModel: 'gemini-1.5-flash',
      defaultEmbeddingModel: 'text-embedding-004',
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
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
      },
      authMethod: 'query-param',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'GOOGLE_GEMINI_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async chat(request: GatewayRequest): Promise<GatewayResponse> {
    const start = Date.now()
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/models/${request.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`

    const parts: Array<{ text: string }> = []
    if (request.systemPrompt) {
      parts.push({ text: request.systemPrompt })
    }
    parts.push({ text: request.prompt || '' })

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: request.temperature ?? 0.3,
            maxOutputTokens: request.maxTokens ?? 2048,
          },
        }),
      },
      this.metadata.id,
      request.model
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, request.model)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      text,
      provider: this.metadata.id,
      model: request.model,
      taskType: request.taskType,
      tokenUsage: {
        prompt: data.usageMetadata?.promptTokenCount ?? 0,
        completion: data.usageMetadata?.candidatesTokenCount ?? 0,
        total: data.usageMetadata?.totalTokenCount ?? 0,
      },
      latencyMs: Date.now() - start,
      finishReason: data.candidates?.[0]?.finishReason,
      rawResponse: data,
    }
  }

  async *chatStream(request: GatewayRequest): AsyncGenerator<GatewayStreamChunk> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/models/${request.model}:streamGenerateContent?key=${encodeURIComponent(this.apiKey)}`

    const parts: Array<{ text: string }> = []
    if (request.systemPrompt) {
      parts.push({ text: request.systemPrompt })
    }
    parts.push({ text: request.prompt || '' })

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: request.temperature ?? 0.3,
            maxOutputTokens: request.maxTokens ?? 2048,
          },
        }),
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
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (content) {
                yield { type: 'token', content }
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
      return { embeddings: [], tokenCount: 0, model: this.metadata.defaultEmbeddingModel || 'text-embedding-004' }
    }

    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const response = await this.fetchWithTimeout(
      `${baseUrl}/models/${this.metadata.defaultEmbeddingModel || 'text-embedding-004'}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${this.metadata.defaultEmbeddingModel || 'text-embedding-004'}`,
            content: { parts: [{ text }] },
          })),
        }),
      },
      this.metadata.id,
      this.metadata.defaultEmbeddingModel || 'text-embedding-004'
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, this.metadata.defaultEmbeddingModel || 'text-embedding-004')
    }

    const data = await response.json()
    return {
      embeddings: data.embeddings?.map((e: { values: number[] }) => e.values) || [],
      tokenCount: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      model: this.metadata.defaultEmbeddingModel || 'text-embedding-004',
    }
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const response = await this.fetchWithTimeout(
      `${baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      this.metadata.id,
      'models'
    )

    if (!response.ok) {
      throw new GatewayError(
        `Google Gemini model discovery failed: ${response.statusText}`,
        response.status,
        'DISCOVERY_FAILED',
        this.metadata.id
      )
    }

    const data = await response.json()
    return (data.models || []).map((m: any) => ({
      id: m.name?.replace('models/', '') || m.id,
      name: m.displayName || m.name?.replace('models/', '') || m.id,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
    }))
  }
}