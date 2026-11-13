import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies } from '@/lib/study-studio/important-questions-v2';
import { validateUpload, MAX_FILE_BYTES } from '@/lib/study-studio/important-questions-v2/types';

export async function GET() {
  try {
    const user = await requireAuth();

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const documents = await deps.repository.listDocuments(user.id, []);

    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Documents GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list documents' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();

    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json(
        { error: { code: 'NO_FILES', message: 'At least one file is required' } },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_FILES', message: 'Maximum 10 files per request' } },
        { status: 400 }
      );
    }

    // Validate each file
    const validationErrors: string[] = [];
    for (const file of files) {
      try {
        validateUpload({ name: file.name, type: file.type, size: file.size });
      } catch (e) {
        validationErrors.push(e instanceof Error ? e.message : `Invalid file: ${file.name}`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'File validation failed', details: validationErrors } },
        { status: 400 }
      );
    }

    // Parse optional metadata
    const paperType = (formData.get('paperType') as string) || 'QB';
    const subjectId = (formData.get('subjectId') as string) || null;
    const semester = (formData.get('semester') as string) || null;
    const unit = (formData.get('unit') as string) || null;
    const academicYear = (formData.get('academicYear') as string) || null;
    const examinationYear = formData.get('examinationYear') ? parseInt(formData.get('examinationYear') as string) : null;
    const marks = formData.get('marks') ? parseInt(formData.get('marks') as string) : null;

    // Create dependencies
    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));

    const results: Array<{ id: string; fileName: string; status: string; error?: string }> = [];

    // Process each file
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());

        // Upload to storage
        const { storageKey } = await deps.storage.put({
          ownerId: user.id,
          fileName: file.name,
          mimeType: file.type,
          bytes,
        });

        // Create document record
        const doc = await deps.repository.createDocument({
          ownerId: user.id,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storageKey,
          paperType: paperType as 'QB' | 'PYQ',
          subjectId,
          semester,
          unit,
          academicYear,
          examinationYear,
          marks,
        });

        results.push({ id: doc.id, fileName: file.name, status: 'uploaded' });
      } catch (error) {
        console.error('[ImportantQuestionsV2] Upload error:', error);
        results.push({
          id: '',
          fileName: file.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const status = failedCount === files.length ? 500 : failedCount > 0 ? 207 : 200;

    return NextResponse.json(
      { documents: results },
      { status }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Documents POST error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to upload documents' } },
      { status: 500 }
    );
  }
}