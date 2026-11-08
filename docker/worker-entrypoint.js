/**
 * ALEX Background Worker
 * 
 * Handles:
 * - Document processing (extraction, chunking, embedding, indexing)
 * - Study material generation (notes, flashcards, mindmaps, diagrams, quizzes)
 * - Scheduled jobs (cleanup, attendance alerts, reports)
 * - Notification delivery
 * 
 * This file runs as a standalone Node.js process in production.
 * It uses an esbuild bundle (worker-bundle.js) for all internal modules.
 */

const { PrismaClient } = require('@prisma/client')
const path = require('path')

// Load the esbuild bundle which contains all internal modules
let workerBundle = null
async function loadWorkerBundle() {
  if (!workerBundle) {
    try {
      workerBundle = require(path.join(__dirname, 'worker-bundle.js'))
    } catch (e) {
      console.error('[Worker] Failed to load worker bundle:', e.message)
      throw new Error('Worker bundle not found. Ensure the worker image includes the esbuild bundle.')
    }
  }
  return workerBundle
}

// Create Prisma client using the bundled instance
let prisma = null
async function getPrisma() {
  if (!prisma) {
    const bundle = await loadWorkerBundle()
    prisma = bundle.prisma || new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }
  return prisma
}

// ============================================================================
// Job Claiming & Concurrency Control
// ============================================================================

/**
 * Attempts to atomically claim a pending job for processing.
 * Uses FOR UPDATE SKIP LOCKED for true atomic job claiming.
 * 
 * @returns The claimed job or null if no jobs available
 */
async function claimNextJob() {
  const db = await getPrisma()
  
  // Use raw query with FOR UPDATE SKIP LOCKED for true atomic claiming
  // This prevents race conditions between multiple workers
  const result = await db.$queryRaw`
    UPDATE "StudyMaterialJob"
    SET status = 'processing', "startedAt" = NOW()
    WHERE id = (
      SELECT id FROM "StudyMaterialJob"
      WHERE status = 'pending'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `
  
  if (result && result.length > 0) {
    return result[0]
  }
  
  return null
}

/**
 * Recovers stale jobs that have been stuck in 'processing' for too long.
 * This handles cases where a worker crashed mid-processing.
 * 
 * @param {number} staleThresholdMs - Milliseconds after which a processing job is considered stale (default: 10 minutes)
 */
async function recoverStaleJobs(staleThresholdMs = 10 * 60 * 1000) {
  const db = await getPrisma()
  const staleCutoff = new Date(Date.now() - staleThresholdMs)
  
  const result = await db.studyMaterialJob.updateMany({
    where: {
      status: 'processing',
      startedAt: { lt: staleCutoff },
    },
    data: {
      status: 'pending',
      startedAt: null,
      errorMessage: 'Recovered from stale processing state',
    },
  })

  if (result.count > 0) {
    console.log(`[Worker] Recovered ${result.count} stale job(s) back to pending`)
  }
  
  return result.count
}

// ============================================================================
// AI Service Access (via worker bundle)
// ============================================================================

let aiService = null

async function getAIService(userId) {
  if (!aiService) {
    const bundle = await loadWorkerBundle()
    aiService = {
      summarizeAndAnalyzeDocument: (options) => bundle.summarizeAndAnalyzeDocument({ ...options, userId }),
      generateStructuredOutput: (options) => bundle.generateStructuredOutput({ ...options, userId }),
    }
  }
  return aiService
}

let diagramsGenerator = null

async function getDiagramsGenerator(userId) {
  if (!diagramsGenerator) {
    const bundle = await loadWorkerBundle()
    diagramsGenerator = {
      saveDiagram: (userId, definition, sourceDocId, subjectId) => bundle.saveDiagram(userId, definition, sourceDocId, subjectId),
    }
  }
  return diagramsGenerator
}

// ============================================================================
// Study Material Job Processing
// ============================================================================

