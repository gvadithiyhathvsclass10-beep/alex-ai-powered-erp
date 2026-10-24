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

/**
 * Determine if the request is using HTTPS.
 * Checks X-Forwarded-Proto header (set by Cloudflare/Render proxy) first,
 * then falls back to NODE_ENV.
 */
export function isSecureRequest(request?: { headers?: { get: (name: string) => string | null } }): boolean {
  if (request?.headers?.get) {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    if (forwardedProto === 'https') return true
    const forwardedSsl = request.headers.get('x-forwarded-ssl')
    if (forwardedSsl === 'on') return true
  }
  return process.env.NODE_ENV === 'production'
}

/**
 * Get cookie options for auth cookies.
 * Uses secure: true in production or when behind HTTPS proxy.
 */
export function getAuthCookieOptions(request?: { headers?: { get: (name: string) => string | null } }): {
  httpOnly: boolean
  sameSite: 'lax' | 'none'
  secure: boolean
  path: string
  maxAge: number
} {
  const secure = isSecureRequest(request)
  // Use 'none' with secure: true for cross-origin (Cloudflare Pages -> Render API)
  // Use 'lax' for same-origin
  const sameSite = secure ? 'none' as const : 'lax' as const
  
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}
