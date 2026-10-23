import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
<<<<<<< HEAD
import { getUserChatProvider, type AIProviderType } from '@/lib/rag/generation'
import { hybridSearch } from '@/lib/rag/vector-search'
import { canAccessDocument } from '@/lib/document-processing/access'
import { formatAIServiceErrorResponse } from '@/lib/ai/service'
=======
import { getUserChatProvider } from '@/lib/rag/generation'
import { hybridSearch } from '@/lib/rag/vector-search'
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const body = await request.json()
<<<<<<< HEAD
    const {
      sourceType,
      prompt,
      title,
      outputFormat = 'markdown',
      includeDiagrams,
      includeTables,
      includeCitations,
      documentIds,
      sourceDocumentIds,
      subjectId,
      projectId,
      notebookId,
      provider,
      model,
    } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const requestedDocIds: string[] | undefined = Array.isArray(documentIds)
      ? documentIds
      : Array.isArray(sourceDocumentIds)
        ? sourceDocumentIds
        : undefined

    if (requestedDocIds && requestedDocIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: { id: { in: requestedDocIds } },
        select: { id: true, ownerId: true, subjectId: true, projectId: true, notebookId: true },
      })
      if (docs.length === 0) {
        return NextResponse.json({ error: 'Selected source documents not found' }, { status: 404 })
      }
      for (const doc of docs) {
        const allowed = await canAccessDocument(user, doc)
        if (!allowed) {
          return NextResponse.json(
            { error: 'Forbidden: you do not have access to one or more selected documents' },
            { status: 403 }
          )
        }
      }
    }

    const chatProvider = await getUserChatProvider(
      user.id,
      provider as AIProviderType | undefined,
      model
    )

    let searchResults: any[] = []
    let context = ''

    if (sourceType === 'rag' || (requestedDocIds && requestedDocIds.length > 0)) {
      searchResults = await hybridSearch({
        query: prompt,
        userId: user.id,
        userRole: user.role,
        subjectId,
        projectId,
        notebookId,
        documentIds: requestedDocIds,
        limit: 10,
        threshold: 0.3,
      })
      context = searchResults
        .map(
          (c, i) =>
            `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
        )
        .join('\n\n---\n\n')
    }

    const formatPrompts = {
      markdown:
        'Generate a well-structured Markdown document with proper headings, lists, code blocks, and tables.',
      html: 'Generate a complete HTML document with semantic markup, proper styling, and responsive design.',
      pdf: 'Generate content suitable for PDF export with clear page structure.',
      docx: 'Generate content suitable for Word document with proper formatting hints.',
    }

    const featurePrompts = []
    if (includeDiagrams) featurePrompts.push('Include Mermaid diagram code blocks where appropriate')
    if (includeTables) featurePrompts.push('Include well-formatted tables with headers')
    if (includeCitations && searchResults.length > 0) {
      featurePrompts.push('Cite sources using [Source X] format')
    }

    const systemPrompt = `You are ALEX, a professional document generator. Create a high-quality ${outputFormat} document based on the user's request.

FORMAT: ${String(outputFormat).toUpperCase()}
${formatPrompts[outputFormat as keyof typeof formatPrompts] || formatPrompts.markdown}
=======
    const { 
      sourceType, 
      prompt, 
      title, 
      outputFormat, 
      includeDiagrams, 
      includeTables, 
      includeCitations,
      templateId,
      templateVariables,
    } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const chatProvider = await getUserChatProvider(user.id)
    if (!chatProvider) {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 400 })
    }

    let searchResults: any[] = []
    let context = ""

    // If RAG-based, search documents
    if (sourceType === "rag") {
      searchResults = await hybridSearch({
        query: prompt,
        userId: user.id,
        limit: 10,
        threshold: 0.6,
      })
      context = searchResults.map((c, i) => 
        `[Source ${i + 1}] (${c.document.title}${c.pageNumber ? `, p.${c.pageNumber}` : ''}):\n${c.content}`
      ).join('\n\n---\n\n')
    }

    // Build system prompt based on output format
    const formatPrompts = {
      markdown: "Generate a well-structured Markdown document with proper headings, lists, code blocks, and tables.",
      html: "Generate a complete HTML document with semantic markup, proper styling, and responsive design.",
      pdf: "Generate content suitable for PDF export with clear page structure.",
      docx: "Generate content suitable for Word document with proper formatting hints.",
    }

    const featurePrompts = []
    if (includeDiagrams) featurePrompts.push("Include Mermaid diagram code blocks where appropriate")
    if (includeTables) featurePrompts.push("Include well-formatted tables with headers")
    if (includeCitations && searchResults.length > 0) featurePrompts.push("Cite sources using [Source X] format")

    const systemPrompt = `You are ALEX, a professional document generator. Create a high-quality ${outputFormat} document based on the user's request.

FORMAT: ${outputFormat.toUpperCase()}
${formatPrompts[outputFormat as keyof typeof formatPrompts]}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

FEATURES:
${featurePrompts.map(f => `- ${f}`).join('\n')}

RULES:
- Create professional, well-structured content
- Use appropriate formatting for the output format
- Be comprehensive but concise
- Include practical examples where relevant
- Maintain consistent style and tone
${context ? `\nUSE THE FOLLOWING SOURCES:\n${context}` : ''}`

    const response = await chatProvider.generate({
      query: prompt,
      context: searchResults,
      systemPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    })

