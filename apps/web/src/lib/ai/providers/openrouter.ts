/**
 * OpenRouter Provider Adapter
 * 
 * OpenRouter is OpenAI-compatible but requires additional headers.
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class OpenRouterProviderAdapter extends OpenAICompatibleAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'OPENROUTER',
      name: 'OpenRouter',
      type: 'OPENROUTER' as AIProviderType,
      defaultChatModel: 'openrouter/auto',
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
        maxContextTokens: 131072,
        maxOutputTokens: 4096,
      },
      authMethod: 'bearer',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'OPENROUTER_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  getAuthHeaders(): Record<string, string> {
    return {
      ...super.getAuthHeaders(),
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'ALEX Academic ERP',
    }
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }
}