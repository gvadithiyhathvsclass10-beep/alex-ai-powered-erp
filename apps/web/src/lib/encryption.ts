import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

function getEncryptionKey(): string {
  const dedicatedKey = process.env.ENCRYPTION_KEY
  if (dedicatedKey && dedicatedKey.trim().length > 0) {
    return dedicatedKey
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. Set it to a stable 32+ character secret; if existing records were encrypted using AUTH_SECRET or NEXTAUTH_SECRET, use that previous effective value to preserve access.'
    )
  }

  const devKey = process.env.ENCRYPTION_KEY_DEV
  if (devKey && devKey.trim().length > 0) {
    return devKey
  }

  throw new Error(
    'ENCRYPTION_KEY or ENCRYPTION_KEY_DEV environment variable is required. Set ENCRYPTION_KEY_DEV for development with a 32+ character secret.'
  )
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH) as Promise<Buffer>
}

export async function encrypt(text: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = await deriveKey(getEncryptionKey(), salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64')
}

export async function decrypt(encryptedData: string): Promise<string> {
  const buffer = Buffer.from(encryptedData, 'base64')
  const minLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  if (buffer.length < minLength) {
    throw new Error('Invalid encrypted payload: buffer too short')
  }

  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  const key = await deriveKey(getEncryptionKey(), salt)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

export function generateKeyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}