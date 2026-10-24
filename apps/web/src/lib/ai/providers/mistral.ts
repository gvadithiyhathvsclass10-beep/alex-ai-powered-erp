/**
 * Mistral Provider Adapter
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class MistralProviderAdapter extends OpenAICompatibleAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'MISTRAL',
      name: 'Mistral AI',
      type: 'MISTRAL' as AIProviderType,
      defaultChatModel: 'mistral-small-latest',
      defaultEmbeddingModel: 'mistral-embed',
      capabilities: {
        chat: true,
        embeddings: true,
        reasoning: true,
        vision: false,
        structured: true,
        summarization: true,
        audio: false,
        image: false,
        streaming: true,
        toolCalling: true,
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
      },
      authMethod: 'bearer',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'MISTRAL_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
    this.embeddingsEndpoint = '/embeddings'
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }
}