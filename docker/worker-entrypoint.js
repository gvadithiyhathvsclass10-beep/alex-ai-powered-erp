/**
 * ALEX Background Worker
 * 
 * Handles:
 * - Document processing (extraction, chunking, embedding, indexing)
 * - Study material generation (notes, flashcards, mindmaps, diagrams, quizzes)
 * - Scheduled jobs (cleanup, attendance alerts, reports)
 * - Notification delivery
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

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

function enqueueJob(job) {
  jobQueue.push(job)
  processQueue()
}

// Study Material Job Processing
async function processStudyMaterialJobs() {
  try {
    // Find pending jobs
    const jobs = await prisma.studyMaterialJob.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'asc' },
    })

    for (const job of jobs) {
      // Mark as processing
      await prisma.studyMaterialJob.update({
        where: { id: job.id },
        data: { status: 'processing', startedAt: new Date() },
      })

      try {
        let result
        
        switch (job.type) {
          case 'notes':
            result = await generateNotes(job)
            break
          case 'flashcards':
            result = await generateFlashcards(job)
            break
          case 'mindmaps':
            result = await generateMindmap(job)
            break
          case 'diagrams':
            result = await generateDiagram(job)
            break
          case 'quizzes':
            result = await generateQuiz(job)
            break
          default:
            throw new Error(`Unknown job type: ${job.type}`)
        }

        // Mark as completed
        await prisma.studyMaterialJob.update({
          where: { id: job.id },
          data: { 
            status: 'completed', 
            completedAt: new Date(),
            result,
          },
        })
      } catch (error) {
        console.error(`[Worker] Study job ${job.id} failed:`, error)
        
        // Mark as failed
        await prisma.studyMaterialJob.update({
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

// Poll for study material jobs every 10 seconds
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

// Import AI service functions dynamically
async function generateNotes(job) {
  // Dynamic import to avoid circular dependencies
  const { summarizeAndAnalyzeDocument } = await import('../apps/web/src/lib/ai/service')
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await prisma.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const summary = await summarizeAndAnalyzeDocument({
    userId: job.userId,
    documentTitle: doc.title,
    chunks: doc.chunks,
    analysisType: job.input.type || 'concise',
    customInstructions: job.input.customInstructions,
    provider: job.input.provider,
    model: job.input.model,
  })

  const material = await prisma.studyMaterial.create({
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

async function generateFlashcards(job) {
  const { generateStructuredOutput } = await import('../apps/web/src/lib/ai/service')
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await prisma.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const targetCount = Math.min(Math.max(Number(job.input.count) || 10, 1), 50)
  const sourceText = doc.chunks
    .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
    .join('\n\n')
    .slice(0, 16000)

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input.provider,
    model: job.input.model,
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

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: job.userId,
      title: job.input.title || `${doc.title} — flashcards`,
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

async function generateMindmap(job) {
  const { generateStructuredOutput } = await import('../apps/web/src/lib/ai/service')
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await prisma.document.findUnique({
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
    provider: job.input.provider,
    model: job.input.model,
    systemPrompt: 'You are ALEX, an academic knowledge-graph and mind-map generator. Extract the hierarchy of core concepts and their relationships from the provided document.',
    schemaDescription: `{
  "nodes": [
    { "id": "node-0", "label": "Central Topic", "position": { "x": 0, "y": 0 } }
  ],
  "edges": [
    { "id": "edge-0", "source": "node-0", "target": "node-1" }
  ]
}`,
    prompt: `Generate a structured concept mind map from "${doc.title}":\n\n${sourceText}`,
    validate: (parsed) => {
      if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
        throw new Error('Model did not return valid mind map nodes')
      }
      const nodes = parsed.nodes.map((n, idx) => ({
        id: String(n.id || `node-${idx}`),
        label: String(n.label || `Concept ${idx + 1}`).slice(0, 160),
        position: {
          x: typeof n.position?.x === 'number' ? n.position.x : (idx % 3) * 260,
          y: typeof n.position?.y === 'number' ? n.position.y : Math.floor(idx / 3) * 140,
        },
      }))
      const edges = Array.isArray(parsed.edges)
        ? parsed.edges.map((e, idx) => ({
            id: String(e.id || `edge-${idx}`),
            source: String(e.source || nodes[0].id),
            target: String(e.target || nodes[Math.min(idx + 1, nodes.length - 1)].id),
          }))
        : []
      return { nodes, edges }
    },
  })

  const map = await prisma.mindMap.create({
    data: {
      userId: job.userId,
      title: job.input.title || `${doc.title} — mind map`,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      nodes: structured.data.nodes,
      edges: structured.data.edges,
    },
  })

  return { mindMap: map, provider: structured.provider, model: structured.model }
}

async function generateDiagram(job) {
  const { generateStructuredOutput } = await import('../apps/web/src/lib/ai/service')
  const { saveDiagram } = await import('../apps/web/src/lib/diagrams/generator')
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await prisma.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 15 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const contextText = doc.chunks.map(c => c.content.trim()).join('\n\n').slice(0, 10000)
  const docTitle = job.input.title || `${doc.title} — diagram`

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input.provider,
    model: job.input.model,
    systemPrompt: 'You are ALEX, an academic diagram generator. Create a clear Mermaid flowchart or sequence diagram illustrating the core process or architecture in the provided content.',
    schemaDescription: `{
  "type": "mermaid",
  "title": "Diagram title",
  "code": "flowchart TD\\n  A[Step 1] --> B[Step 2]"
}`,
    prompt: `Generate a ${job.input.customType || 'mermaid'} diagram for "${docTitle}":\n\n${contextText}`,
    validate: (parsed) => {
      if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
        throw new Error('Model did not return valid diagram code')
      }
      return {
        type: (parsed.type || job.input.customType || 'mermaid'),
        title: String(parsed.title || docTitle),
        code: parsed.code.trim(),
      }
    },
  })

  const saved = await saveDiagram(job.userId, structured.data, job.sourceDocId, job.subjectId)

  return { id: saved.id, title: saved.title, type: saved.type, definition: saved.definition, provider: structured.provider, model: structured.model }
}

async function generateQuiz(job) {
  const { generateStructuredOutput } = await import('../apps/web/src/lib/ai/service')
  
  if (!job.sourceDocId) throw new Error('No source document')
  
  const doc = await prisma.document.findUnique({
    where: { id: job.sourceDocId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 30 } },
  })
  
  if (!doc || !doc.chunks?.length) throw new Error('Document not found or empty')
  
  const targetCount = Math.min(Math.max(Number(job.input.count) || 10, 1), 30)
  const sourceText = doc.chunks
    .map((c, idx) => `[Source ${idx + 1}]: ${c.content.trim()}`)
    .join('\n\n')
    .slice(0, 16000)

  const structured = await generateStructuredOutput({
    userId: job.userId,
    provider: job.input.provider,
    model: job.input.model,
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
    prompt: `Generate up to ${targetCount} ${job.input.difficulty || 'medium'}-difficulty multiple-choice questions from "${doc.title}":\n\n${sourceText}`,
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

  const quiz = await prisma.quiz.create({
    data: {
      userId: job.userId,
      title: job.input.title || `${doc.title} — quiz`,
      sourceDocId: doc.id,
      subjectId: doc.subjectId,
      difficulty: String(job.input.difficulty || 'medium'),
      questions: structured.data.questions,
    },
  })

  return { quiz, provider: structured.provider, model: structured.model }
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

// Main entry point
async function start() {
  console.log('[Worker] Starting ALEX background worker...')
  startScheduler()
  startStudyJobPoller()
  
  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60)
  
  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...')
    stopStudyJobPoller()
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...')
    stopStudyJobPoller()
    stopScheduler()
    await prisma.$disconnect()
    process.exit(0)
  })
}

module.exports = {
  enqueueJob,
  scheduleJob,
  start,
  stopStudyJobPoller,
  stopScheduler,
  processStudyMaterialJobs,
}