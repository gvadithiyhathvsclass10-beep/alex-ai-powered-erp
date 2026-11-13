/**
 * Important Questions Analyzer
 * Performs comprehensive academic analysis of question papers
 * Includes web research integration for syllabus/concept coverage
 */

import { prisma } from '@/lib/prisma'
import { generateStructuredOutput, formatAIServiceErrorResponse } from '@/lib/ai/service'

export interface QuestionPaperWithQuestions {
  id: string
  title: string
  paperType: 'QB' | 'PYQ'
  subjectId: string | null
  semester: string | null
  unit: string | null
  academicYear: string | null
  examinationYear: number | null
  marks: number | null
  questions: ExtractedQuestion[]
}

export interface ExtractedQuestion {
  id: string
  questionPaperId: string
  questionNumber: string
  text: string
  subQuestions: any | null
  marks: number | null
  unit: string | null
  topic: string | null
  concept: string | null
  questionType: string | null
  difficulty: string | null
  year: number | null
  pageReference: number | null
  extractionConfidence: number
  flags: string[]
}

export interface AnalysisResult {
  exactRepeats: number
  semanticRepeats: number
  unitDistribution: Record<string, number>
  topicDistribution: Record<string, number>
  marksDistribution: Record<number, number>
  yearDistribution: Record<number, number>
  questionTypeDistribution: Record<string, number>
  totalQuestions: number
  totalPapers: number
  priorityItems: PriorityItem[]
  webResearch?: WebResearchResult
}

export interface PriorityItem {
  questionId: string
  questionText: string
  concept: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
  frequency: number
  papersCount: number
  totalMarks: number
  avgMarks: number
  firstYear: number | null
  lastYear: number | null
  units: string[]
  topics: string[]
  concepts: string[]
  questionTypes: string[]
  isExactRepeat: boolean
  matchedQuestionIds: string[]
  recencyScore: number
  marksWeight: number
  unitRelevance: number
  source: 'historical' | 'web_research' | 'fundamental'
}

export interface WebResearchResult {
  syllabusTopics: string[]
  importantConcepts: string[]
  missingTopics: string[]
  sources: WebSource[]
}

export interface WebSource {
  title: string
  url: string
  type: 'syllabus' | 'textbook' | 'academic' | 'educational'
  relevance: number
}

/**
 * Main analysis function - analyzes question papers and optionally performs web research
 */
