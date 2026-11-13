import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies } from '@/lib/study-studio/important-questions-v2';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));

    await deps.repository.deleteDocument(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
    }
    console.error('[ImportantQuestionsV2] Document DELETE error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' } },
      { status: 500 }
    );
  }
}