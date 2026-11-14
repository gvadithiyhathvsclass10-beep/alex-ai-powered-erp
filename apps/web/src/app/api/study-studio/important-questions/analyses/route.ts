import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, listAnalyses } from '@/lib/study-studio/important-questions-v2';

export async function GET() {
  try {
    const user = await requireAuth();

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const analyses = await listAnalyses(deps);

    return NextResponse.json({ analyses });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Analyses GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list analyses' } },
      { status: 500 }
    );
  }
}