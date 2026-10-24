import { prisma } from '@/lib/prisma'
import { checkDatabaseConnection } from '@/lib/prisma'
import { isRedisConnected } from '@/lib/job-queue'
import { NextResponse } from 'next/server'

export async function GET() {
  const start = Date.now()
  
  // Check database
  const dbHealth = await checkDatabaseConnection()
  
  // Check Redis
  let redisHealth = { ok: false, error: 'Not configured' }
  try {
    if (process.env.REDIS_URL) {
      const redisOk = isRedisConnected()
      redisHealth = { ok: redisOk, error: redisOk ? '' : 'Not connected' }
    } else {
      redisHealth = { ok: true, error: 'Not configured (optional)' }
    }
  } catch (error) {
    redisHealth = { ok: false, error: error instanceof Error ? error.message : 'Redis check failed' }
  }
  
  const allHealthy = dbHealth.ok && redisHealth.ok
  const latencyMs = Date.now() - start
  
  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      latencyMs,
      checks: {
        database: dbHealth,
        redis: redisHealth,
      },
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      authMode: process.env.AUTH_MODE || 'local',
      aiMode: process.env.AI_MODE || 'mock',
    },
    { status: allHealthy ? 200 : 503 }
  )
}
