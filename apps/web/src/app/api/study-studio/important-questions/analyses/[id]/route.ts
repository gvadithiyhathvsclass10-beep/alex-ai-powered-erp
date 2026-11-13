import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, getAnalysis, deleteAnalysis } from '@/lib/study-studio/important-questions-v2';

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

    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Analysis GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analysis' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    await deleteAnalysis(deps, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } }, { status: 404 });
    }
    console.error('[ImportantQuestionsV2] Analysis DELETE error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete analysis' } },
      { status: 500 }
    );
  }
}