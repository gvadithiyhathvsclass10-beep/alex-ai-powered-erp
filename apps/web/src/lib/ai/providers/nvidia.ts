/**
 * NVIDIA NIM Provider Adapter
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class NVIDIAProviderAdapter extends OpenAICompatibleAdapter {
  constructor(apiKey: string, baseUrl?: string) {
    const metadata: ProviderMetadata = {
      id: 'NVIDIA_NEMOTRON',
      name: 'NVIDIA NIM',
      type: 'NVIDIA_NEMOTRON' as AIProviderType,
      defaultChatModel: 'nvidia/nemotron-3-ultra',
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
      supportsModelDiscovery: false,
      supportsStreaming: true,
      baseUrl,
      keyEnvVar: 'NVIDIA_NEMOTRON_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    return [{ id: this.metadata.defaultChatModel, name: this.metadata.defaultChatModel }]
  }
}