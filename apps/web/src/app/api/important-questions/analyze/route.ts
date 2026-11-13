import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'
import { analyzeQuestionPapers } from '@/lib/important-questions/analyzer'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { paperIds, subjectId, enableWebResearch, subjectName, semester, academicYear, additionalInstructions } = body

    if (!paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one paperId is required' },
        { status: 400 }
      )
    }

    // Fetch all questions from selected papers
    const papers = await prisma.questionPaper.findMany({
      where: { id: { in: paperIds }, userId: user.id },
      include: { 
        questions: true,
        subject: { select: { id: true, name: true, code: true } }
      },
    })

    if (papers.length === 0) {
      return NextResponse.json({ error: 'No valid papers found' }, { status: 404 })
    }

    // Collect additional instructions from papers
    const paperInstructions = papers
      .map(p => p.metadata?.additionalInstructions)
      .filter(Boolean)
      .join('\n\n')
    
    const combinedInstructions = [additionalInstructions, paperInstructions]
      .filter(Boolean)
      .join('\n\n')

    // Perform comprehensive analysis
    const analysisResult = await analyzeQuestionPapers(
      papers as any,
      subjectId || papers[0]?.subjectId || null,
      user.id,
      {
        enableWebResearch: enableWebResearch || false,
        subjectName: subjectName || papers[0]?.subject?.name,
        semester,
        academicYear,
        additionalInstructions: combinedInstructions || undefined,
      }
    )

    // Save analysis
    const analysis = await prisma.questionAnalysis.create({
      data: {
        userId: user.id,
        title: body.title || `Analysis of ${papers.length} paper(s) - ${new Date().toLocaleDateString()}`,
        subjectId: subjectId || papers[0]?.subjectId || null,
        paperIds,
        totalQuestions: analysisResult.totalQuestions,
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
    console.error('[ImportantQuestions] Batch analyze error:', error)
    return NextResponse.json({ error: 'Failed to analyze question papers' }, { status: 500 })
  }
}