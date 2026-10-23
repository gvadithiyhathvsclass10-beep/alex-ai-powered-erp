/**
 * ALEX Background Worker
 * 
 * Handles:
 * - Document processing (extraction, chunking, embedding, indexing)
 * - Scheduled jobs (cleanup, attendance alerts, reports)
 * - Notification delivery
 */

<<<<<<< HEAD
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
=======
import { PrismaClient } from '@prisma/client'
import { processDocument } from './apps/web/src/lib/document-processing/pipeline'
import { getStorage } from './apps/web/src/lib/storage'
import { prisma } from './apps/web/src/lib/prisma'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

// Simple in-memory queue for demo; replace with BullMQ + Redis in production
const jobQueue = []
let isProcessing = false

async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return
  isProcessing = true
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()
    if (job) {
      try {
        await job()
      } catch (error) {
        console.error('Job failed:', error)
      }
    }
  }
  
  isProcessing = false
}

<<<<<<< HEAD
function enqueueJob(job) {
=======
function enqueueJob(job: () => Promise<void>) {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  jobQueue.push(job)
  processQueue()
}

<<<<<<< HEAD
=======
// Document processing job
async function handleDocumentProcessing(documentId, userId) {
  console.log(`[Worker] Processing document ${documentId} for user ${userId}`)
  
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })
  
  if (!document) {
    console.error(`[Worker] Document ${documentId} not found`)
    return
  }
  
  if (document.ownerId !== userId) {
    console.error(`[Worker] Unauthorized: user ${userId} not owner of document ${documentId}`)
    return
  }
  
  const storage = getStorage()
  const file = await storage.download(document.storageBucket, document.storagePath)
  
  await processDocument({
    documentId,
    userId,
    fileBuffer: file,
    fileName: document.fileName,
    mimeType: document.mimeType,
    documentType: document.documentType,
    subjectId: document.subjectId || undefined,
    projectId: document.projectId || undefined,
    notebookId: document.notebookId || undefined,
  })
  
  console.log(`[Worker] Document ${documentId} processing complete`)
}

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
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

function scheduleJob(cron, fn) {
  // Simple cron implementation - in production use node-cron or similar
  const [minute, hour, day, month, weekday] = cron.split(' ')
  
  setInterval(() => {
    const now = new Date()
<<<<<<< HEAD
    const matchMinute = minute === '*' || parseInt(minute, 10) === now.getMinutes()
    const matchHour = hour === '*' || parseInt(hour, 10) === now.getHours()
    const matchDay = day === '*' || parseInt(day, 10) === now.getDate()
    const matchMonth = month === '*' || parseInt(month, 10) === now.getMonth() + 1
    const matchWeekday = weekday === '*' || parseInt(weekday, 10) === now.getDay()
=======
    const matchMinute = minute === '*' || parseInt(minute) === now.getMinutes()
    const matchHour = hour === '*' || parseInt(hour) === now.getHours()
    const matchDay = day === '*' || parseInt(day) === now.getDate()
    const matchMonth = month === '*' || parseInt(month) === now.getMonth() + 1
    const matchWeekday = weekday === '*' || parseInt(weekday) === now.getDay()
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    
    if (matchMinute && matchHour && matchDay && matchMonth && matchWeekday) {
      fn().catch(console.error)
    }
  }, 60000) // Check every minute
}

<<<<<<< HEAD
if (require.main === module) {
  console.log('[Worker] Starting ALEX background worker...')
  startScheduler()

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60)

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })
}

module.exports = {
  enqueueJob,
  scheduleJob,
}
=======
// API to enqueue jobs (called from Next.js API routes)
export async function enqueueDocumentProcessingJob(documentId, userId) {
  enqueueJob(() => handleDocumentProcessing(documentId, userId))
}

// Start worker
console.log('[Worker] Starting ALEX background worker...')
startScheduler()

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60) // Sleep forever

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