export async function analyzeQuestionPapers(
  papers: QuestionPaperWithQuestions[],
  subjectId: string | null,
  userId: string,
  options: {
    enableWebResearch?: boolean
    subjectName?: string
    semester?: string
    academicYear?: string
    additionalInstructions?: string
  } = {}
): Promise<AnalysisResult> {
  const allQuestions = papers.flatMap(p => p.questions)
  
  // 1. Exact repeat detection
  const exactGroups = new Map<string, ExtractedQuestion[]>()
  allQuestions.forEach(q => {
    const normalized = normalizeQuestionText(q.text)
    if (!exactGroups.has(normalized)) exactGroups.set(normalized, [])
    exactGroups.get(normalized)!.push(q)
  })
  
  let exactRepeats = 0
  exactGroups.forEach(group => {
    if (group.length > 1) exactRepeats += group.length - 1
  })

  // 2. Semantic similarity using embeddings
  let semanticRepeats = 0
  const semanticGroups: { q1: string; q2: string; similarity: number }[] = []
  
  try {
    const { getUserEmbeddingProvider } = await import('@/lib/ai/embeddings')
    const embeddingProvider = await getUserEmbeddingProvider(userId)
    
    if (embeddingProvider && allQuestions.length > 0) {
      const texts = allQuestions.map(q => q.text)
      const batchSize = 50
      const questionEmbeddings = new Map<string, number[]>()
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const result = await embeddingProvider.provider.generateEmbeddings(batch)
        batch.forEach((text, idx) => {
          const question = allQuestions.find(q => q.text === text)
          if (question && result.embeddings[idx]) {
            questionEmbeddings.set(question.id, result.embeddings[idx])
          }
        })
      }
      
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
                q1: questionIds[i],
                q2: questionIds[j],
                similarity,
              })
            }
          }
        }
      }
    }
  } catch (embeddingError) {
    console.warn('[ImportantQuestions] Embedding-based semantic analysis failed, falling back to keyword matching:', embeddingError)
    // Fallback to keyword-based
    const keywordGroups = new Map<string, ExtractedQuestion[]>()
    allQuestions.forEach(q => {
      const keywords = extractKeywords(q.text)
      const key = keywords.slice(0, 5).sort().join(',')
      if (!keywordGroups.has(key)) keywordGroups.set(key, [])
      keywordGroups.get(key)!.push(q)
    })
    keywordGroups.forEach(group => {
      if (group.length > 1) semanticRepeats += group.length - 1
    })
  }

  // 3. Distribution analysis
  const unitDistribution = new Map<string, number>()
  const topicDistribution = new Map<string, number>()
  const marksDistribution = new Map<number, number>()
  const yearDistribution = new Map<number, number>()
  const questionTypeDistribution = new Map<string, number>()

  allQuestions.forEach(q => {
    if (q.unit) unitDistribution.set(q.unit, (unitDistribution.get(q.unit) || 0) + 1)
    if (q.topic) topicDistribution.set(q.topic, (topicDistribution.get(q.topic) || 0) + 1)
    if (q.marks) marksDistribution.set(q.marks, (marksDistribution.get(q.marks) || 0) + 1)
    if (q.year) yearDistribution.set(q.year, (yearDistribution.get(q.year) || 0) + 1)
    if (q.questionType) questionTypeDistribution.set(q.questionType, (questionTypeDistribution.get(q.questionType) || 0) + 1)
  })

  // 4. Build priority items by concept/topic grouping
  const questionMap = new Map<string, ExtractedQuestion[]>()
  allQuestions.forEach(q => {
    const key = q.concept || q.topic || q.unit || 'General'
    if (!questionMap.has(key)) questionMap.set(key, [])
    questionMap.get(key)!.push(q)
  })

  const currentYear = new Date().getFullYear()
  const priorityItems: PriorityItem[] = Array.from(questionMap.entries()).map(([concept, group]) => {
    const frequency = group.length
    const papersContaining = new Set(group.map(q => q.questionPaperId)).size
    const totalMarks = group.reduce((sum, q) => sum + (q.marks || 0), 0)
    const avgMarks = totalMarks / group.length
    const years = group.filter(q => q.year).map(q => q.year!)
    const firstYear = years.length > 0 ? Math.min(...years) : null
    const lastYear = years.length > 0 ? Math.max(...years) : null
    const units = [...new Set(group.map(q => q.unit).filter(Boolean))]
    const topics = [...new Set(group.map(q => q.topic).filter(Boolean))]
    const concepts = [...new Set(group.map(q => q.concept).filter(Boolean))]
    const questionTypes = [...new Set(group.map(q => q.questionType).filter(Boolean))]

    // Calculate priority scores
    const frequencyScore = Math.min(frequency / 5, 1)
    const recencyScore = lastYear ? Math.max(0, 1 - (currentYear - lastYear) / 10) : 0.5
    const marksWeight = Math.min(avgMarks / 20, 1)
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
    if (lastYear && lastYear >= currentYear - 2) reasonParts.push(`Recent (${lastYear})`)
    if (avgMarks >= 10) reasonParts.push(`High marks (avg ${avgMarks.toFixed(1)})`)
    const reason = reasonParts.join('; ') || 'Limited historical data'

    const exactGroup = exactGroups.get(normalizeQuestionText(group[0].text))
    const isExactRepeat = (exactGroup?.length || 0) > 1

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
      isExactRepeat,
      matchedQuestionIds: group.slice(1).map(q => q.id),
      recencyScore,
      marksWeight,
      unitRelevance,
      source: 'historical' as const,
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

  // AI-powered analysis with additional instructions (if provided)
  if (options.additionalInstructions && options.additionalInstructions.trim()) {
    try {
      const aiAnalysis = await performAIAnalysis({
        papers,
        allQuestions,
        priorityItems: priorityItems.slice(0, 30), // Top 30 items
        additionalInstructions: options.additionalInstructions,
        subjectName: options.subjectName,
      }, userId)
      
      // Merge AI-generated priority items with existing ones
      if (aiAnalysis && aiAnalysis.enhancedItems.length > 0) {
        // Add new items from AI analysis
        for (const aiItem of aiAnalysis.enhancedItems) {
          // Check if similar item already exists
          const exists = priorityItems.some(p => 
            normalizeQuestionText(p.questionText) === normalizeQuestionText(aiItem.questionText)
          )
          if (!exists) {
            priorityItems.push(aiItem)
          }
        }
        
        // Re-sort after adding AI items
        priorityItems.sort((a, b) => {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
          if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority]
          }
          return b.frequency - a.frequency
        })
      }
    } catch (aiError) {
      console.warn('[ImportantQuestions] AI analysis with additional instructions failed:', aiError)
      // Continue without AI enhancement
    }
  }

  // 5. Web Research Integration (if enabled)
  let webResearch: WebResearchResult | undefined
  if (options.enableWebResearch && options.subjectName) {
    webResearch = await performWebResearch({
      subjectName: options.subjectName,
      semester: options.semester,
      academicYear: options.academicYear,
      existingTopics: Array.from(topicDistribution.keys()),
      existingConcepts: Array.from(new Set(allQuestions.map(q => q.concept).filter(Boolean))),
    }, userId)
    
    // Add web-research-based priority items
    if (webResearch) {
      const webPriorityItems = webResearch.importantConcepts.map(concept => ({
        questionId: `web-${concept.replace(/\s+/g, '-').toLowerCase()}`,
        questionText: `Fundamental concept: ${concept}`,
        concept,
        priority: 'HIGH' as const,
        reason: 'Identified as fundamental through syllabus/web research',
        frequency: 0,
        papersCount: 0,
        totalMarks: 0,
        avgMarks: 0,
        firstYear: null,
        lastYear: null,
        units: [],
        topics: [concept],
        concepts: [concept],
        questionTypes: [],
        isExactRepeat: false,
        matchedQuestionIds: [],
        recencyScore: 1,
        marksWeight: 0.5,
        unitRelevance: 1,
        source: 'web_research' as const,
      }))
      priorityItems.push(...webPriorityItems)
    }
  }

  return {
    exactRepeats,
    semanticRepeats,
    unitDistribution: Object.fromEntries(unitDistribution),
    topicDistribution: Object.fromEntries(topicDistribution),
    marksDistribution: Object.fromEntries(marksDistribution),
    yearDistribution: Object.fromEntries(yearDistribution),
    questionTypeDistribution: Object.fromEntries(questionTypeDistribution),
    totalQuestions: allQuestions.length,
    totalPapers: papers.length,
    priorityItems,
    webResearch,
  }
}

