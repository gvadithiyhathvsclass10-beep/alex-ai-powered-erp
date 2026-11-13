import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'
import { getUserEmbeddingProvider } from '@/lib/ai/embeddings'
import { analyzeQuestionPapers } from '@/lib/important-questions/analyzer'

export async function GET() {
  try {
    const user = await requireAuth()

    const analyses = await prisma.questionAnalysis.findMany({
      where: { userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { priorityItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ analyses: analyses.map(serializeBigInt) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Analyses list error:', error)
    return NextResponse.json({ error: 'Failed to list analyses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { title, subjectId, paperIds, filters } = body

    if (!title || !paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one paperId are required' },
        { status: 400 }
      )
    }

    // Fetch all questions from selected papers
    const papers = await prisma.questionPaper.findMany({
      where: { id: { in: paperIds }, userId: user.id },
      include: { questions: true },
    })

    if (papers.length === 0) {
      return NextResponse.json({ error: 'No valid papers found' }, { status: 404 })
    }

    const allQuestions = papers.flatMap(p => p.questions)

    // Apply filters if provided
    let filteredQuestions = allQuestions
    if (filters) {
      if (filters.unit) {
        filteredQuestions = filteredQuestions.filter(q => q.unit === filters.unit)
      }
      if (filters.topic) {
        filteredQuestions = filteredQuestions.filter(q => q.topic === filters.topic)
      }
      if (filters.yearFrom || filters.yearTo) {
        filteredQuestions = filteredQuestions.filter(q => {
          if (!q.year) return false
          if (filters.yearFrom && q.year < filters.yearFrom) return false
          if (filters.yearTo && q.year > filters.yearTo) return false
          return true
        })
      }
    }

    // Perform analysis with embeddings for semantic similarity
    const analysisResult = await analyzeQuestions(filteredQuestions, papers, user.id)

    // Save analysis
    const analysis = await prisma.questionAnalysis.create({
      data: {
        userId: user.id,
        title: title.trim(),
        subjectId: subjectId || papers[0]?.subjectId || null,
        paperIds,
        totalQuestions: filteredQuestions.length,
        exactRepeats: analysisResult.exactRepeats,
        semanticRepeats: analysisResult.semanticRepeats,
        analysisData: analysisResult as any,
        priorityItems: {
          create: analysisResult.priorityItems.map(item => ({
            questionId: item.questionId,
            priority: item.priority,
            reason: item.reason,
            frequency: item.frequency,
            recencyScore: item.recencyScore,
            marksWeight: item.marksWeight,
            unitRelevance: item.unitRelevance,
            papersCount: item.papersCount,
          })),
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        priorityItems: true,
      },
    })

    return NextResponse.json({ analysis: serializeBigInt(analysis) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Analysis create error:', error)
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 })
  }
}

async function analyzeQuestions(questions: any[], papers: any[], userId: string) {
  // Group questions by normalized text for exact repeats
  const exactGroups = new Map<string, any[]>()
  const semanticGroups: any[] = []

  questions.forEach(q => {
    const normalized = normalizeQuestionText(q.text)
    if (!exactGroups.has(normalized)) {
      exactGroups.set(normalized, [])
    }
    exactGroups.get(normalized)!.push(q)
  })

  // Count exact repeats
  let exactRepeats = 0
  exactGroups.forEach((group, key) => {
    if (group.length > 1) {
      exactRepeats += group.length - 1
    }
  })

  // Compute semantic similarity using embeddings
  let semanticRepeats = 0
  const questionEmbeddings = new Map<string, number[]>()
  
  try {
    const embeddingProvider = await getUserEmbeddingProvider(userId)
    if (embeddingProvider && questions.length > 0) {
      // Generate embeddings for all questions in batches
      const texts = questions.map(q => q.text)
      const batchSize = 50
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const result = await embeddingProvider.provider.generateEmbeddings(batch)
        batch.forEach((text, idx) => {
          const question = questions.find(q => q.text === text)
          if (question && result.embeddings[idx]) {
            questionEmbeddings.set(question.id, result.embeddings[idx])
          }
        })
      }

      // Find semantic similarities (cosine similarity > 0.85)
      const questionIds = Array.from(questionEmbeddings.keys())
      for (let i = 0; i < questionIds.length; i++) {
        for (let j = i + 1; j < questionIds.length; j++) {
          const emb1 = questionEmbeddings.get(questionIds[i])
          const emb2 = questionEmbeddings.get(questionIds[j])
          if (emb1 && emb2) {
            const similarity = cosineSimilarity(emb1, emb2)
            if (similarity > 0.85) {
              semanticRepeats++
              semanticGroups.push({
                questionId1: questionIds[i],
                questionId2: questionIds[j],
                similarity,
              })
            }
          }
        }
      }
    }
  } catch (embeddingError) {
    console.warn('[ImportantQuestions] Embedding-based semantic analysis failed, falling back to keyword matching:', embeddingError)
    // Fallback to keyword-based semantic grouping
    const keywordGroups = new Map<string, any[]>()
    questions.forEach(q => {
      const keywords = extractKeywords(q.text)
      const key = keywords.slice(0, 5).sort().join(',')
      if (!keywordGroups.has(key)) {
        keywordGroups.set(key, [])
      }
      keywordGroups.get(key)!.push(q)
    })
    keywordGroups.forEach((group, key) => {
      if (group.length > 1) {
        semanticRepeats += group.length - 1
      }
    })
  }

  // Unit-wise distribution
  const unitDistribution = new Map<string, number>()
  const topicDistribution = new Map<string, number>()
  const marksDistribution = new Map<number, number>()
  const yearDistribution = new Map<number, number>()
  const questionTypeDistribution = new Map<string, number>()

  questions.forEach(q => {
    if (q.unit) {
      unitDistribution.set(q.unit, (unitDistribution.get(q.unit) || 0) + 1)
    }
    if (q.topic) {
      topicDistribution.set(q.topic, (topicDistribution.get(q.topic) || 0) + 1)
    }
    if (q.marks) {
      marksDistribution.set(q.marks, (marksDistribution.get(q.marks) || 0) + 1)
    }
    if (q.year) {
      yearDistribution.set(q.year, (yearDistribution.get(q.year) || 0) + 1)
    }
    if (q.questionType) {
      questionTypeDistribution.set(q.questionType, (questionTypeDistribution.get(q.questionType) || 0) + 1)
    }
  })

  // Build priority items
  const questionMap = new Map<string, any[]>()

  // Group by concept/topic for priority analysis
  questions.forEach(q => {
    const key = q.concept || q.topic || q.unit || 'General'
    if (!questionMap.has(key)) {
      questionMap.set(key, [])
    }
    questionMap.get(key)!.push(q)
  })

  const priorityItems = Array.from(questionMap.entries()).map(([concept, group]) => {
    const frequency = group.length
    const papersContaining = new Set(group.map(q => q.questionPaperId)).size
    const totalMarks = group.reduce((sum, q) => sum + (q.marks || 0), 0)
    const avgMarks = totalMarks / group.length
    const years = group.filter(q => q.year).map(q => q.year!)
    const firstYear = years.length > 0 ? Math.min(...years) : undefined
    const lastYear = years.length > 0 ? Math.max(...years) : undefined
    const units = [...new Set(group.map(q => q.unit).filter(Boolean))]
    const topics = [...new Set(group.map(q => q.topic).filter(Boolean))]
    const concepts = [...new Set(group.map(q => q.concept).filter(Boolean))]
    const questionTypes = [...new Set(group.map(q => q.questionType).filter(Boolean))]

    // Calculate priority scores
    const frequencyScore = Math.min(frequency / 5, 1) // Max at 5+ occurrences
    const recencyScore = lastYear ? Math.max(0, 1 - (new Date().getFullYear() - lastYear) / 10) : 0.5
    const marksWeight = Math.min(avgMarks / 20, 1) // Max at 20 marks
    const unitRelevance = units.length > 0 ? 1 : 0.5
    const papersCount = papersContaining

    const compositeScore =
      frequencyScore * 0.35 +
      recencyScore * 0.25 +
      marksWeight * 0.20 +
      unitRelevance * 0.10 +
      (papersCount / papers.length) * 0.10

    let priority: 'HIGH' | 'MEDIUM' | 'LOW'
    if (compositeScore >= 0.65) priority = 'HIGH'
    else if (compositeScore >= 0.35) priority = 'MEDIUM'
    else priority = 'LOW'

    const reasonParts = []
    if (frequency > 1) reasonParts.push(`Appears ${frequency} times`)
    if (papersCount > 1) reasonParts.push(`In ${papersCount} papers`)
    if (lastYear && lastYear >= new Date().getFullYear() - 2) reasonParts.push(`Recent (${lastYear})`)
    if (avgMarks >= 10) reasonParts.push(`High marks (avg ${avgMarks.toFixed(1)})`)
    const reason = reasonParts.join('; ') || 'Limited historical data'

    return {
      questionId: group[0].id,
      questionText: group[0].text,
      concept,
      frequency,
      papersCount,
      totalMarks,
      avgMarks,
      firstYear,
      lastYear,
      units,
      topics,
      concepts,
      questionTypes,
      priority,
      reason,
      isExactRepeat: exactGroups.get(normalizeQuestionText(group[0].text))!.length > 1,
      matchedQuestionIds: group.slice(1).map(q => q.id),
      recencyScore,
      marksWeight,
      unitRelevance,
    }
  })

  // Sort by priority and frequency
  priorityItems.sort((a, b) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
    return b.frequency - a.frequency
  })

  return {
    exactRepeats,
    semanticRepeats,
    unitDistribution: Object.fromEntries(unitDistribution),
    topicDistribution: Object.fromEntries(topicDistribution),
    marksDistribution: Object.fromEntries(marksDistribution),
    yearDistribution: Object.fromEntries(yearDistribution),
    questionTypeDistribution: Object.fromEntries(questionTypeDistribution),
    totalQuestions: questions.length,
    totalPapers: papers.length,
    priorityItems,
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 10)
}

function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}