/**
 * Together AI Provider Adapter
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class TogetherAIProviderAdapter extends OpenAICompatibleAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'TOGETHER_AI',
      name: 'Together AI',
      type: 'TOGETHER_AI' as AIProviderType,
      defaultChatModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
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
        toolCalling: false,
        maxContextTokens: 131072,
        maxOutputTokens: 4096,
      },
      authMethod: 'bearer',
      supportsModelDiscovery: true,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'TOGETHER_AI_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }
}