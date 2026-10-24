import crypto from 'node:crypto'

export const LOCAL_AUTH_COOKIE = 'alex_local_session'

function secret(): string {
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret || authSecret.trim().length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is required in production')
    }
    throw new Error('AUTH_SECRET environment variable is required. Set it to a stable 32+ character secret.')
  }
  return authSecret
}

export function createLocalSession(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })
  ).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

export function getLocalUserId(token?: string | null): string | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data || typeof data.sub !== 'string' || typeof data.exp !== 'number') {
      return null
    }
    return data.exp > Date.now() ? String(data.sub) : null
  } catch {
    return null
  }
}

export function isLocalAuth(): boolean {
  return (process.env.AUTH_MODE || 'local').toLowerCase() === 'local'
}
