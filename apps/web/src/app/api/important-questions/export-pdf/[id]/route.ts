import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateImportantQuestionsPDF } from '@/lib/important-questions/pdf-generator'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Fetch analysis with all related data
    const analysis = await prisma.questionAnalysis.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        priorityItems: true,
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    // Fetch source papers with questions
    const papers = await prisma.questionPaper.findMany({
      where: { id: { in: analysis.paperIds as string[] }, userId: user.id },
      include: {
        questions: true,
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    // Prepare report data
    const reportData = {
      subject: analysis.subject,
      semester: null, // Could be derived from papers if needed
      academicYear: null,
      analysis: {
        title: analysis.title,
        totalQuestions: analysis.totalQuestions,
        exactRepeats: analysis.exactRepeats,
        semanticRepeats: analysis.semanticRepeats,
        paperIds: analysis.paperIds,
        priorityItems: analysis.priorityItems,
        analysisData: analysis.analysisData,
        webResearch: (analysis.analysisData as any)?.webResearch,
      },
      papers: papers as any,
      generatedAt: new Date(),
    }

    // Generate PDF
    const pdfBuffer = await generateImportantQuestionsPDF(reportData)

    // Return PDF as download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="important-questions-${analysis.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] PDF export error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}