<<<<<<< HEAD
    const sections = parseSections(response.answer)

    const document: Record<string, unknown> = {
      id: `doc-${Date.now()}`,
      title: title || 'Generated Document',
      content: response.answer,
      format: outputFormat,
      provider: response.provider,
      model: response.model,
      sections,
      metadata: {
        wordCount: response.answer.split(/\s+/).filter(Boolean).length,
        readingTime: Math.max(1, Math.ceil(response.answer.split(/\s+/).filter(Boolean).length / 200)),
        provider: response.provider,
        model: response.model,
        sourcesUsed: searchResults.length,
=======
    // Parse sections from the response
    const sections = parseSections(response.answer)

    const document: any = {
      id: `doc-${Date.now()}`,
      title: title || "Generated Document",
      content: response.answer,
      format: outputFormat,
      sections,
      metadata: {
        wordCount: response.answer.split(/\s+/).length,
        readingTime: Math.ceil(response.answer.split(/\s+/).length / 200),
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        createdAt: new Date().toISOString(),
      },
    }

<<<<<<< HEAD
=======
    // Add citations if available
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (includeCitations && response.citations.length > 0) {
      document.citations = response.citations
    }

    return NextResponse.json(document)
  } catch (error) {
<<<<<<< HEAD
    console.error('[Document Generate] Error:', error)
    const formatted = formatAIServiceErrorResponse(error, 'Document generation failed')
    return NextResponse.json(formatted.body, { status: formatted.status })
=======
    console.error('Document generation error:', error)
    return NextResponse.json({ error: 'Document generation failed' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}

function parseSections(content: string): Array<{
  id: string
<<<<<<< HEAD
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'diagram' | 'quote'
=======
  type: "heading" | "paragraph" | "list" | "table" | "code" | "diagram" | "quote"
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  content: any
  level?: number
}> {
  const sections: Array<{
    id: string
<<<<<<< HEAD
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'diagram' | 'quote'
=======
    type: "heading" | "paragraph" | "list" | "table" | "code" | "diagram" | "quote"
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    content: any
    level?: number
  }> = []

  const lines = content.split('\n')
  let currentSection: any = null
  let inCodeBlock = false
<<<<<<< HEAD
  let codeContent = ''
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

=======
  let codeContent = ""
  let codeLang = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Handle code blocks
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
<<<<<<< HEAD
        codeContent = ''
=======
        codeContent = ""
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      } else {
        inCodeBlock = false
        sections.push({
          id: `section-${sections.length}`,
<<<<<<< HEAD
          type: codeLang === 'mermaid' ? 'diagram' : 'code',
          content: { code: codeContent, language: codeLang },
        })
        codeContent = ''
      }
      continue
    }

=======
          type: "code",
          content: { code: codeContent, language: codeLang },
        })
        codeContent = ""
      }
      continue
    }
    
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

<<<<<<< HEAD
=======
    // Headings
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      sections.push({
        id: `section-${sections.length}`,
<<<<<<< HEAD
        type: 'heading',
=======
        type: "heading",
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        content: headingMatch[2],
        level: headingMatch[1].length,
      })
      continue
    }

<<<<<<< HEAD
    if (line.includes('|') && line.includes('---')) {
=======
    // Tables (simple detection)
    if (line.includes('|') && line.includes('---')) {
      // This is a table row, collect full table
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      const tableLines = [line]
      let j = i + 1
      while (j < lines.length && (lines[j].includes('|') || lines[j].trim() === '')) {
        if (lines[j].trim()) tableLines.push(lines[j])
        j++
      }
      i = j - 1
      sections.push({
        id: `section-${sections.length}`,
<<<<<<< HEAD
        type: 'table',
=======
        type: "table",
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        content: tableLines.join('\n'),
      })
      continue
    }

<<<<<<< HEAD
    if (line.trim()) {
      if (!currentSection || currentSection.type !== 'paragraph') {
        currentSection = {
          id: `section-${sections.length}`,
          type: 'paragraph',
          content: '',
=======
    // Mermaid diagrams
    if (line.trim().startsWith('```mermaid')) {
      // Already handled by code block above
      continue
    }

    // Regular paragraphs
    if (line.trim()) {
      if (!currentSection || currentSection.type !== "paragraph") {
        currentSection = {
          id: `section-${sections.length}`,
          type: "paragraph",
          content: "",
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        }
        sections.push(currentSection)
      }
      currentSection.content += (currentSection.content ? '\n' : '') + line
    } else {
      currentSection = null
    }
  }

<<<<<<< HEAD
=======
  // If no sections were parsed, create one from the whole content
  if (sections.length === 0 && content.trim()) {
    sections.push({
      id: `section-${sections.length}`,
      type: "paragraph",
      content: content.trim(),
    })
  }

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  return sections
}
