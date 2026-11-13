import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { serializeBigInt } from '@/lib/prisma'
import {
  generateStructuredOutput,
  formatAIServiceErrorResponse,
} from '@/lib/ai/service'
import { extractContent } from '@/lib/document-processing/extractors'
import { downloadFile } from '@/lib/storage/client'
import { PDFDocument } from 'pdf-lib'
import { createWorker } from 'tesseract.js'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// pdf-parse is CommonJS, use dynamic import
async function getPdfParse() {
  const module = await import('pdf-parse')
  return module.default || module
}

/**
 * Extract text from scanned PDF using OCR
 * Converts PDF pages to images and runs Tesseract OCR
 */
async function extractTextWithOCR(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    // Load PDF with pdf-lib to get page count
    const pdfDoc = await PDFDocument.load(buffer)
    const pageCount = pdfDoc.getPageCount()
    
    // Use dynamic import for pdf-parse (CommonJS module)
    const pdfParse = await getPdfParse()
    
    // First try pdf-parse to see if there's extractable text
    const pdfParseResult = await pdfParse(buffer)
    const extractedText = pdfParseResult.text || ''
    
    // If we got substantial text, return it (not a scanned PDF)
    if (extractedText.trim().length > 100) {
      return { text: extractedText, pageCount: pdfParseResult.numpages }
    }
    
    // If very little text, it might be a scanned PDF - use OCR
    console.log('[ImportantQuestions] PDF appears to be scanned, attempting OCR...')
    
    // Use a single timestamp for all temp files to avoid mismatch
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(7)
    const tempPdfPath = join(tmpdir(), `iq-ocr-${timestamp}-${randomSuffix}.pdf`)
    const tempImagePrefix = join(tmpdir(), `iq-ocr-${timestamp}-${randomSuffix}`)
    
    try {
      await writeFile(tempPdfPath, buffer)
      
      // Convert PDF pages to PNG images using pdftoppm
      const { execFile } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execFileAsync = promisify(execFile)
      
      // Convert PDF to PNG images (one per page)
      await execFileAsync('pdftoppm', ['-png', '-r', '300', tempPdfPath, tempImagePrefix], {
        timeout: 60000,
      })
      
      // Get list of generated image files
      const { readdir } = await import('node:fs/promises')
      const files = await readdir(tmpdir())
      const imageFiles = files
        .filter(f => f.startsWith(`iq-ocr-${timestamp}-${randomSuffix}`) && f.endsWith('.png'))
        .sort()
      
      if (imageFiles.length === 0) {
        console.warn('[ImportantQuestions] No images generated from PDF')
        return { text: extractedText, pageCount: pdfParseResult.numpages }
      }
      
      // Run OCR on each image
      const worker = await createWorker('eng')
      let fullText = ''
      
      for (const imageFile of imageFiles) {
        const imagePath = join(tmpdir(), imageFile)
        try {
          const { data: { text } } = await worker.recognize(imagePath)
          fullText += `\n\n--- Page ${imageFile} ---\n\n${text}`
        } catch (ocrError) {
          console.error(`[ImportantQuestions] OCR failed for ${imageFile}:`, ocrError)
        }
      }
      
      await worker.terminate()
      
      // Clean up temp files
      for (const imageFile of imageFiles) {
        await unlink(join(tmpdir(), imageFile)).catch(() => {})
      }
      await unlink(tempPdfPath).catch(() => {})
      
      if (fullText.trim().length > 0) {
        console.log(`[ImportantQuestions] OCR extracted ${fullText.length} characters from ${imageFiles.length} pages`)
        return { text: fullText.trim(), pageCount: imageFiles.length }
      }
    } catch (ocrError) {
      console.error('[ImportantQuestions] OCR process failed:', ocrError)
    } finally {
      // Cleanup
      await unlink(tempPdfPath).catch(() => {})
    }
    
    return { text: extractedText, pageCount: pdfParseResult.numpages }
  } catch (error) {
    console.error('[ImportantQuestions] OCR extraction error:', error)
    // Fallback to basic pdf-parse
    try {
      const pdfParse = await getPdfParse()
      const pdfParseResult = await pdfParse(buffer)
      return { text: pdfParseResult.text || '', pageCount: pdfParseResult.numpages }
    } catch {
      return { text: '', pageCount: 0 }
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        questions: {
          orderBy: [{ year: 'asc' }, { questionNumber: 'asc' }],
        },
        _count: { select: { questions: true } },
      },
    })

    if (!paper) {
      return NextResponse.json({ error: 'Question paper not found' }, { status: 404 })
    }

    return NextResponse.json({ paper: serializeBigInt(paper) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch question paper' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
    })

    if (!paper) {
      return NextResponse.json({ error: 'Question paper not found' }, { status: 404 })
    }

    // Delete questions first (cascade should handle this, but being explicit)
    await prisma.extractedQuestion.deleteMany({
      where: { questionPaperId: id },
    })

    await prisma.questionPaper.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper delete error:', error)
    return NextResponse.json({ error: 'Failed to delete question paper' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { action } = body // 'extract' | 'reprocess'

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
      include: { questions: true },
    })

    if (!paper) {
      return NextResponse.json({ error: 'Question paper not found' }, { status: 404 })
    }

    if (action === 'extract') {
      // Get the document content using the document processing pipeline
      // This supports PDF, DOCX, TXT, and other formats
      let textContent = ''
      let pageCount = paper.pageCount || 1

      try {
        // Download the file from storage
        const buffer = await downloadFile(paper.storageBucket, paper.storagePath)
        
        // Determine document type from mime type or file extension
        const fileName = paper.fileName || ''
        const mimeType = paper.mimeType || ''
        
        // For PDFs, try OCR if text extraction yields minimal results
        if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          const ocrResult = await extractTextWithOCR(buffer)
          textContent = ocrResult.text
          pageCount = Math.max(pageCount, ocrResult.pageCount)
        } else {
          // Use the existing extractContent function for other formats
          const extracted = await extractContent(buffer, paper.mimeType ? paper.mimeType : 'application/octet-stream')
          textContent = extracted.text
          pageCount = Math.max(pageCount, extracted.pages.length)
        }
      } catch (extractionError) {
        console.error('[ImportantQuestions] Document extraction error:', extractionError)
        // Fallback: try base64 metadata for text-based files
        if (paper.metadata && typeof paper.metadata === 'object' && 'base64Data' in paper.metadata) {
          const metadata = paper.metadata as { base64Data?: string }
          if (metadata.base64Data) {
            try {
              textContent = Buffer.from(metadata.base64Data, 'base64').toString('utf-8')
            } catch {
              // Ignore fallback errors
            }
          }
        }
      }

      if (!textContent || textContent.trim().length === 0) {
        return NextResponse.json(
          { error: 'Could not extract readable text from the document. Please ensure the document contains extractable text.' },
          { status: 400 }
        )
      }

      // Update paper with page count if extracted
      if (pageCount !== paper.pageCount) {
        await prisma.questionPaper.update({
          where: { id: paper.id },
          data: { pageCount },
        })
      }

      // Use AI to extract questions
      const structured = await generateStructuredOutput<{
        questions: Array<{
          questionNumber: string
          text: string
          subQuestions?: Array<{ label: string; text: string; marks?: number }>
          marks?: number
          unit?: string
          topic?: string
          concept?: string
          questionType?: string
          difficulty?: string
          year?: number
          pageReference?: number
          extractionConfidence?: number
          flags?: string[]
        }>
      }>({
        userId: user.id,
        provider: body.provider,
        model: body.model,
        systemPrompt: `You are an expert academic question paper analyzer. Extract individual questions from question bank / previous year question paper text.
        
        For each question, identify:
        - Question number (e.g., "1", "2a", "Q3")
        - Full question text
        - Sub-questions if any (with labels like a, b, c)
        - Marks allocated
        - Unit/topic/concept if identifiable
        - Question type (MCQ, SHORT_ANSWER, LONG_ANSWER, NUMERICAL, etc.)
        - Difficulty if assessable (EASY, MEDIUM, HARD)
        - Year if mentioned
        - Page reference if identifiable
        - Extraction confidence score (0-1)
        - Flags for uncertain extractions (e.g., MISSING_MARKS, UNCLEAR_NUMBERING, UNCERTAIN_EXTRACTION)`,
        schemaDescription: `{
  "questions": [
    {
      "questionNumber": "1",
      "text": "Full question text...",
      "subQuestions": [
        { "label": "a", "text": "Sub-question a", "marks": 5 },
        { "label": "b", "text": "Sub-question b", "marks": 5 }
      ],
      "marks": 10,
      "unit": "Unit 1",
      "topic": "Newton's Laws",
      "concept": "Force and Motion",
      "questionType": "LONG_ANSWER",
      "difficulty": "MEDIUM",
      "year": 2023,
      "pageReference": 1,
      "extractionConfidence": 0.95,
      "flags": []
    }
  ]
}`,
        prompt: `Extract all questions from this ${paper.paperType} paper "${paper.title}":\n\n${textContent.slice(0, 50000)}`,
        validate: (parsed) => {
          if (!parsed || !Array.isArray(parsed.questions)) {
            throw new Error('Model did not return valid questions array')
          }
          return {
            questions: parsed.questions.map((q: any) => ({
              questionNumber: String(q.questionNumber || '').trim(),
              text: String(q.text || '').trim(),
              subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions : undefined,
              marks: typeof q.marks === 'number' ? q.marks : undefined,
              unit: q.unit ? String(q.unit).trim() : undefined,
              topic: q.topic ? String(q.topic).trim() : undefined,
              concept: q.concept ? String(q.concept).trim() : undefined,
              questionType: q.questionType ? String(q.questionType).trim() : undefined,
              difficulty: q.difficulty ? String(q.difficulty).trim() : undefined,
              year: typeof q.year === 'number' ? q.year : undefined,
              pageReference: typeof q.pageReference === 'number' ? q.pageReference : undefined,
              extractionConfidence: typeof q.extractionConfidence === 'number' ? q.extractionConfidence : 0.8,
              flags: Array.isArray(q.flags) ? q.flags.map(String) : [],
            })).filter(q => q.text.length > 0),
          }
        },
      })

      // Save extracted questions
      const savedQuestions = await prisma.extractedQuestion.createMany({
        data: structured.data.questions.map(q => ({
          questionPaperId: paper.id,
          questionNumber: q.questionNumber,
          text: q.text,
          subQuestions: q.subQuestions as any,
          marks: q.marks,
          unit: q.unit,
          topic: q.topic,
          concept: q.concept,
          questionType: q.questionType,
          difficulty: q.difficulty,
          year: q.year,
          pageReference: q.pageReference,
          extractionConfidence: q.extractionConfidence,
          flags: q.flags,
        })),
      })

      // Update paper status
      await prisma.questionPaper.update({
        where: { id: paper.id },
        data: { status: 'READY', pageCount },
      })

      return NextResponse.json({
        success: true,
        extractedCount: savedQuestions.count,
        questions: structured.data.questions,
        provider: structured.provider,
        model: structured.model,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ImportantQuestions] Paper action error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to process question paper')
    return NextResponse.json(
      { error: formatted.body.error, code: formatted.body.code },
      { status: formatted.status }
    )
  }
}