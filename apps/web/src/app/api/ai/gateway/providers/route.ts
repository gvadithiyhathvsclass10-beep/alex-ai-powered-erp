/**
 * Universal AI Gateway - Provider Registry
 * 
 * Returns metadata for all registered AI providers including
 * capabilities, supported models, and configuration requirements.
 */

import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getAllProviders, getProvidersForTask } from '@/lib/ai/gateway'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const taskType = searchParams.get('taskType')

    let providers = getAllProviders()

    if (taskType) {
      providers = getProvidersForTask(taskType as any)
    }

    // Return provider metadata without sensitive info
    const safeProviders = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      defaultChatModel: p.defaultChatModel,
      defaultEmbeddingModel: p.defaultEmbeddingModel,
      capabilities: p.capabilities,
      authMethod: p.authMethod,
      supportsModelDiscovery: p.supportsModelDiscovery,
      supportsStreaming: p.supportsStreaming,
      keyEnvVar: p.keyEnvVar,
    }))

    return NextResponse.json({ providers: safeProviders })
  } catch (error) {
    console.error('[Gateway Providers] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
  }
}