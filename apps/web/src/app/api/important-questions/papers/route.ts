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

    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const paperType = formData.get('paperType') as string // 'QB' | 'PYQ'
    const subjectId = formData.get('subjectId') as string | null
    const semester = formData.get('semester') as string | null
    const unit = formData.get('unit') as string | null
    const academicYear = formData.get('academicYear') as string | null
    const examinationYear = formData.get('examinationYear') as string | null
    const marks = formData.get('marks') as string | null

    if (!file || !title || !paperType) {
      return NextResponse.json(
        { error: 'File, title, and paperType are required' },
        { status: 400 }
      )
    }

    if (!['QB', 'PYQ'].includes(paperType)) {
      return NextResponse.json(
        { error: 'paperType must be QB or PYQ' },
        { status: 400 }
      )
    }

    // Store file (in production, this would upload to S3/R2)
    const buffer = await file.arrayBuffer()
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const storagePath = `important-questions/${user.id}/${fileName}`

    // For now, we'll store as base64 in metadata (in production, use proper storage)
    const base64Data = Buffer.from(buffer).toString('base64')

    const paper = await prisma.questionPaper.create({
      data: {
        userId: user.id,
        title: title.trim(),
        fileName: file.name,
        fileSize: BigInt(file.size),
        mimeType: file.type,
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
          originalName: file.name,
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ paper: serializeBigInt(paper) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper create error:', error)
    return NextResponse.json({ error: 'Failed to create question paper' }, { status: 500 })
  }
}