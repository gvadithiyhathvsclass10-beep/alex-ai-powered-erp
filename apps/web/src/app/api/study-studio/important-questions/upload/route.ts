import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage/client'
import { validateUploadedFile, getMaxUploadSizeBytes } from '@/lib/document-processing/extractors'

interface UploadedPaperResult {
  id: string
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  paperType: 'QB' | 'PYQ'
  subjectId: string | null
  status: string
  storagePath: string
  uploadStatus: 'success' | 'error'
  errorMessage?: string
  extractionStatus?: 'pending' | 'completed' | 'error'
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const formData = await request.formData()

    // Support both single file and multiple files
    const files = formData.getAll('files') as File[]
    const file = formData.get('file') as File | null
    const existingPaperIds = formData.getAll('existingPaperIds') as string[]

    const allFiles = [...(files.length > 0 ? files : []), ...(file ? [file] : [])].filter(Boolean)

    if (allFiles.length === 0 && existingPaperIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one file or existing paper ID is required' },
        { status: 400 }
      )
    }

    // Parse metadata
    const sharedTitle = formData.get('title') as string
    const sharedPaperType = formData.get('paperType') as string
    const sharedSubjectId = formData.get('subjectId') as string | null
    const sharedSemester = formData.get('semester') as string | null
    const sharedUnit = formData.get('unit') as string | null
    const sharedAcademicYear = formData.get('academicYear') as string | null
    const sharedExaminationYear = formData.get('examinationYear') as string | null
    const sharedMarks = formData.get('marks') as string | null

    // For multiple files, title is optional - we'll use individual filenames
    if (allFiles.length > 1 && !sharedTitle) {
      // Title is optional for multiple files
    }

    // Validate paperType
    if (!['QB', 'PYQ'].includes(sharedPaperType)) {
      return NextResponse.json(
        { error: 'paperType must be QB or PYQ' },
        { status: 400 }
      )
    }

    // Validate subject ownership if provided
    if (sharedSubjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: sharedSubjectId },
        select: { id: true }
      })
      if (!subject) {
        return NextResponse.json(
          { error: 'Subject not found' },
          { status: 404 }
        )
      }
    }

    // Validate each file
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown'
    ]
    const maxSize = getMaxUploadSizeBytes()

    const validationErrors: string[] = []
    for (let i = 0; i < allFiles.length; i++) {
      const currentFile = allFiles[i]
      if (!allowedTypes.includes(currentFile.type)) {
        validationErrors.push(`File "${currentFile.name}": Unsupported file type "${currentFile.type}". Supported: PDF, DOCX, DOC, TXT, MD`)
      }
      if (currentFile.size > maxSize) {
        validationErrors.push(`File "${currentFile.name}": Exceeds ${Math.round(maxSize / (1024 * 1024))}MB limit`)
      }
      // Content validation
      const buffer = await currentFile.arrayBuffer()
      try {
        validateUploadedFile(currentFile.name, currentFile.type, Buffer.from(buffer), maxSize)
      } catch (validationError) {
        if (validationError instanceof Error) {
          validationErrors.push(`File "${currentFile.name}": ${validationError.message}`)
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'File validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Process each file
    const results: UploadedPaperResult[] = []
    const createdPapers: any[] = []
    const storagePaths: string[] = []

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < allFiles.length; i++) {
        const currentFile = allFiles[i]

        // For multiple files, use individual filename as title base
        const currentTitle = allFiles.length > 1
          ? currentFile.name.replace(/\.[^/.]+$/, "")
          : (sharedTitle || currentFile.name.replace(/\.[^/.]+$/, ""))

        const buffer = await currentFile.arrayBuffer()
        const fileName = `${Date.now()}-${i}-${currentFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const storagePath = `important-questions/${user.id}/${fileName}`
        const fileBuffer = Buffer.from(buffer)

        // Upload to storage (S3/R2 or local)
        let storageUploadSuccess = false
        try {
          await uploadFile('documents', storagePath, fileBuffer, { contentType: currentFile.type })
          storageUploadSuccess = true
          storagePaths.push(storagePath)
        } catch (storageError) {
          console.error(`[ImportantQuestions] Storage upload error for ${currentFile.name}:`, storageError)

          // Clean up any already uploaded files for this batch
          for (const createdPath of storagePaths) {
            try {
              const { deleteFile } = await import('@/lib/storage/client')
              await deleteFile('documents', createdPath)
            } catch {}
          }

          results.push({
            id: '',
            title: currentTitle,
            fileName: currentFile.name,
            fileSize: currentFile.size.toString(),
            mimeType: currentFile.type,
            paperType: sharedPaperType as 'QB' | 'PYQ',
            subjectId: sharedSubjectId,
            status: 'FAILED',
            storagePath,
            uploadStatus: 'error',
            errorMessage: 'Failed to upload file to storage: ' + (storageError instanceof Error ? storageError.message : 'Unknown storage error')
          })
          continue
        }

        try {
          const paper = await tx.questionPaper.create({
            data: {
              userId: user.id,
              title: currentTitle.trim(),
              fileName: currentFile.name,
              fileSize: BigInt(currentFile.size),
              mimeType: currentFile.type,
              storagePath,
              storageBucket: 'documents',
              paperType: sharedPaperType as 'QB' | 'PYQ',
              subjectId: sharedSubjectId || null,
              semester: sharedSemester || null,
              unit: sharedUnit || null,
              academicYear: sharedAcademicYear || null,
              examinationYear: sharedExaminationYear ? parseInt(sharedExaminationYear) : null,
              marks: sharedMarks ? parseInt(sharedMarks) : null,
              status: 'UPLOADED',
              pageCount: null,
              metadata: {
                originalName: currentFile.name,
                uploadIndex: i,
                totalFiles: allFiles.length,
              },
            },
            include: {
              subject: { select: { id: true, name: true, code: true } },
            },
          })

          createdPapers.push(paper)

          results.push({
            id: paper.id,
            title: paper.title,
            fileName: paper.fileName,
            fileSize: paper.fileSize.toString(),
            mimeType: paper.mimeType,
            paperType: paper.paperType as 'QB' | 'PYQ',
            subjectId: paper.subjectId,
            status: paper.status,
            storagePath: paper.storagePath,
            uploadStatus: 'success',
            extractionStatus: 'pending'
          })
        } catch (dbError) {
          console.error(`[ImportantQuestions] Database create error for ${currentFile.name}:`, dbError)

          // Clean up storage for this file
          try {
            const { deleteFile } = await import('@/lib/storage/client')
            await deleteFile('documents', storagePath)
          } catch {}

          results.push({
            id: '',
            title: currentTitle,
            fileName: currentFile.name,
            fileSize: currentFile.size.toString(),
            mimeType: currentFile.type,
            paperType: sharedPaperType as 'QB' | 'PYQ',
            subjectId: sharedSubjectId,
            status: 'FAILED',
            storagePath,
            uploadStatus: 'error',
            errorMessage: 'Failed to create database record: ' + (dbError instanceof Error ? dbError.message : 'Unknown database error')
          })
        }
      }
    })

    const successfulUploads = results.filter(r => r.uploadStatus === 'success')
    const failedUploads = results.filter(r => r.uploadStatus === 'error')

    if (successfulUploads.length === 0 && failedUploads.length > 0 && allFiles.length > 0) {
      return NextResponse.json(
        {
          error: 'All file uploads failed',
          papers: [],
          results
        },
        { status: 500 }
      )
    }

    // Fetch existing papers that were selected
    let existingPapers: any[] = []
    if (existingPaperIds.length > 0) {
      existingPapers = await prisma.questionPaper.findMany({
        where: { id: { in: existingPaperIds }, userId: user.id },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { questions: true } },
        },
      })
    }

    return NextResponse.json({
      papers: [...createdPapers.map(serializeBigInt), ...existingPapers.map(serializeBigInt)],
      results,
      existingPapers: existingPapers.map(serializeBigInt),
      summary: {
        total: allFiles.length + existingPaperIds.length,
        successful: successfulUploads.length + existingPaperIds.length,
        failed: failedUploads.length
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper create error:', error)
    return NextResponse.json({
      error: 'Failed to create question paper(s)',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}