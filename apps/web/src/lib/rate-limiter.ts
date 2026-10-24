import { headers } from 'next/headers'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  total: number
}

interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>
  set(key: string, value: { count: number; resetTime: number }): Promise<void>
  delete(key: string): Promise<void>
}

class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  async get(key: string) {
    const record = this.store.get(key)
    if (!record) return null
    if (record.resetTime < Date.now()) {
      this.store.delete(key)
      return null
    }
    return record
  }

  async set(key: string, value: { count: number; resetTime: number }) {
    this.store.set(key, value)
  }

  async delete(key: string) {
    this.store.delete(key)
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private client: any
  private connected = false

  constructor(redisUrl: string) {
    this.initClient(redisUrl)
  }

  private async initClient(redisUrl: string) {
    try {
      const { createClient } = await import('redis')
      this.client = createClient({ url: redisUrl })
      this.client.on('error', (err: Error) => console.error('[RateLimit] Redis error:', err))
      await this.client.connect()
      this.connected = true
      console.log('[RateLimit] Connected to Redis')
    } catch (error) {
      console.warn('[RateLimit] Redis not available, falling back to memory store:', error)
      this.connected = false
    }
  }

  async get(key: string) {
    if (!this.connected || !this.client) return null
    try {
      const data = await this.client.get(key)
      if (!data) return null
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async set(key: string, value: { count: number; resetTime: number }) {
    if (!this.connected || !this.client) return
    try {
      const ttl = Math.max(1, Math.ceil((value.resetTime - Date.now()) / 1000))
      await this.client.setEx(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('[RateLimit] Redis set error:', error)
    }
  }

  async delete(key: string) {
    if (!this.connected || !this.client) return
    try {
      await this.client.del(key)
    } catch (error) {
      console.error('[RateLimit] Redis del error:', error)
    }
  }
}

function createStore(): RateLimitStore {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  if (redisUrl) {
    return new RedisRateLimitStore(redisUrl)
  }
  console.log('[RateLimit] Using in-memory store (not suitable for horizontal scaling)')
  return new MemoryRateLimitStore()
}

const store = createStore()

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config

  return async function rateLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${keyPrefix}:${identifier}`
    const now = Date.now()

    const record = await store.get(key)
    
    if (!record || record.resetTime < now) {
      const newRecord = { count: 1, resetTime: now + windowMs }
      await store.set(key, newRecord)
      return { success: true, remaining: maxRequests - 1, resetTime: now + windowMs, total: maxRequests }
    }

    if (record.count >= maxRequests) {
      return { success: false, remaining: 0, resetTime: record.resetTime, total: maxRequests }
    }

    record.count++
    await store.set(key, record)
    return { success: true, remaining: maxRequests - record.count, resetTime: record.resetTime, total: maxRequests }
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  let ip = 'unknown'
  if (cfConnectingIp) {
    ip = cfConnectingIp
  } else if (realIp) {
    ip = realIp
  } else if (forwarded) {
    ip = forwarded.split(',')[0].trim()
  }
  
  return ip
}

export function getUserIdentifier(request: Request, userId: string): string {
  return `user:${userId}`
}

export function getTenantIdentifier(request: Request, tenantId: string): string {
  return `tenant:${tenantId}`
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.total.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}

export function applyRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  identifier: string
): Promise<{ response?: Response; headers: HeadersInit }> {
  return limiter(identifier).then(result => ({
    response: result.success ? undefined : new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders(result),
        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
      },
    }),
    headers: rateLimitHeaders(result),
  }))
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: 'api',
})

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'auth',
})

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'ai',
})

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'upload',
})

export const ragRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'rag',
})

export const voiceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'voice',
})

export const documentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  keyPrefix: 'doc',
})