/**
 * Perform web research for subject syllabus and important concepts
 * Uses AI to search and synthesize information from academic sources
 */
async function performWebResearch(
  params: {
    subjectName: string
    semester?: string
    academicYear?: string
    existingTopics: string[]
    existingConcepts: string[]
  },
  userId: string
): Promise<WebResearchResult | undefined> {
  try {
    // Use AI to generate web research queries and analyze results
    // This would integrate with a web search API if available
    // For now, we use AI knowledge to identify fundamental concepts
    
    const { generateStructuredOutput } = await import('@/lib/ai/service')
    
    const result = await generateStructuredOutput<{
      syllabusTopics: string[]
      importantConcepts: string[]
      missingTopics: string[]
      sources: WebSource[]
    }>({
      userId,
      provider: undefined, // Use default
      model: undefined,
      systemPrompt: `You are an academic curriculum expert. Given a subject name and existing topics from question papers, identify:
1. Standard syllabus topics for this subject at university level
2. Fundamental concepts that should be covered but may be missing from past papers
3. Authoritative sources for this subject (textbooks, syllabi, academic references)

Be specific to the subject. Do not fabricate sources. If you don't have specific knowledge, indicate uncertainty.`,
      schemaDescription: `{
  "syllabusTopics": ["Topic 1", "Topic 2"],
  "importantConcepts": ["Concept 1", "Concept 2"],
  "missingTopics": ["Missing 1", "Missing 2"],
  "sources": [
    {"title": "Source title", "url": "https://example.com", "type": "syllabus|textbook|academic|educational", "relevance": 0.9}
  ]
}`,
      prompt: `Subject: ${params.subjectName}
${params.semester ? `Semester: ${params.semester}` : ''}
${params.academicYear ? `Academic Year: ${params.academicYear}` : ''}

Existing topics from question papers: ${params.existingTopics.slice(0, 20).join(', ') || 'None'}
Existing concepts: ${params.existingConcepts.slice(0, 20).join(', ') || 'None'}

Identify:
1. Standard syllabus topics for this subject
2. Fundamental concepts that are important but may not appear frequently in past papers
3. Reputable academic sources (university syllabi, standard textbooks, educational portals)

Only include concepts you are confident about. Mark uncertain ones.`,
      validate: (parsed) => {
        return {
          syllabusTopics: Array.isArray(parsed.syllabusTopics) ? parsed.syllabusTopics.filter(t => typeof t === 'string') : [],
          importantConcepts: Array.isArray(parsed.importantConcepts) ? parsed.importantConcepts.filter(t => typeof t === 'string') : [],
          missingTopics: Array.isArray(parsed.missingTopics) ? parsed.missingTopics.filter(t => typeof t === 'string') : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources.filter(s => s && typeof s.title === 'string' && typeof s.url === 'string') : [],
        }
      },
    })
    
    return result.data
  } catch (error) {
    console.warn('[ImportantQuestions] Web research failed:', error)
    return undefined
  }
}

