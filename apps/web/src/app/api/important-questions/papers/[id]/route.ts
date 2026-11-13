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
 * Uses native pdf-lib for page extraction and tesseract.js (no CLI dependency)
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
    console.log('[ImportantQuestions] PDF appears to be scanned, attempting OCR with tesseract.js...')
    
    // Create PDF pages as images using pdf-lib
    // We'll extract each page and render it (via a different approach since we don't have pdftoppm)
    // Instead, we use tesseract.js directly on the PDF buffer
    
    const worker = await createWorker('eng')
    let fullText = ''
    
    try {
      // Tesseract.js can process PDF directly
      const { data: { text } } = await worker.recognize(buffer)
      fullText = text
    } catch (ocrError) {
      console.error('[ImportantQuestions] tesseract.js OCR failed, trying page-by-page:', ocrError)
      
      // Fallback: try rendering each page with pdf-lib and processing
      // Since we can't easily render to images without poppler/pdftoppm,
      // we'll use the native PDF text extraction as final fallback
      try {
        const nativeResult = await extractTextFromPDFNatively(buffer)
        if (nativeResult && nativeResult.text.trim().length > 0) {
          await worker.terminate()
          return { text: nativeResult.text, pageCount: nativeResult.pages.length }
        }
      } catch (nativeError) {
        console.error('[ImportantQuestions] Native PDF extraction also failed:', nativeError)
      }
    }
    
    await worker.terminate()
    
    if (fullText.trim().length > 0) {
      console.log(`[ImportantQuestions] OCR extracted ${fullText.length} characters from ${pageCount} pages`)
      return { text: fullText.trim(), pageCount }
    }
    
    // Final fallback to basic pdf-parse
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

/**
 * Native PDF text extraction without external dependencies
 * Uses pdf-lib to parse content streams and FlateDecode
 */
async function extractTextFromPDFNatively(buffer: Buffer): Promise<{ text: string; pages: Array<{ pageNumber: number; text: string }> } | null> {
  try {
    const raw = buffer.toString('latin1')
    const pages: Array<{ pageNumber: number; text: string }> = []
    
    const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
    let match: RegExpExecArray | null
    let pageIdx = 1
    
    const { inflateSync, inflateRawSync } = await import('node:zlib')
    
    while ((match = streamRegex.exec(raw)) !== null) {
      const dict = match[1]
      if (/\/Subtype\s*\/Image|\/Type\s*\/XRef|\/Type\s*\/ObjStm|\/Subtype\s*\/Type1C/.test(dict)) {
        continue
      }
      const streamStart = match.index + match[0].indexOf('stream') + 6
      const afterStream = raw.slice(streamStart, streamStart + 2)
      const byteStart =
        afterStream === '\r\n' ? streamStart + 2 : afterStream.startsWith('\n') || afterStream.startsWith('\r') ? streamStart + 1 : streamStart
      const endPos = raw.indexOf('endstream', byteStart)
      if (endPos <= byteStart) continue
      
      let streamEnd = endPos
      if (raw[streamEnd - 1] === '\n') streamEnd--
      if (raw[streamEnd - 1] === '\r') streamEnd--
      
      const streamBytes = buffer.subarray(byteStart, streamEnd)
      let decodedStr = ''
      
      if (/\/FlateDecode/.test(dict)) {
        try {
          decodedStr = inflateSync(streamBytes).toString('latin1')
        } catch {
          try {
            decodedStr = inflateRawSync(streamBytes).toString('latin1')
          } catch {
            continue
          }
        }
      } else {
        decodedStr = streamBytes.toString('latin1')
      }
      
      const extracted = extractTextFromPdfContentStream(decodedStr)
      if (extracted) {
        pages.push({
          pageNumber: pageIdx++,
          text: extracted,
        })
      }
    }
    
    if (pages.length === 0) {
      const directText = extractTextFromPdfContentStream(raw)
      if (directText) {
        pages.push({ pageNumber: 1, text: directText })
      }
    }
    
    if (pages.length === 0) return null
    
    return {
      text: pages.map(p => p.text).join('\n\n'),
      pages,
    }
  } catch (error) {
    console.error('[ImportantQuestions] Native PDF extraction error:', error)
    return null
  }
}

function decodePdfLiteralString(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    i++
    if (i >= raw.length) break
    const next = raw[i]
    if (next === 'n') out += '\n'
    else if (next === 'r') out += '\r'
    else if (next === 't') out += '\t'
    else if (next === 'b') out += '\b'
    else if (next === 'f') out += '\f'
    else if (next === '(' || next === ')' || next === '\\') out += next
    else if (next >= '0' && next <= '7') {
      let oct = next
      if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i]
      if (i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i]
      out += String.fromCharCode(parseInt(oct, 8))
    } else {
      out += next
    }
  }
  return out
}

function decodePdfHexString(hexRaw: string): string {
  const clean = hexRaw.replace(/\s+/g, '')
  if (!clean) return ''
  const padded = clean.length % 2 === 1 ? clean + '0' : clean
  const bytes = Buffer.from(padded, 'hex')
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let str = ''
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      str += String.fromCharCode(bytes.readUInt16BE(i))
    }
    return str
  }
  return bytes.toString('latin1').replace(/\x00/g, '')
}