async function processStudyMaterialJobs() {
  try {
    // First, recover any stale jobs
    await recoverStaleJobs()

    // Process up to 5 jobs per cycle
    for (let i = 0; i < 5; i++) {
      const job = await claimNextJob()
      if (!job) break // No more pending jobs

      try {
        let result
        
        const aiService = await getAIService(job.userId)
        const diagramsGenerator = await getDiagramsGenerator(job.userId)
        
        switch (job.type) {
          case 'notes':
            result = await generateNotes(job, aiService)
            break
          case 'flashcards':
            result = await generateFlashcards(job, aiService)
            break
          case 'mindmaps':
            result = await generateMindmap(job, aiService)
            break
          case 'diagrams':
            result = await generateDiagram(job, aiService, diagramsGenerator)
            break
          case 'quizzes':
            result = await generateQuiz(job, aiService)
            break
          default:
            throw new Error(`Unknown job type: ${job.type}`)
        }

        // Mark as completed
        const db = await getPrisma()
        await db.studyMaterialJob.update({
          where: { id: job.id },
          data: { 
            status: 'completed', 
            completedAt: new Date(),
            result,
          },
        })
        console.log(`[Worker] Job ${job.id} (${job.type}) completed successfully`)
      } catch (error) {
        console.error(`[Worker] Study job ${job.id} failed:`, error)
        
        // Mark as failed with error message
        const db = await getPrisma()
        await db.studyMaterialJob.update({
          where: { id: job.id },
          data: { 
            status: 'failed', 
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    }
  } catch (error) {
    console.error('[Worker] Study material job processing error:', error)
  }
}

// ============================================================================
// Job Generation Functions
// ============================================================================

async function generateNotes(job, aiService) {
  const { summarizeAndAnalyzeDocument } = aiService
  const db = await getPrisma()
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await db.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const summary = await summarizeAndAnalyzeDocument({
    userId: job.userId,
    documentTitle: doc.title,
    chunks: doc.chunks,
    analysisType: job.input?.type || 'concise',
    customInstructions: job.input?.customInstructions,
    provider: job.input?.provider,
    model: job.input?.model,
  })

  const material = await db.studyMaterial.create({
    data: {
      userId: job.userId,
      title: summary.title,
      content: summary.content,
      type: summary.type,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      tags: [summary.type, summary.provider.toLowerCase()],
      metadata: {
        provider: summary.provider,
        model: summary.model,
        tokenUsage: summary.tokenUsage,
      },
    },
  })

  return { materialId: material.id, ...summary }
}

async function generateFlashcards(job, aiService) {
  const { generateStructuredOutput } = aiService
  const db = await getPrisma()
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await db.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const targetCount = Math.min(Math.max(Number(job.input?.count) || 10, 1), 50)
  const sourceText = doc.chunks
    .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
    .join('\n\n')
    .slice(0, 16000)

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input?.provider,
    model: job.input?.model,
    systemPrompt: 'You are ALEX, an academic flashcard generator. Create high-signal spaced-repetition flashcards strictly grounded in the provided document text.',
    schemaDescription: `{
  "cards": [
    {
      "front": "Clear, specific question testing a concept, formula, or definition from the text",
      "back": "Concise, accurate answer grounded in the source text with [Source X] citation"
    }
  ]
}`,
    prompt: `Generate up to ${targetCount} flashcards from "${doc.title}":\n\n${sourceText}`,
    validate: (parsed) => {
      const rawCards = Array.isArray(parsed) ? parsed : parsed?.cards
      if (!Array.isArray(rawCards) || rawCards.length === 0) {
        throw new Error('Model did not return a non-empty cards array')
      }
      return {
        cards: rawCards
          .filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string')
          .slice(0, targetCount)
          .map((c) => ({
            front: c.front.trim(),
            back: c.back.trim(),
          })),
      }
    },
  })

  const deck = await db.flashcardDeck.create({
    data: {
      userId: job.userId,
      title: job.input?.title || `${doc.title} — flashcards`,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      cards: {
        create: structured.data.cards.map(c => ({
          front: c.front,
          back: c.back,
        })),
      },
    },
    include: { cards: true, _count: { select: { cards: true } } },
  })

  return { deckId: deck.id, deck, provider: structured.provider, model: structured.model }
}

async function generateMindmap(job, aiService) {
  const { generateStructuredOutput } = aiService
  const db = await getPrisma()
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await db.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 20 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const sourceText = doc.chunks
    .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
    .join('\n\n')
    .slice(0, 12000)

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input?.provider,
    model: job.input?.model,
    systemPrompt: 'You are ALEX, an academic knowledge-graph and mind-map generator. Extract the hierarchy of core concepts and their relationships from the provided document.',
    schemaDescription: '{"nodes":[{"id":"node-0","label":"Central Topic","position":{"x":0,"y":0}}],"edges":[{"id":"edge-0","source":"node-0","target":"node-1"}]}',
    prompt: 'Generate a structured concept mind map from "' + doc.title + '":\n\n' + sourceText,
    validate: (parsed) => {
      if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
        throw new Error('Model did not return valid mind map nodes')
      }
      const nodes = parsed.nodes.map((n, idx) => {
        const nodeId = n.id ? String(n.id) : 'node-' + idx
        const nodeLabel = n.label ? String(n.label) : 'Concept ' + (idx + 1)
        const posX = typeof n.position?.x === 'number' ? n.position.x : (idx % 3) * 260
        const posY = typeof n.position?.y === 'number' ? n.position.y : Math.floor(idx / 3) * 140
        return {
          id: nodeId,
          label: nodeLabel.slice(0, 160),
          position: { x: posX, y: posY }
        }
      })
      const edges = Array.isArray(parsed.edges)
        ? parsed.edges.map((e, idx) => {
            const edgeId = e.id ? String(e.id) : 'edge-' + idx
            const edgeSource = e.source ? String(e.source) : nodes[0].id
            const edgeTarget = e.target ? String(e.target) : nodes[Math.min(idx + 1, nodes.length - 1)].id
            return { id: edgeId, source: edgeSource, target: edgeTarget }
          })
        : []
      return { nodes, edges }
    },
  })

  const map = await db.mindMap.create({
    data: {
      userId: job.userId,
      title: job.input?.title || `${doc.title} — mind map`,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      nodes: structured.data.nodes,
      edges: structured.data.edges,
    },
  })

  return { mindMap: map, provider: structured.provider, model: structured.model }
}

