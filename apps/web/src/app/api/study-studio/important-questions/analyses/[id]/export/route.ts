import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, getAnalysis, renderAnalysisPdf } from '@/lib/study-studio/important-questions-v2';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const analysis = await getAnalysis(deps, id);

    if (!analysis) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } }, { status: 404 });
    }

    const pdfBuffer = await renderAnalysisPdf(analysis);

    const filename = `important-questions-${analysis.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] PDF export error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate PDF' } },
      { status: 500 }
    );
  }
}