function extractTextFromPdfContentStream(contentStr: string): string {
  const chunks: string[] = []
  const btBlocks = [...contentStr.matchAll(/BT([\s\S]*?)ET/g)]
  const targetRegions = btBlocks.length > 0 ? btBlocks.map(m => m[1]) : [contentStr]

  for (const block of targetRegions) {
    const lines: string[] = []
    let currentLine = ''

    const tokenRegex =
      /\[((?:[^\]\\]|\\.|\\\([\s\S]*?\\\))*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|\b(T\*|TD|Td)\b/g
    let match: RegExpExecArray | null
    while ((match = tokenRegex.exec(block)) !== null) {
      if (match[1] !== undefined) {
        const arrayBody = match[1]
        const itemRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g
        let itemMatch: RegExpExecArray | null
        while ((itemMatch = itemRegex.exec(arrayBody)) !== null) {
          if (itemMatch[1] !== undefined) {
            currentLine += decodePdfLiteralString(itemMatch[1])
          } else if (itemMatch[2] !== undefined) {
            currentLine += decodePdfHexString(itemMatch[2])
          } else if (itemMatch[3] !== undefined) {
            const kern = parseFloat(itemMatch[3])
            if (kern < -120 && !currentLine.endsWith(' ')) {
              currentLine += ' '
            }
          }
        }
      } else if (match[2] !== undefined) {
        currentLine += decodePdfLiteralString(match[2])
      } else if (match[3] !== undefined) {
        currentLine += decodePdfHexString(match[3])
      } else if (match[4] !== undefined) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
          currentLine = ''
        }
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }
    if (lines.length > 0) {
      chunks.push(lines.join('\n'))
    }
  }

  return chunks.join('\n').trim()
}

/**
 * Chunk long text for AI processing
 */
function chunkTextForExtraction(text: string, maxChunkSize = 40000, overlap = 2000): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }
  
  const chunks: string[] = []
  let start = 0
  
  while (start < text.length) {
    let end = start + maxChunkSize
    
    // Try to break at a natural boundary (double newline, question number pattern)
    if (end < text.length) {
      // Look for question boundaries
      const questionMatch = text.slice(end - 2000, end).match(/\n\s*(\d+[\.\)]\s|\d+\.\d+[\.\)]\s|Q\s*\d+[\.\)]\s)/i)
      if (questionMatch && questionMatch.index !== undefined) {
        end = end - 2000 + questionMatch.index
      } else {
        // Fallback: break at paragraph
        const paraMatch = text.slice(end - 1000, end).match(/\n\n/)
        if (paraMatch && paraMatch.index !== undefined) {
          end = end - 1000 + paraMatch.index + 2
        }
      }
    }
    
    chunks.push(text.slice(start, end))
    start = end - overlap
    
    if (start >= text.length) break
  }
  
  return chunks
}

/**
 * Deduplicate questions based on text similarity
 */
function deduplicateQuestions(questions: any[]): any[] {
  const seen = new Map<string, any>()
  
  for (const q of questions) {
    const normalized = q.text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const existing = seen.get(normalized)
    
    if (!existing) {
      seen.set(normalized, q)
    } else {
      // Keep the one with higher confidence or more complete data
      if ((q.extractionConfidence || 0) > (existing.extractionConfidence || 0)) {
        seen.set(normalized, q)
      }
    }
  }
  
  return Array.from(seen.values())
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

    // Delete questions first
    await prisma.extractedQuestion.deleteMany({
      where: { questionPaperId: id },
    })

    // Delete from storage
    try {
      const { deleteFile } = await import('@/lib/storage/client')
      await deleteFile('documents', paper.storagePath)
    } catch (storageError) {
      console.warn('[ImportantQuestions] Storage delete failed:', storageError)
    }

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

      // Chunk long documents for AI processing
      const chunks = chunkTextForExtraction(textContent)
      console.log(`[ImportantQuestions] Processing ${chunks.length} chunks for paper ${paper.id}`)
      
      const allExtractedQuestions: any[] = []
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        const chunkPrompt = chunks.length > 1 
          ? `Extract all questions from this ${paper.paperType} paper "${paper.title}" (Part ${chunkIndex + 1} of ${chunks.length}):\n\n${chunk}`
          : `Extract all questions from this ${paper.paperType} paper "${paper.title}":\n\n${chunk}`

        try {
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
            prompt: chunkPrompt,
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

          allExtractedQuestions.push(...structured.data.questions)
        } catch (chunkError) {
          console.error(`[ImportantQuestions] Chunk ${chunkIndex + 1} extraction failed:`, chunkError)
          // Continue with other chunks
        }
      }

      // Deduplicate questions
      const deduplicatedQuestions = deduplicateQuestions(allExtractedQuestions)
      console.log(`[ImportantQuestions] Extracted ${allExtractedQuestions.length} questions, deduplicated to ${deduplicatedQuestions.length}`)

      // Save extracted questions (skip if already exist to allow retry)
      const existingQuestions = paper.questions || []
      const existingTexts = new Set(existingQuestions.map(q => q.text.toLowerCase().trim()))
      
      const newQuestions = deduplicatedQuestions.filter(q => !existingTexts.has(q.text.toLowerCase().trim()))
      
      if (newQuestions.length > 0) {
        await prisma.extractedQuestion.createMany({
          data: newQuestions.map(q => ({
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
      }

      // Update paper status
      await prisma.questionPaper.update({
        where: { id: paper.id },
        data: { status: 'READY', pageCount },
      })

      return NextResponse.json({
        success: true,
        extractedCount: newQuestions.length,
        totalExtracted: deduplicatedQuestions.length,
        questions: deduplicatedQuestions,
        chunksProcessed: chunks.length,
      })
    }

    if (action === 'reprocess') {
      // Delete existing questions and re-extract
      await prisma.extractedQuestion.deleteMany({
        where: { questionPaperId: id },
      })
      
      await prisma.questionPaper.update({
        where: { id: paper.id },
        data: { status: 'UPLOADED' },
      })
      
      // Re-run extraction
      return POST(request, { params })
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