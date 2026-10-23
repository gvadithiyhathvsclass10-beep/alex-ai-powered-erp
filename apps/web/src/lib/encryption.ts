import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

<<<<<<< HEAD
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

  // Never couple encrypted credentials to an authentication secret in production.
  // Before deploying this change, set ENCRYPTION_KEY to the exact value that was
  // previously effective (ENCRYPTION_KEY, else AUTH_SECRET, else NEXTAUTH_SECRET)
  // so existing ciphertext remains decryptable. Keep that value stable thereafter.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. Set it to a stable secret; if existing records were encrypted using AUTH_SECRET or NEXTAUTH_SECRET, use that previous effective value to preserve access.'
    )
  }

  // Development/test fallback only. Production must always use the dedicated key.
  const legacyDevelopmentKey = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  return legacyDevelopmentKey?.trim() || 'alex-local-dev-encryption-key-32chars'
}

=======
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const KEY_LENGTH = 32

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH) as Promise<Buffer>
}

export async function encrypt(text: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
<<<<<<< HEAD
  const key = await deriveKey(getEncryptionKey(), salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

=======
  const key = await deriveKey(ENCRYPTION_KEY, salt)
  
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64')
}

export async function decrypt(encryptedData: string): Promise<string> {
  const buffer = Buffer.from(encryptedData, 'base64')
<<<<<<< HEAD
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

=======
  
  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + 16)
  
  const key = await deriveKey(ENCRYPTION_KEY, salt)
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
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