async function generateDiagram(job, aiService, diagramsGenerator) {
  const { generateStructuredOutput } = aiService
  const { saveDiagram } = diagramsGenerator
  const db = await getPrisma()
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await db.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 15 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const contextText = doc.chunks.map(c => c.content.trim()).join('\n\n').slice(0, 10000)
  const docTitle = job.input?.title || `${doc.title} — diagram`

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input?.provider,
    model: job.input?.model,
    systemPrompt: 'You are ALEX, an academic diagram generator. Create a clear Mermaid flowchart or sequence diagram illustrating the core process or architecture in the provided content.',
    schemaDescription: `{
  "type": "mermaid",
  "title": "Diagram title",
  "code": "flowchart TD\\n  A[Step 1] --> B[Step 2]"
}`,
    prompt: `Generate a ${job.input?.customType || 'mermaid'} diagram for "${docTitle}":\n\n${contextText}`,
    validate: (parsed) => {
      if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
        throw new Error('Model did not return valid diagram code')
      }
      return {
        type: (parsed.type || job.input?.customType || 'mermaid'),
        title: String(parsed.title || docTitle),
        code: parsed.code.trim(),
      }
    },
  })

  const saved = await saveDiagram(job.userId, structured.data, job.sourceDocId, job.subjectId)

  return { id: saved.id, title: saved.title, type: saved.type, definition: saved.definition, provider: structured.provider, model: structured.model }
}

async function generateQuiz(job, aiService) {
  const { generateStructuredOutput } = aiService
  const db = await getPrisma()
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await db.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 30 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const targetCount = Math.min(Math.max(Number(job.input?.count) || 10, 1), 30)
  const sourceText = doc.chunks
    .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
    .join('\n\n')
    .slice(0, 16000)

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input?.provider,
    model: job.input?.model,
    systemPrompt: 'You are ALEX, an academic assessment generator. Create multiple-choice quiz questions grounded strictly in the provided document text.',
    schemaDescription: `{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question text testing understanding of the source material",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explanation of why the correct option is right, citing [Source X]"
    }
  ]
}`,
    prompt: `Generate up to ${targetCount} ${job.input?.difficulty || 'medium'}-difficulty multiple-choice questions from "${doc.title}":\n\n${sourceText}`,
    validate: (parsed) => {
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('Model did not return a non-empty questions array')
      }
      return {
        questions: rawQuestions.slice(0, targetCount).map((q, idx) => ({
          id: q.id || `q-${idx + 1}`,
          prompt: String(q.prompt || q.question || ''),
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.map(String) : ['True', 'False'],
          answer: typeof q.answer === 'number' ? q.answer : 0,
          explanation: q.explanation ? String(q.explanation) : undefined,
        })),
      }
    },
  })

  const quiz = await db.quiz.create({
    data: {
      userId: job.userId,
      title: job.input?.title || `${doc.title} — quiz`,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      difficulty: String(job.input?.difficulty || 'medium'),
      questions: structured.data.questions,
    },
  })

  return { quiz, provider: structured.provider, model: structured.model }
}

