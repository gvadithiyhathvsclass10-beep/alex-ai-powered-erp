import { DocumentType } from '@prisma/client'

export interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
  maxTokensPerChunk?: number
  tokenizer?: (text: string) => number
}

export interface DocumentChunk {
  content: string
  chunkIndex: number
  pageNumber?: number
  sectionTitle?: string
  tokenCount: number
  metadata: Record<string, unknown>
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '],
  maxTokensPerChunk: 1000,
  tokenizer: simpleTokenCount,
}

function simpleTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

function countTokens(text: string, tokenizer: (text: string) => number): number {
  return tokenizer(text)
}

function splitText(text: string, separators: string[], maxTokens: number, tokenizer: (text: string) => number): string[] {
  if (separators.length === 0) return [text]

  const separator = separators[0]
  const parts = text.split(separator)

  if (parts.length === 1) {
    return splitText(text, separators.slice(1), maxTokens, tokenizer)
  }

  const result: string[] = []
  let current = ''

  for (const part of parts) {
    const testChunk = current + (current ? separator : '') + part
    if (countTokens(testChunk, tokenizer) > maxTokens && current) {
      result.push(current)
      current = part
    } else {
      current = testChunk
    }
  }

  if (current) result.push(current)
  return result
}

export function chunkContent(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const tokenizer = opts.tokenizer || simpleTokenCount
  const maxTokens = opts.maxTokensPerChunk || opts.chunkSize
  
  const normalizedPages = (pages.length > 0 ? pages : [{ pageNumber: 1, text: content }]).filter(
    p => p.text && p.text.trim().length > 0
  )
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  for (const page of normalizedPages) {
    const pageText = page.text.trim()
    if (!pageText) continue

    const segments = splitText(pageText, opts.separators, maxTokens, tokenizer)
    let currentChunk = ''

    for (const segment of segments) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + segment
      const tokenCount = countTokens(testChunk, tokenizer)

      if (tokenCount > maxTokens && currentChunk) {
        const finalChunk = currentChunk.trim()
        chunks.push({
          content: finalChunk,
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
          tokenCount: countTokens(finalChunk, tokenizer),
          metadata: {},
          sectionTitle: extractSectionTitle(finalChunk),
        })

        const overlapText = getOverlapText(finalChunk, opts.chunkOverlap, tokenizer)
        currentChunk = overlapText ? overlapText + '\n\n' + segment : segment
      } else {
        currentChunk = testChunk
      }
    }

    if (currentChunk.trim()) {
      const finalChunk = currentChunk.trim()
      chunks.push({
        content: finalChunk,
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        tokenCount: countTokens(finalChunk, tokenizer),
        metadata: {},
        sectionTitle: extractSectionTitle(finalChunk),
      })
    }
  }

  return chunks
}

function getOverlapText(text: string, overlapTokens: number, tokenizer: (text: string) => number): string {
  if (overlapTokens <= 0) return ''
  const words = text.split(/\s+/)
  const overlapWords = Math.min(words.length, Math.ceil(overlapTokens / 4))
  const overlapText = words.slice(-overlapWords).join(' ')
  return overlapText
}

function extractSectionTitle(text: string): string | undefined {
  const lines = text.split('\n').filter(l => l.trim())
  for (const line of lines) {
    const trimmed = line.trim().replace(/^#{1,6}\s+/, '')
    if (trimmed.length > 2 && trimmed.length < 100 && /^[A-Z][^.!?;]*$/.test(trimmed)) {
      return trimmed
    }
  }
  return undefined
}

export function chunkBySemanticUnits(
  content: string,
  pages: { pageNumber: number; text: string }[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  return chunkContent(content, pages, options)
}