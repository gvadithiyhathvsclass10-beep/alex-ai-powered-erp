import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await requireAuth()

    const papers = await prisma.questionPaper.findMany({
      where: { userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ papers: papers.map(serializeBigInt) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Papers list error:', error)
    return NextResponse.json({ error: 'Failed to list question papers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const formData = await request.formData()

    // Support both single file (backward compatibility) and multiple files
    const files = formData.getAll('files') as File[]
    const file = formData.get('file') as File | null
    
    const allFiles = [...(files.length > 0 ? files : []), ...(file ? [file] : [])].filter(Boolean)
    
    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 }
      )
    }

    const title = formData.get('title') as string
    const paperType = formData.get('paperType') as string
    const subjectId = formData.get('subjectId') as string | null
    const semester = formData.get('semester') as string | null
    const unit = formData.get('unit') as string | null
    const academicYear = formData.get('academicYear') as string | null
    const examinationYear = formData.get('examinationYear') as string | null
    const marks = formData.get('marks') as string | null

    // For multiple files, use the first file's title as base or require individual titles
    // For now, we'll create papers with indexed titles if multiple files
    if (allFiles.length > 1 && !title) {
      return NextResponse.json(
        { error: 'Title is required for multiple file uploads' },
        { status: 400 }
      )
    }

    if (!['QB', 'PYQ'].includes(paperType)) {
      return NextResponse.json(
        { error: 'paperType must be QB or PYQ' },
        { status: 400 }
      )
    }

    const createdPapers = []

    for (let i = 0; i < allFiles.length; i++) {
      const currentFile = allFiles[i]
      const currentTitle = allFiles.length > 1 
        ? `${title} (Part ${i + 1})` 
        : title

      const buffer = await currentFile.arrayBuffer()
      const fileName = `${Date.now()}-${i}-${currentFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const storagePath = `important-questions/${user.id}/${fileName}`
      const base64Data = Buffer.from(buffer).toString('base64')

      const paper = await prisma.questionPaper.create({
        data: {
          userId: user.id,
          title: currentTitle.trim(),
          fileName: currentFile.name,
          fileSize: BigInt(currentFile.size),
          mimeType: currentFile.type,
          storagePath,
          paperType,
          subjectId: subjectId || null,
          semester: semester || null,
          unit: unit || null,
          academicYear: academicYear || null,
          examinationYear: examinationYear ? parseInt(examinationYear) : null,
          marks: marks ? parseInt(marks) : null,
          status: 'UPLOADED',
          pageCount: null,
          metadata: {
            base64Data,
            originalName: currentFile.name,
          },
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
      })

      createdPapers.push(serializeBigInt(paper))
    }

    return NextResponse.json({ papers: createdPapers })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper create error:', error)
    return NextResponse.json({ error: 'Failed to create question paper(s)' }, { status: 500 })
  }
}