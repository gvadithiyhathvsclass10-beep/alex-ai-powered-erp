/**
 * Universal Gateway Provider Adapter
 * 
 * Routes requests through a universal AI gateway endpoint (e.g., OpenRouter,
 * or a custom gateway). The gateway is responsible for routing to upstream
 * providers and models.
 */

import { OpenAICompatibleAdapter, ProviderMetadata, ProviderCapability } from './openai-compatible'
import { AIProviderType } from '@prisma/client'

export class UniversalGatewayProviderAdapter extends OpenAICompatibleAdapter {
  private readonly gatewayType: string

  constructor(apiKey: string, baseUrl?: string, gatewayType = 'custom') {
    const metadata: ProviderMetadata = {
      id: 'UNIVERSAL_GATEWAY',
      name: 'Universal AI Gateway',
      type: 'UNIVERSAL_GATEWAY' as AIProviderType,
      defaultChatModel: 'gpt-4o-mini',
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
      keyEnvVar: 'UNIVERSAL_AI_API_KEY',
    }
    super(metadata, apiKey, baseUrl)
    this.gatewayType = gatewayType
  }

  getGatewayType(): string {
    return this.gatewayType
  }

  async discoverModels(): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '')
    // Try OpenRouter-compatible models endpoint first
    try {
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

      if (response.ok) {
        const data = await response.json()
        return (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          object: m.object,
          ownedBy: m.owned_by,
        }))
      }
    } catch {
      // Fall through to error
    }

    throw new Error(`Model discovery not supported by gateway type: ${this.gatewayType}`)
  }
}