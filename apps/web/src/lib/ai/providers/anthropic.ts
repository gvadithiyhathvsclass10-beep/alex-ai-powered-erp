/**
 * Anthropic Provider Adapter
 * 
 * Implements the Anthropic Messages API.
 */

import { BaseProviderAdapter, GatewayRequest, GatewayResponse, GatewayStreamChunk, ProviderCapability, ProviderMetadata, GatewayError } from './base'
import { AIProviderType } from '@prisma/client'

export class AnthropicProviderAdapter extends BaseProviderAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'ANTHROPIC',
      name: 'Anthropic',
      type: 'ANTHROPIC' as AIProviderType,
      defaultChatModel: 'claude-3-5-sonnet-20241022',
      capabilities: {
        chat: true,
        embeddings: false,
        reasoning: true,
        vision: true,
        structured: true,
        summarization: true,
        audio: false,
        image: false,
        streaming: true,
        toolCalling: true,
        maxContextTokens: 200000,
        maxOutputTokens: 4096,
      },
      authMethod: 'x-api-key',
      supportsModelDiscovery: false,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'ANTHROPIC_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async chat(request: GatewayRequest): Promise<GatewayResponse> {
    const start = Date.now()
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/messages`

    const anthropicMessages = (request.messages || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    anthropicMessages.push({ role: 'user' as const, content: request.prompt || '' })

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          system: request.systemPrompt,
          messages: anthropicMessages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 2048,
        }),
      },
      this.metadata.id,
      request.model
    )

    if (!response.ok) {
      await this.classifyHttpError(response, this.metadata.id, request.model)
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    return {
      text,
      provider: this.metadata.id,
      model: request.model,
      taskType: request.taskType,
      tokenUsage: {
        prompt: data.usage?.input_tokens ?? 0,
        completion: data.usage?.output_tokens ?? 0,
        total: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      latencyMs: Date.now() - start,
      finishReason: data.stop_reason,
      rawResponse: data,
    }
  }

  async *chatStream(request: GatewayRequest): AsyncGenerator<GatewayStreamChunk> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    const url = `${baseUrl}/messages`

    const anthropicMessages = (request.messages || [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    anthropicMessages.push({ role: 'user' as const, content: request.prompt || '' })

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          system: request.systemPrompt,
          messages: anthropicMessages,
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 2048,
          stream: true,
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
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { type: 'token', content: parsed.delta.text }
              }
              if (parsed.type === 'message_stop') {
                yield { type: 'done' }
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

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }

  async embeddings(_texts: string[]): Promise<{ embeddings: number[][]; tokenCount: number; model: string }> {
    throw new Error('Anthropic does not support embeddings')
  }
}