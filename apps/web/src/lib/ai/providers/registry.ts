/**
 * Universal AI Gateway - Provider Registry
 * 
 * Maps provider types to their adapter classes and provides
 * a centralized registry for provider discovery and instantiation.
 */

import { AIProviderType } from '@prisma/client'
import { OpenAIProviderAdapter } from './openai'
import { AnthropicProviderAdapter } from './anthropic'
import { GroqProviderAdapter } from './groq'
import { MistralProviderAdapter } from './mistral'
import { TogetherAIProviderAdapter } from './together'
import { NVIDIAProviderAdapter } from './nvidia'
import { GoogleGeminiProviderAdapter } from './gemini'
import { OpenRouterProviderAdapter } from './openrouter'
import { UniversalGatewayProviderAdapter } from './gateway'
import { BaseProviderAdapter } from './base'

// Registry of provider type -> adapter class constructor
const PROVIDER_ADAPTERS: Record<string, new (apiKey: string, baseUrl?: string) => BaseProviderAdapter> = {
  OPENAI: OpenAIProviderAdapter,
  ANTHROPIC: AnthropicProviderAdapter,
  GROQ: GroqProviderAdapter,
  MISTRAL: MistralProviderAdapter,
  TOGETHER_AI: TogetherAIProviderAdapter,
  NVIDIA_NEMOTRON: NVIDIAProviderAdapter,
  GOOGLE_GEMINI: GoogleGeminiProviderAdapter,
  OPENROUTER: OpenRouterProviderAdapter,
  UNIVERSAL_GATEWAY: UniversalGatewayProviderAdapter,
  // OTHER is handled as a custom OpenAI-compatible provider
  OTHER: OpenAIProviderAdapter,
}

export function getProviderAdapterClass(
  providerType: string | AIProviderType
): new (apiKey: string, baseUrl?: string) => BaseProviderAdapter {
  const type = String(providerType).toUpperCase()
  const AdapterClass = PROVIDER_ADAPTERS[type]
  if (!AdapterClass) {
    throw new Error(`No provider adapter registered for: ${type}`)
  }
  return AdapterClass
}

export function getRegisteredProviders(): string[] {
  return Object.keys(PROVIDER_ADAPTERS)
}

export function isProviderRegistered(providerType: string): boolean {
  return String(providerType).toUpperCase() in PROVIDER_ADAPTERS
}

// Provider metadata registry (static info, without API keys)
const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  OPENAI: {
    id: 'OPENAI',
    name: 'OpenAI',
    type: 'OPENAI' as AIProviderType,
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    capabilities: {
      chat: true, embeddings: true, reasoning: true, vision: true,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 128000, maxOutputTokens: 16384,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'OPENAI_API_KEY',
  },
  ANTHROPIC: {
    id: 'ANTHROPIC',
    name: 'Anthropic',
    type: 'ANTHROPIC' as AIProviderType,
    defaultChatModel: 'claude-3-5-sonnet-20241022',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: true,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 200000, maxOutputTokens: 4096,
    },
    authMethod: 'x-api-key',
    supportsModelDiscovery: false,
    supportsStreaming: true,
    keyEnvVar: 'ANTHROPIC_API_KEY',
  },
  GROQ: {
    id: 'GROQ',
    name: 'Groq',
    type: 'GROQ' as AIProviderType,
    defaultChatModel: 'llama-3.3-70b-versatile',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: false,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 131072, maxOutputTokens: 8192,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'GROQ_API_KEY',
  },
  MISTRAL: {
    id: 'MISTRAL',
    name: 'Mistral AI',
    type: 'MISTRAL' as AIProviderType,
    defaultChatModel: 'mistral-small-latest',
    defaultEmbeddingModel: 'mistral-embed',
    capabilities: {
      chat: true, embeddings: true, reasoning: true, vision: false,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 32768, maxOutputTokens: 8192,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'MISTRAL_API_KEY',
  },
  TOGETHER_AI: {
    id: 'TOGETHER_AI',
    name: 'Together AI',
    type: 'TOGETHER_AI' as AIProviderType,
    defaultChatModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: false,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: false, maxContextTokens: 131072, maxOutputTokens: 4096,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'TOGETHER_AI_API_KEY',
  },
  NVIDIA_NEMOTRON: {
    id: 'NVIDIA_NEMOTRON',
    name: 'NVIDIA NIM',
    type: 'NVIDIA_NEMOTRON' as AIProviderType,
    defaultChatModel: 'nvidia/nemotron-3-ultra',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: false,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: false, maxContextTokens: 131072, maxOutputTokens: 4096,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: false,
    supportsStreaming: true,
    keyEnvVar: 'NVIDIA_NEMOTRON_API_KEY',
  },
  GOOGLE_GEMINI: {
    id: 'GOOGLE_GEMINI',
    name: 'Google Gemini',
    type: 'GOOGLE_GEMINI' as AIProviderType,
    defaultChatModel: 'gemini-1.5-flash',
    defaultEmbeddingModel: 'text-embedding-004',
    capabilities: {
      chat: true, embeddings: true, reasoning: true, vision: true,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 1048576, maxOutputTokens: 8192,
    },
    authMethod: 'query-param',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'GOOGLE_GEMINI_API_KEY',
  },
  OPENROUTER: {
    id: 'OPENROUTER',
    name: 'OpenRouter',
    type: 'OPENROUTER' as AIProviderType,
    defaultChatModel: 'openrouter/auto',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: true,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 131072, maxOutputTokens: 4096,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'OPENROUTER_API_KEY',
  },
  UNIVERSAL_GATEWAY: {
    id: 'UNIVERSAL_GATEWAY',
    name: 'Universal AI Gateway',
    type: 'UNIVERSAL_GATEWAY' as AIProviderType,
    defaultChatModel: 'gpt-4o-mini',
    capabilities: {
      chat: true, embeddings: false, reasoning: true, vision: true,
      structured: true, summarization: true, audio: false, image: false,
      streaming: true, toolCalling: true, maxContextTokens: 131072, maxOutputTokens: 4096,
    },
    authMethod: 'bearer',
    supportsModelDiscovery: true,
    supportsStreaming: true,
    keyEnvVar: 'UNIVERSAL_AI_API_KEY',
  },
}

export function getProviderMetadata(providerType: string): ProviderMetadata | null {
  const type = String(providerType).toUpperCase()
  return PROVIDER_METADATA[type] || null
}

export function getAllProviderMetadata(): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA)
}

export function getProvidersByCapability(capability: keyof ProviderCapability): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA).filter(m => m.capabilities[capability])
}

export interface ProviderCapability {
  chat: boolean
  embeddings: boolean
  reasoning: boolean
  vision: boolean
  structured: boolean
  summarization: boolean
  audio: boolean
  image: boolean
  streaming: boolean
  toolCalling: boolean
  maxContextTokens?: number
  maxOutputTokens?: number
}

export interface ProviderMetadata {
  id: string
  name: string
  type: AIProviderType | 'UNIVERSAL_GATEWAY'
  defaultChatModel: string
  defaultEmbeddingModel?: string
  capabilities: ProviderCapability
  authMethod: 'bearer' | 'x-api-key' | 'query-param' | 'custom'
  supportsModelDiscovery: boolean
  supportsStreaming: boolean
  baseUrl?: string
  keyEnvVar?: string
}