/**
 * Generate Important Questions Report Data for PDF
 */
export async function generateImportantQuestionsReportData(
  analysisId: string,
  userId: string
): Promise<{
  subject: { name: string; code: string } | null
  semester: string | null
  academicYear: string | null
  analysis: any
  papers: QuestionPaperWithQuestions[]
  generatedAt: Date
} | null> {
  const analysis = await prisma.questionAnalysis.findFirst({
    where: { id: analysisId, userId },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      priorityItems: true,
      analysisData: true,
    },
  })
  
  if (!analysis) return null
  
  // Fetch source papers
  const papers = await prisma.questionPaper.findMany({
    where: { id: { in: analysis.paperIds as string[] }, userId },
    include: {
      questions: true,
      subject: { select: { id: true, name: true, code: true } },
    },
  })
  
  return {
    subject: analysis.subject,
    semester: analysis.subject ? 'N/A' : null, // Could be derived from papers
    academicYear: analysis.subject ? 'N/A' : null,
    analysis: {
      ...analysis,
      priorityItems: analysis.priorityItems,
      analysisData: analysis.analysisData,
    },
    papers: papers as QuestionPaperWithQuestions[],
    generatedAt: new Date(),
  }
}

// Helper functions
function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 10)
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Perform AI-powered analysis with additional user instructions
 */
