/**
 * ALEX Background Worker - Main Entry Point
 * 
 * Runs with tsx. Connects to Redis job queue and processes document
 * processing jobs durably.
 */

import { PrismaClient } from '@prisma/client'
import { dequeueJob, closeRedis, isRedisConnected, reEnqueueJob } from '@/lib/job-queue'
import { processDocumentFromJob } from '@/lib/document-processing/pipeline'

const prisma = new PrismaClient()

let isShuttingDown = false
let workerInterval: NodeJS.Timeout | null = null

// Structured logging
const log = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...meta }))
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta }))
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...meta }))
  },
}

async function processJob() {
  if (isShuttingDown) return

  try {
    const job = await dequeueJob()
    if (!job) return

    log.info('Processing job', { jobId: job.id, type: job.type, documentId: job.documentId })

    try {
      await processDocumentFromJob(job)
      log.info('Job completed successfully', { jobId: job.id })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('Job failed', { jobId: job.id, error: msg })

      // Handle retry logic - re-enqueue if under max retries
      if (job.retryCount < job.maxRetries) {
        await reEnqueueJob(job)
        log.info('Job re-queued for retry', { jobId: job.id, retryCount: job.retryCount + 1, maxRetries: job.maxRetries })
      } else {
        log.error('Job exhausted all retries', { jobId: job.id })
      }
    }
  } catch (error) {
    log.error('Error processing job', { error: error instanceof Error ? error.message : String(error) })
  }
}

async function startWorker() {
  if (!isRedisConnected()) {
    log.error('Redis not connected, waiting...')
    return
  }

  log.info('Starting document processing worker...')

  workerInterval = setInterval(async () => {
    if (isShuttingDown) return
    await processJob()
  }, 2000) // Poll every 2 seconds
}

async function stopWorker() {
  log.info('Shutting down worker...')
  isShuttingDown = true
  
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
  
  try {
    await closeRedis()
    log.info('Redis connection closed')
  } catch (error) {
    log.error('Error closing Redis', { error: error instanceof Error ? error.message : String(error) })
  }
  
  try {
    await prisma.$disconnect()
    log.info('Prisma disconnected')
  } catch (error) {
    log.error('Error disconnecting Prisma', { error: error instanceof Error ? error.message : String(error) })
  }
}

// Scheduled jobs
async function cleanupOldNotifications() {
  log.info('Running scheduled cleanup of old notifications')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  try {
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        isRead: true,
      },
    })

    log.info('Cleaned up old notifications', { count: result.count })
  } catch (error) {
    log.error('Failed to cleanup old notifications', { error: error instanceof Error ? error.message : String(error) })
  }
}

async function attendanceAlerts() {
  log.info('Running scheduled attendance alerts')

  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', isActive: true },
      include: {
        memberships: { where: { status: 'ACTIVE' } },
      },
    })

    for (const student of students) {
      for (const membership of student.memberships) {
        if (!membership.semesterId) continue

        const sessions = await prisma.attendanceSession.findMany({
          where: {
            semesterId: membership.semesterId,
            isCancelled: false,
          },
          include: {
            records: { where: { userId: student.id } },
          },
        })

        let present = 0
        let total = 0

        for (const session of sessions) {
          const record = session.records[0]
          if (record) {
            total++
            if (record.status === 'PRESENT') present++
          }
        }

        if (total > 0) {
          const percentage = (present / total) * 100
          if (percentage < 35) {
            await prisma.notification.create({
              data: {
                userId: student.id,
                category: 'ATTENDANCE',
                title: 'Low Attendance Alert',
                message: `Your attendance is ${percentage.toFixed(1)}%. Please attend classes regularly.`,
                isRead: false,
              },
            })
            log.info('Attendance alert sent', { studentId: student.id, email: student.email, percentage: percentage.toFixed(1) })
          }
        }
      }
    }
  } catch (error) {
    log.error('Failed to run attendance alerts', { error: error instanceof Error ? error.message : String(error) })
  }
}

// Job scheduler
function startScheduler() {
  // Daily at 2 AM - cleanup old notifications
  scheduleJob('0 2 * * *', cleanupOldNotifications)

  // Daily at 8 AM - attendance alerts
  scheduleJob('0 8 * * *', attendanceAlerts)

  log.info('Scheduler started')
}

function scheduleJob(cron: string, fn: () => Promise<void>) {
  const [minute, hour, day, month, weekday] = cron.split(' ')

  setInterval(async () => {
    const now = new Date()
    const matchMinute = minute === '*' || parseInt(minute, 10) === now.getMinutes()
    const matchHour = hour === '*' || parseInt(hour, 10) === now.getHours()
    const matchDay = day === '*' || parseInt(day, 10) === now.getDate()
    const matchMonth = month === '*' || parseInt(month, 10) === now.getMonth() + 1
    const matchWeekday = weekday === '*' || parseInt(weekday, 10) === now.getDay()

    if (matchMinute && matchHour && matchDay && matchMonth && matchWeekday) {
      await fn().catch(console.error)
    }
  }, 60000) // Check every minute
}

if (require.main === module) {
  log.info('Starting ALEX background worker...')
  startScheduler()
  startWorker()

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, initiating graceful shutdown...`)
    await stopWorker()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', { error: error.message, stack: error.stack })
    stopWorker().finally(() => process.exit(1))
  })
  
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', { reason: String(reason) })
  })
}

export { startWorker, stopWorker }