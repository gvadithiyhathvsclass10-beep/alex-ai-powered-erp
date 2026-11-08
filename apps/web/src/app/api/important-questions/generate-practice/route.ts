import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'
import {
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const {
      sourceAnalysisId,
      paperType, // 'PRACTICE' | 'MOCK' | 'PREDICTED' | 'UNIT_WISE'
      title,
      subjectId,
      unit,
      questionCount = 10,
      totalMarks = 100,
      durationMinutes,
      difficulty,
      questionTypes, // Array of question types to include
    } = body

    if (!title || !paperType) {
      return NextResponse.json(
        { error: 'Title and paperType are required' },
        { status: 400 }
      )
    }

    // Fetch source analysis if provided
    let analysisData: any = null
    let highPriorityQuestions: any[] = []
    let sourceQuestions: any[] = []

    if (sourceAnalysisId) {
      const analysis = await prisma.questionAnalysis.findFirst({
        where: { id: sourceAnalysisId, userId: user.id },
        include: {
          priorityItems: {
            where: { priority: { in: ['HIGH', 'MEDIUM'] } },
            orderBy: { priority: 'desc' },
          },
        },
      })

      if (analysis) {
        analysisData = analysis.analysisData
        highPriorityQuestions = analysis.priorityItems

        // Also get source questions for context
        const papers = await prisma.questionPaper.findMany({
          where: { id: { in: analysis.paperIds as string[] } },
          include: { questions: true },
        })
        sourceQuestions = papers.flatMap(p => p.questions)
      }
    }

    // Build prompt for AI generation
    const practiceQuestions = await generatePracticeQuestions(
      user.id,
      paperType,
      questionCount,
      totalMarks,
      highPriorityQuestions,
      sourceQuestions,
      unit,
      difficulty,
      questionTypes,
      body.provider,
      body.model
    )

    const practicePaper = await prisma.generatedPracticePaper.create({
      data: {
        userId: user.id,
        title: title.trim(),
        sourceAnalysisId: sourceAnalysisId || null,
        paperType,
        subjectId: subjectId || null,
        unit: unit || null,
        questions: practiceQuestions as any,
        totalMarks,
        durationMinutes: durationMinutes || null,
        metadata: {
          sourceAnalysisId: sourceAnalysisId || null,
          generatedAt: new Date().toISOString(),
          aiGenerated: true,
        },
      },
    })

    return NextResponse.json({ practicePaper: serializeBigInt(practicePaper) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Generate practice error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate practice paper')
    return NextResponse.json(
      { error: formatted.body.error, code: formatted.body.code },
      { status: formatted.status }
    )
  }
}

async function generatePracticeQuestions(
  userId: string,
  paperType: string,
  questionCount: number,
  totalMarks: number,
  highPriorityQuestions: any[],
  sourceQuestions: any[],
  unit: string | undefined,
  difficulty: string | undefined,
  questionTypes: string[] | undefined,
  provider?: string,
  model?: string
) {
  const marksPerQuestion = Math.floor(totalMarks / questionCount)
  const remainingMarks = totalMarks % questionCount

  // Build context from high-priority questions
  const priorityContext = highPriorityQuestions
    .slice(0, 20)
    .map((item, idx) => `${idx + 1}. [${item.priority}] ${item.questionText.slice(0, 200)} (Freq: ${item.frequency}, Avg Marks: ${item.avgMarks.toFixed(1)})`)
    .join('\n')

  const sourceContext = sourceQuestions
    .slice(0, 30)
    .map((q, idx) => `${idx + 1}. ${q.text.slice(0, 150)} (Marks: ${q.marks || '?'}, Unit: ${q.unit || '?'}, Year: ${q.year || '?'})`)
    .join('\n')

  const unitFilter = unit ? ` Focus on unit: ${unit}.` : ''
  const difficultyFilter = difficulty ? ` Target difficulty: ${difficulty}.` : ''
  const typeFilter = questionTypes && questionTypes.length > 0
    ? ` Include question types: ${questionTypes.join(', ')}.`
    : ''

  const systemPrompt = `You are ALEX, an expert academic question paper generator. Create practice questions based on historical question patterns.
  
  Guidelines:
  - Generate questions that test the SAME CONCEPTS as high-priority historical questions
  - DO NOT copy exact questions from the source material
  - Create NEW questions that assess similar knowledge and skills
  - Vary question types appropriately (MCQ, short answer, long answer, numerical)
  - Clearly label each question as AI-GENERATED PRACTICE MATERIAL
  - Provide marks allocation matching the requested distribution
  - Include model answers / marking schemes
  - Questions should be at appropriate academic level`

  const schemaDescription = `{
  "questions": [
    {
      "id": "q-1",
      "prompt": "Question text...",
      "type": "LONG_ANSWER",
      "marks": 10,
      "unit": "Unit 1",
      "topic": "Newton's Laws",
      "concept": "Force and Motion",
      "difficulty": "MEDIUM",
      "modelAnswer": "Expected answer...",
      "markingScheme": ["Point 1: 3 marks", "Point 2: 4 marks", "Point 3: 3 marks"],
      "isAiGenerated": true,
      "sourceConceptRef": "priority-item-id"
    }
  ]
}`

  const prompt = `Generate ${questionCount} practice questions for a ${paperType} paper${unitFilter}${difficultyFilter}${typeFilter}
  
  Total marks: ${totalMarks} (≈${marksPerQuestion} marks per question)
  
  HIGH-PRIORITY CONCEPTS FROM HISTORICAL ANALYSIS:
  ${priorityContext || 'No historical analysis provided'}
  
  SOURCE QUESTIONS FOR PATTERN REFERENCE:
  ${sourceContext || 'No source questions provided'}
  
  Requirements:
  1. Each question must test concepts from the high-priority list
  2. Questions must be NEW (not copies of source questions)
  3. Distribute marks appropriately (some ${marksPerQuestion}, some ${marksPerQuestion + 1})
  4. Include clear model answers and marking schemes
  5. Label all questions as AI-generated practice material
  6. Reference which priority concept each question addresses`

  const structured = await generateStructuredOutput<{
    questions: Array<{
      id: string
      prompt: string
      type: string
      marks: number
      unit?: string
      topic?: string
      concept?: string
      difficulty?: string
      modelAnswer: string
      markingScheme: string[]
      isAiGenerated: boolean
      sourceConceptRef?: string
    }>
  }>({
    userId,
    provider,
    model,
    systemPrompt,
    schemaDescription,
    prompt,
    validate: (parsed) => {
      if (!parsed || !Array.isArray(parsed.questions)) {
        throw new Error('Model did not return valid questions array')
      }
      return {
        questions: parsed.questions.slice(0, questionCount).map((q: any, idx: number) => ({
          id: q.id || `q-${idx + 1}`,
          prompt: String(q.prompt || '').trim(),
          type: String(q.type || 'SHORT_ANSWER').trim(),
          marks: typeof q.marks === 'number' ? q.marks : marksPerQuestion,
          unit: q.unit ? String(q.unit).trim() : unit,
          topic: q.topic ? String(q.topic).trim() : undefined,
          concept: q.concept ? String(q.concept).trim() : undefined,
          difficulty: q.difficulty ? String(q.difficulty).trim() : difficulty || 'MEDIUM',
          modelAnswer: String(q.modelAnswer || '').trim(),
          markingScheme: Array.isArray(q.markingScheme) ? q.markingScheme.map(String) : [],
          isAiGenerated: true,
          sourceConceptRef: q.sourceConceptRef || undefined,
        })),
      }
    },
  })

  // Adjust marks to match total exactly
  const questions = structured.data.questions
  let currentTotal = questions.reduce((sum, q) => sum + q.marks, 0)
  if (currentTotal !== totalMarks && questions.length > 0) {
    const diff = totalMarks - currentTotal
    questions[0].marks += diff
  }

  return questions
}