async function performAIAnalysis(
  params: {
    papers: QuestionPaperWithQuestions[]
    allQuestions: ExtractedQuestion[]
    priorityItems: PriorityItem[]
    additionalInstructions: string
    subjectName?: string
  },
  userId: string
): Promise<{ enhancedItems: PriorityItem[] } | null> {
  try {
    const { generateStructuredOutput } = await import('@/lib/ai/service')
    
    // Prepare context from papers and questions
    const paperContext = params.papers.map(p => 
      `${p.title} (${p.paperType}${p.examinationYear ? `, ${p.examinationYear}` : ''}${p.marks ? `, ${p.marks} marks` : ''}): ${p.questions.length} questions`
    ).join('\n')
    
    const questionSummary = params.allQuestions
      .slice(0, 50)
      .map(q => `${q.questionNumber}: ${q.text.slice(0, 150)} (Marks: ${q.marks || '?'}, Unit: ${q.unit || '?'}, Topic: ${q.topic || '?'})`)
      .join('\n')
    
    const priorityContext = params.priorityItems
      .slice(0, 15)
      .map(p => `[${p.priority}] ${p.concept} - ${p.reason} (Freq: ${p.frequency}, Papers: ${p.papersCount})`)
      .join('\n')

    const result = await generateStructuredOutput<{
      enhancedItems: Array<{
        questionId: string
        questionText: string
        concept: string
        priority: 'HIGH' | 'MEDIUM' | 'LOW'
        reason: string
        frequency: number
        papersCount: number
        totalMarks: number
        avgMarks: number
        firstYear: number | null
        lastYear: number | null
        units: string[]
        topics: string[]
        concepts: string[]
        questionTypes: string[]
        isExactRepeat: boolean
        matchedQuestionIds: string[]
        recencyScore: number
        marksWeight: number
        unitRelevance: number
        source: 'ai_enhanced'
      }>
    }>({
      userId,
      provider: undefined,
      model: undefined,
      systemPrompt: `You are ALEX, an expert academic question paper analyzer. You have access to:
1. Uploaded question papers with extracted questions
2. Statistical analysis of question patterns (frequency, repeats, distributions)
3. User's additional instructions for focused analysis

Your task: Generate ADDITIONAL important question concepts that address the user's specific instructions, based on the uploaded papers. Do NOT duplicate existing priority items.

Guidelines:
- Focus on the user's additional instructions (e.g., "focus on 10-mark questions", "prioritize Unit 3", "find repeated concepts")
- Generate NEW concept entries that complement the statistical analysis
- Each entry should have a clear question/concept text, priority, and reason
- The reason should explain how the user's instructions influenced this finding
- Use 'ai_enhanced' as source type
- Limit to 5-10 high-quality new items`,
      schemaDescription: `{
  "enhancedItems": [
    {
      "questionId": "ai-1",
      "questionText": "Detailed question or concept description",
      "concept": "Concept name",
      "priority": "HIGH",
      "reason": "Explanation of why this matches user's instructions",
      "frequency": 1,
      "papersCount": 1,
      "totalMarks": 10,
      "avgMarks": 10,
      "firstYear": 2023,
      "lastYear": 2023,
      "units": ["Unit 3"],
      "topics": ["Topic name"],
      "concepts": ["Concept name"],
      "questionTypes": ["LONG_ANSWER"],
      "isExactRepeat": false,
      "matchedQuestionIds": [],
      "recencyScore": 0.8,
      "marksWeight": 0.5,
      "unitRelevance": 1,
      "source": "ai_enhanced"
    }
  ]
}`,
      prompt: `Subject: ${params.subjectName || 'General'}
Papers Analyzed: ${params.papers.length}
Total Questions: ${params.allQuestions.length}

PAPERS:
${paperContext}

EXTRACTED QUESTIONS (sample):
${questionSummary}

EXISTING PRIORITY ITEMS (from statistical analysis):
${priorityContext}

USER'S ADDITIONAL INSTRUCTIONS:
${params.additionalInstructions}

Generate additional priority items that specifically address the user's instructions. For example:
- If user wants "focus on 10-mark questions", identify high-mark concepts
- If user wants "prioritize Unit 3", find Unit 3 concepts with evidence
- If user wants "repeated concepts across papers", find cross-paper patterns
- If user wants "likely next exam questions", identify trends and gaps

Return up to 10 new items with source: "ai_enhanced"`,
      validate: (parsed) => {
        if (!parsed || !Array.isArray(parsed.enhancedItems)) {
          throw new Error('Model did not return valid enhancedItems array')
        }
        return {
          enhancedItems: parsed.enhancedItems.map((item: any) => ({
            questionId: String(item.questionId || `ai-${Date.now()}-${Math.random()}`).trim(),
            questionText: String(item.questionText || '').trim(),
            concept: String(item.concept || '').trim(),
            priority: ['HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'MEDIUM',
            reason: String(item.reason || '').trim(),
            frequency: typeof item.frequency === 'number' ? item.frequency : 1,
            papersCount: typeof item.papersCount === 'number' ? item.papersCount : 1,
            totalMarks: typeof item.totalMarks === 'number' ? item.totalMarks : 0,
            avgMarks: typeof item.avgMarks === 'number' ? item.avgMarks : 0,
            firstYear: typeof item.firstYear === 'number' ? item.firstYear : null,
            lastYear: typeof item.lastYear === 'number' ? item.lastYear : null,
            units: Array.isArray(item.units) ? item.units.map(String) : [],
            topics: Array.isArray(item.topics) ? item.topics.map(String) : [],
            concepts: Array.isArray(item.concepts) ? item.concepts.map(String) : [],
            questionTypes: Array.isArray(item.questionTypes) ? item.questionTypes.map(String) : [],
            isExactRepeat: Boolean(item.isExactRepeat),
            matchedQuestionIds: Array.isArray(item.matchedQuestionIds) ? item.matchedQuestionIds.map(String) : [],
            recencyScore: typeof item.recencyScore === 'number' ? item.recencyScore : 0.5,
            marksWeight: typeof item.marksWeight === 'number' ? item.marksWeight : 0.5,
            unitRelevance: typeof item.unitRelevance === 'number' ? item.unitRelevance : 0.5,
            source: 'ai_enhanced' as const,
          })).filter((item: any) => item.questionText.length > 0 && item.concept.length > 0),
        }
      },
    })
    
    return result.data
  } catch (error) {
    console.warn('[ImportantQuestions] AI analysis failed:', error)
    return null
  }
}