// ============================================================================
// Scheduled Jobs
// ============================================================================

async function cleanupOldNotifications() {
  const db = await getPrisma()
  console.log('[Worker] Running scheduled cleanup of old notifications')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const result = await db.notification.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      isRead: true,
    },
  })
  
  console.log(`[Worker] Cleaned up ${result.count} old notifications`)
}

async function attendanceAlerts() {
  const db = await getPrisma()
  console.log('[Worker] Running scheduled attendance alerts')
  
  const students = await db.user.findMany({
    where: { role: 'STUDENT', isActive: true },
    include: {
      memberships: { where: { status: 'ACTIVE' } },
    },
  })
  
  for (const student of students) {
    for (const membership of student.memberships) {
      if (!membership.semesterId) continue
      
      const sessions = await db.attendanceSession.findMany({
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
          await db.notification.create({
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

// ============================================================================
// Job Scheduler
// ============================================================================

let schedulerInterval = null

function startScheduler() {
  if (schedulerInterval) return
  
  // Daily at 2 AM - cleanup old notifications
  scheduleJob('0 2 * * *', cleanupOldNotifications)
  
  // Daily at 8 AM - attendance alerts
  scheduleJob('0 8 * * *', attendanceAlerts)
  
  console.log('[Worker] Scheduler started')
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

function scheduleJob(cron, fn) {
  // Simple cron implementation - in production use node-cron or similar
  const [minute, hour, day, month, weekday] = cron.split(' ')
  
  schedulerInterval = setInterval(() => {
    const now = new Date()
    const matchMinute = minute === '*' || parseInt(minute, 10) === now.getMinutes()
    const matchHour = hour === '*' || parseInt(hour, 10) === now.getHours()
    const matchDay = day === '*' || parseInt(day, 10) === now.getDate()
    const matchMonth = month === '*' || parseInt(month, 10) === now.getMonth() + 1
    const matchWeekday = weekday === '*' || parseInt(weekday, 10) === now.getDay()
    
    if (matchMinute && matchHour && matchDay && matchMonth && matchWeekday) {
      fn().catch(console.error)
    }
  }, 60000) // Check every minute
}

// ============================================================================
// Job Poller
// ============================================================================

let studyJobInterval = null

function startStudyJobPoller() {
  if (studyJobInterval) return
  studyJobInterval = setInterval(() => {
    processStudyMaterialJobs().catch(console.error)
  }, 10000)
  
  // Process on startup
  processStudyMaterialJobs().catch(console.error)
}

function stopStudyJobPoller() {
  if (studyJobInterval) {
    clearInterval(studyJobInterval)
    studyJobInterval = null
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function start() {
  console.log('[Worker] Starting ALEX background worker...')
  console.log('[Worker] NODE_ENV:', process.env.NODE_ENV)
  console.log('[Worker] Database URL configured:', !!process.env.DATABASE_URL)
  
  try {
    // Test database connection
    const db = await getPrisma()
    await db.$queryRaw`SELECT 1`
    console.log('[Worker] Database connection verified')
    
    // Recover any stale jobs on startup
    console.log('[Worker] Recovering stale jobs...')
    const recovered = await recoverStaleJobs()
    if (recovered > 0) {
      console.log(`[Worker] Recovered ${recovered} stale job(s) on startup`)
    }
  } catch (error) {
    console.error('[Worker] Database connection failed:', error)
    throw error
  }
  
  startScheduler()
  startStudyJobPoller()
  
  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60)
  
  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...')
    stopStudyJobPoller()
    stopScheduler()
    const db = await getPrisma()
    await db.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...')
    stopStudyJobPoller()
    stopScheduler()
    const db = await getPrisma()
    await db.$disconnect()
    process.exit(0)
  })
}

// ============================================================================
// Auto-start when run directly (not imported as module)
// ============================================================================

// In Node.js, when a file is run directly with `node worker-entrypoint.js`,
// `require.main === module` is true. When imported, it's false.
if (require.main === module) {
  start().catch((error) => {
    console.error('[Worker] Fatal startup error:', error)
    process.exit(1)
  })
}

module.exports = {
  enqueueJob: () => {}, // Deprecated - kept for compatibility
  scheduleJob,
  start,
  stopStudyJobPoller,
  stopScheduler,
  processStudyMaterialJobs,
  claimNextJob,
  recoverStaleJobs,
}