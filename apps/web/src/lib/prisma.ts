import { PrismaClient } from '@prisma/client'

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
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL environment variable is required in production')
  }
  throw new Error('DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.')
}

// Configure Prisma for Neon PostgreSQL with connection pooling
// For Neon, use pgbouncer=true in connection string for serverless environments
// For Render (long-running), standard connection is fine
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NEXT_RUNTIME === 'edge'
const usePgBouncer = process.env.DATABASE_URL?.includes('pgbouncer=true') || isServerless

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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

export default prisma