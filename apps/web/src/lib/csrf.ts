import crypto from 'node:crypto'

const CSRF_COOKIE_NAME = 'alex_csrf_token'
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.AUTH_SECRET

if (!CSRF_SECRET) {
  throw new Error('CSRF_SECRET or AUTH_SECRET environment variable is required for CSRF protection')
}

const secret: string = CSRF_SECRET

export function getCsrfToken(userId: string): string {
  const timestamp = Date.now()
  const payload = `${userId}.${timestamp}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
  return `${payload}.${signature}`
}

export function validateCsrfToken(token: string, userId: string): boolean {
  if (!token || typeof token !== 'string') return false
  
  const parts = token.split('.')
  if (parts.length !== 3) return false
  
  const [tokenUserId, timestampStr, signature] = parts
  if (tokenUserId !== userId) return false
  
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || Date.now() - timestamp > 60 * 60 * 24 * 7 * 1000) {
    return false
  }
  
  const payload = `${tokenUserId}.${timestampStr}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
  
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

export { CSRF_COOKIE_NAME }