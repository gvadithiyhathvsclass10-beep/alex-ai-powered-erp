/**
 * Groq Provider Adapter
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class GroqProviderAdapter extends OpenAICompatibleAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'GROQ',
      name: 'Groq',
      type: 'GROQ' as AIProviderType,
      defaultChatModel: 'llama-3.3-70b-versatile',
      capabilities: {
        chat: true,
        embeddings: false,
        reasoning: true,
        vision: false,
        structured: true,
        summarization: true,
        audio: false,
        image: false,
        streaming: true,
        toolCalling: true,
        maxContextTokens: 131072,
        maxOutputTokens: 8192,
      },
      authMethod: 'bearer',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'GROQ_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }
}