import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies } from '@/lib/study-studio/important-questions-v2';
import { validateUpload, MAX_FILE_BYTES } from '@/lib/study-studio/important-questions-v2/types';
import { deleteFile } from '@/lib/storage/client';

export async function GET() {
  try {
    const user = await requireAuth();

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const docs = await deps.repository.listDocuments(user.id, []);
    
    // Note: listDocuments requires IDs, but we want all. Let's use a different approach
    const { prisma } = await import('@/lib/prisma');
    const papers = await prisma.questionPaper.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        storagePath: true,
        paperType: true,
        subjectId: true,
        semester: true,
        unit: true,
        academicYear: true,
        examinationYear: true,
        marks: true,
        status: true,
        pageCount: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json({ papers });
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

    // Parse shared metadata (defaults for all files)
    const sharedPaperType = (formData.get('paperType') as string) || 'QB';
    const sharedSubjectId = (formData.get('subjectId') as string) || null;
    const sharedSemester = (formData.get('semester') as string) || null;
    const sharedUnit = (formData.get('unit') as string) || null;
    const sharedAcademicYear = (formData.get('academicYear') as string) || null;
    const sharedExaminationYear = formData.get('examinationYear') ? parseInt(formData.get('examinationYear') as string) : null;
    const sharedMarks = formData.get('marks') ? parseInt(formData.get('marks') as string) : null;

    // Parse per-file metadata overrides (format: file_0_title, file_0_paperType, etc.)
    const perFileMetadata: Map<number, Record<string, string>> = new Map();
    for (const [key, value] of formData.entries()) {
      const match = key.match(/^file_(\d+)_(.+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        const field = match[2];
        if (!perFileMetadata.has(index)) {
          perFileMetadata.set(index, {});
        }
        perFileMetadata.get(index)![field] = value as string;
      }
    }

    // Create dependencies
    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));

    const results: Array<{ id: string; fileName: string; status: string; error?: string }> = [];
    const storageKeys: string[] = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let storageKey: string | null = null;
      
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());

        // Upload to storage
        const storageResult = await deps.storage.put({
          ownerId: user.id,
          fileName: file.name,
          mimeType: file.type,
          bytes,
        });
        storageKey = storageResult.storageKey;
        storageKeys.push(storageKey);

        // Get per-file metadata overrides
        const fileMeta = perFileMetadata.get(i) || {};
        
        // Create document record with per-file metadata (falls back to shared)
        const paperType = (fileMeta.paperType === 'QB' || fileMeta.paperType === 'PYQ') ? fileMeta.paperType : sharedPaperType;
        const subjectId = fileMeta.subjectId || sharedSubjectId;
        const semester = fileMeta.semester || sharedSemester;
        const unit = fileMeta.unit || sharedUnit;
        const academicYear = fileMeta.academicYear || sharedAcademicYear;
        const examinationYear = fileMeta.examinationYear ? parseInt(fileMeta.examinationYear) : sharedExaminationYear;
        const marks = fileMeta.marks ? parseInt(fileMeta.marks) : sharedMarks;

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
        
        // Cleanup storage if DB record creation failed
        if (storageKey) {
          try {
            await deleteFile('documents', storageKey);
          } catch (cleanupError) {
            console.warn('[ImportantQuestionsV2] Storage cleanup failed:', cleanupError);
          }
        }
        
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