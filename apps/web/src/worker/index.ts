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

async function processJob() {
  if (isShuttingDown) return

  try {
    const job = await dequeueJob()
    if (!job) return

    console.log(`[Worker] Processing job ${job.id} (type: ${job.type}, document: ${job.documentId})`)

    try {
      await processDocumentFromJob(job)
      console.log(`[Worker] Job ${job.id} completed successfully`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Worker] Job ${job.id} failed:`, msg)

      // Handle retry logic - re-enqueue if under max retries
      if (job.retryCount < job.maxRetries) {
        await reEnqueueJob(job)
        console.log(`[Worker] Job ${job.id} re-queued for retry ${job.retryCount + 1}/${job.maxRetries}`)
      } else {
        console.error(`[Worker] Job ${job.id} exhausted all retries`)
      }
    }
  } catch (error) {
    console.error('[Worker] Error processing job:', error)
  }
}

async function startWorker() {
  if (!isRedisConnected()) {
    console.error('[Worker] Redis not connected, waiting...')
    return
  }

  console.log('[Worker] Starting document processing worker...')

  workerInterval = setInterval(async () => {
    if (isShuttingDown) return
    await processJob()
  }, 2000) // Poll every 2 seconds
}

async function stopWorker() {
  isShuttingDown = true
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
  await closeRedis()
  await prisma.$disconnect()
}

// Scheduled jobs
async function cleanupOldNotifications() {
  console.log('[Worker] Running scheduled cleanup of old notifications')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      isRead: true,
    },
  })

  console.log(`[Worker] Cleaned up ${result.count} old notifications`)
}

async function attendanceAlerts() {
  console.log('[Worker] Running scheduled attendance alerts')

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
          console.log(`[Worker] Attendance alert sent to ${student.email}: ${percentage.toFixed(1)}%`)
        }
      }
    }
  }
}

// Job scheduler
function startScheduler() {
  // Daily at 2 AM - cleanup old notifications
  scheduleJob('0 2 * * *', cleanupOldNotifications)

  // Daily at 8 AM - attendance alerts
  scheduleJob('0 8 * * *', attendanceAlerts)

  console.log('[Worker] Scheduler started')
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
  console.log('[Worker] Starting ALEX background worker...')
  startScheduler()
  startWorker()

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...')
    await stopWorker()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...')
    await stopWorker()
    process.exit(0)
  })
}

export { startWorker, stopWorker }