import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import { canAccessDocument } from '@/lib/document-processing/access'
import {
  summarizeAndAnalyzeDocument,
  formatAIServiceErrorResponse,
  type DocumentSummaryType,
} from '@/lib/ai/service'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const body = await request.json()
    const { sourceDocId, type = 'concise', provider, model, customInstructions } = body

    if (!sourceDocId) {
      return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })
    }

    const document = await prisma.document.findFirst({
      where: { id: sourceDocId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const hasAccess = await canAccessDocument(user, document)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!document.chunks || document.chunks.length === 0) {
      return NextResponse.json(
        { error: 'The document has no processed text chunks yet' },
        { status: 422 }
      )
    }

    const validTypes: DocumentSummaryType[] = [
      'concise',
      'detailed',
      'exam',
      'formulas',
      'definitions',
      'comparison',
    ]
    const analysisType: DocumentSummaryType = validTypes.includes(type) ? type : 'concise'

    const summary = await summarizeAndAnalyzeDocument({
      userId: user.id,
      documentTitle: document.title,
      chunks: document.chunks,
      analysisType,
      customInstructions,
      provider,
      model,
    })

    const material = await prisma.studyMaterial.create({
      data: {
        userId: user.id,
        title: summary.title,
        content: summary.content,
        type: summary.type,
        sourceDocId: document.id,
        subjectId: document.subjectId,
        tags: [summary.type, summary.provider.toLowerCase()],
        metadata: {
          provider: summary.provider,
          model: summary.model,
          tokenUsage: summary.tokenUsage,
        },
      },
    })

    return NextResponse.json({
      material,
      provider: summary.provider,
      model: summary.model,
    })
  } catch (error) {
    console.error('[Study Materials] Generation error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Failed to generate study material')
    return NextResponse.json(formatted.body, { status: formatted.status })
=======
    const { sourceDocId, type = 'concise' } = await request.json()
    if (!sourceDocId) return NextResponse.json({ error: 'sourceDocId is required' }, { status: 400 })

    const document = await prisma.document.findFirst({
      where: { id: sourceDocId, ownerId: user.id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const source = document.chunks.map(chunk => chunk.content.trim()).filter(Boolean).join('\n\n')
    const content = type === 'concise'
      ? source.split(/\n+/).filter(Boolean).slice(0, 30).map(line => `• ${line.slice(0, 240)}`).join('\n')
      : source.slice(0, 24000)
    const material = await prisma.studyMaterial.create({
      data: { userId: user.id, title: `${document.title} — ${type} notes`, content, type, sourceDocId: document.id, subjectId: document.subjectId, tags: [] },
    })
    return NextResponse.json({ material })
  } catch (error) {
    console.error('Study material generation error:', error)
    return NextResponse.json({ error: 'Failed to generate study material' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}
