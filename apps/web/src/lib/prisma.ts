import { PrismaClient } from '@prisma/client'

<<<<<<< HEAD
// Ensure BigInt values (e.g., Document.fileSize, SubjectResource.fileSize, SubmissionAttachment.fileSize)
// never cause "TypeError: Do not know how to serialize a BigInt" in NextResponse.json()
if (typeof (BigInt.prototype as unknown as { toJSON?: () => string }).toJSON !== 'function') {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON(this: bigint) {
      const asNum = Number(this)
      return Number.isSafeInteger(asNum) ? asNum : this.toString()
    },
    writable: true,
    configurable: true,
  })
}

export function serializeBigInt<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') {
    const asNum = Number(value)
    return (Number.isSafeInteger(asNum) ? asNum : value.toString()) as unknown as T
  }
  if (value instanceof Date || Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => serializeBigInt(item)) as unknown as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigInt(v)
    }
    return out as T
  }
  return value
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://alex:alex@localhost:5432/alex'
}

=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
<<<<<<< HEAD
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
=======
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

<<<<<<< HEAD
export async function checkDatabaseConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - start }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed'
    console.error('[Prisma] Database health check failed:', message)
    return { ok: false, latencyMs: Date.now() - start, error: message }
  }
}

=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
export default prisma