"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A safe, feature-rich Markdown renderer for AI chat messages.
 * Supports: headings, bold, italic, code, code blocks, lists, tables, blockquotes, links, inline code.
 * Does NOT render raw HTML for security.
 */
export function MarkdownRenderer({ 
  content, 
  className,
  copyCodeEnabled = true 
}: { 
  content: string
  className?: string
  copyCodeEnabled?: boolean
}) {
  if (!content) return null

  // Parse markdown into a structured format first
  const blocks = parseMarkdown(content)

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {blocks.map((block, index) => (
        <React.Fragment key={index}>
          {renderBlock(block, copyCodeEnabled)}
        </React.Fragment>
      ))}
    </div>
  )
}

interface MarkdownBlock {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'blockquote' | 'hr' | 'empty'
  level?: number
  content?: string
  items?: MarkdownListItem[]
  ordered?: boolean
  startIndex?: number
  language?: string
  code?: string
  rows?: MarkdownTableRow[]
  align?: ('left' | 'center' | 'right' | 'none')[]
}

interface MarkdownListItem {
  content: string
  checked?: boolean
  children?: MarkdownBlock[]
}

interface MarkdownTableRow {
  cells: string[]
  isHeader?: boolean
}

/**
 * Parse markdown content into structured blocks
 */
function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      blocks.push({ type: 'empty' })
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ 
        type: 'heading', 
        level: headingMatch[1].length, 
        content: headingMatch[2].trim() 
      })
      i++
      continue
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```
      blocks.push({ 
        type: 'code', 
        language: language || undefined,
        code: codeLines.join('\n')
      })
      continue
    }

    // Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().slice(1).trim())
        i++
      }
      blocks.push({ 
        type: 'blockquote', 
        content: quoteLines.join('\n') 
      })
      continue
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: MarkdownTableRow[] = []
      let isHeader = true
      let align: ('left' | 'center' | 'right' | 'none')[] = []
      
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowLine = lines[i].trim()
        const cells = rowLine.slice(1, -1).split('|').map(c => c.trim())
        
        if (isHeader && cells.every(c => /^[-:]+$/.test(c))) {
          // This is the alignment row
          align = cells.map(c => {
            if (c.startsWith(':') && c.endsWith(':')) return 'center'
            if (c.endsWith(':')) return 'right'
            if (c.startsWith(':')) return 'left'
            return 'none'
          })
          i++
          continue
        }
        
        tableRows.push({ cells, isHeader })
        isHeader = false
        i++
      }
      
      if (tableRows.length > 0) {
        blocks.push({ 
          type: 'table', 
          rows: tableRows,
          align: align.length > 0 ? align : Array(tableRows[0]?.cells.length || 0).fill('none')
        })
      }
      continue
    }

    // Lists
    const listMatch = trimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/s)
    if (listMatch) {
      const indent = listMatch[1].length
      const marker = listMatch[2]
      const itemContent = listMatch[3]
      const ordered = /^\d+[.)]$/.test(marker)
      
      const listItems: MarkdownListItem[] = []
      let startIndex = 1
      
      if (ordered) {
        const numMatch = marker.match(/^(\d+)/)
        if (numMatch) startIndex = parseInt(numMatch[1], 10)
      }
      
      // Parse first item
      listItems.push({ content: itemContent })
      
      // Check for checkbox
      const checkboxMatch = itemContent.match(/^\[([ x])\]\s+(.+)$/i)
      if (checkboxMatch) {
        listItems[listItems.length - 1].checked = checkboxMatch[1].toLowerCase() === 'x'
        listItems[listItems.length - 1].content = checkboxMatch[2]
      }
      
      // Parse subsequent list items
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j]
        const nextTrimmed = nextLine.trim()
        const nextMatch = nextTrimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/s)
        
        if (nextMatch && nextMatch[1].length === indent) {
          const nextItemContent = nextMatch[3]
          const item: MarkdownListItem = { content: nextItemContent }
          
          const checkboxMatch = nextItemContent.match(/^\[([ x])\]\s+(.+)$/i)
          if (checkboxMatch) {
            item.checked = checkboxMatch[1].toLowerCase() === 'x'
            item.content = checkboxMatch[2]
          }
          
          listItems.push(item)
          j++
        } else if (nextTrimmed === '' || nextTrimmed.startsWith('>') || nextTrimmed.startsWith('```') || nextTrimmed.match(/^#{1,6}\s/)) {
          // Empty line or blockquote or code block or heading - might continue list
          // Check if next non-empty line continues the list
          let k = j + 1
          let foundNext = false
          while (k < lines.length) {
            const checkLine = lines[k]
            const checkTrimmed = checkLine.trim()
            if (checkTrimmed === '') {
              k++
              continue
            }
            const checkMatch = checkTrimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/s)
            if (checkMatch && checkMatch[1].length === indent) {
              foundNext = true
            }
            break
          }
          if (!foundNext) break
          j++
        } else {
          break
        }
      }
      
      blocks.push({ 
        type: 'list', 
        items: listItems, 
        ordered,
        startIndex
      })
      i = j
      continue
    }

    // Regular paragraph - collect consecutive non-special lines
    const paragraphLines: string[] = [line]
    let k = i + 1
    while (k < lines.length) {
      const nextLine = lines[k]
      const nextTrimmed = nextLine.trim()
      
      if (nextTrimmed === '' || 
          nextTrimmed.startsWith('>') || 
          nextTrimmed.startsWith('```') ||
          nextTrimmed.match(/^#{1,6}\s/) ||
          nextTrimmed.match(/^[-*+]\s/) ||
          nextTrimmed.match(/^\d+[.)]\s/) ||
          (nextTrimmed.startsWith('|') && nextTrimmed.endsWith('|')) ||
          /^[-*_]{3,}$/.test(nextTrimmed)) {
        break
      }
      
      paragraphLines.push(nextLine)
      k++
    }
    
    blocks.push({ 
      type: 'paragraph', 
      content: paragraphLines.join('\n') 
    })
    i = k
  }

  // Merge consecutive paragraphs
  const merged: MarkdownBlock[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph' && merged.length > 0 && merged[merged.length - 1].type === 'paragraph') {
      merged[merged.length - 1].content += '\n' + block.content
    } else if (block.type !== 'empty') {
      merged.push(block)
    }
  }
  
  return merged
}

/**
 * Render a single markdown block
 */
function renderBlock(block: MarkdownBlock, copyCodeEnabled: boolean): React.ReactElement | null {
  switch (block.type) {
    case 'heading':
      return renderHeading(block)
    case 'paragraph':
      return renderParagraph(block)
    case 'code':
      return renderCodeBlock(block, copyCodeEnabled)
    case 'list':
      return renderList(block)
    case 'table':
      return renderTable(block)
    case 'blockquote':
      return renderBlockquote(block)
    case 'hr':
      return <hr key="hr" className="my-4 border-border" />
    case 'empty':
      return <div key="empty" style={{ height: '0.5rem' }} />
    default:
      return null
  }
}

function renderHeading(block: MarkdownBlock): React.ReactElement {
  const Tag = `h${block.level}` as keyof JSX.IntrinsicElements
  return (
    <Tag key={`heading-${block.level}`} className="font-semibold text-foreground mt-4 mb-2">
      {renderInline(block.content || '')}
    </Tag>
  )
}

function renderParagraph(block: MarkdownBlock): React.ReactElement {
  return (
    <p key="paragraph" className="my-2 leading-relaxed">
      {renderInline(block.content || '')}
    </p>
  )
}

function renderCodeBlock(block: MarkdownBlock, copyCodeEnabled: boolean): React.ReactElement {
  const language = block.language || ''
  const code = block.code || ''
  
  return (
    <div key="code-block" className="relative my-4 rounded-lg bg-muted border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{language || "Code"}</span>
        {copyCodeEnabled && (
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code)
              } catch {
                // Clipboard permissions may be unavailable in insecure contexts.
              }
            }}
            aria-label="Copy code"
          >Copy code</button>
        )}
      </div>
      <pre className="m-0 p-4 overflow-x-auto"><code className={cn('text-sm font-mono', language && `language-${language}`)}>{code}</code></pre>
    </div>
  )
}

function renderList(block: MarkdownBlock): React.ReactElement {
  const ListTag = block.ordered ? 'ol' : 'ul'
  
  return (
    <ListTag key="list" className={cn("my-3 pl-6 space-y-1", block.ordered ? "list-decimal" : "list-disc")} start={block.startIndex}>
      {block.items?.map((item, index) => (
        <li key={index} className="ml-4">
          <label className="flex items-start gap-2 cursor-pointer">
            {item.checked !== undefined && (
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                className="mt-1 h-4 w-4 shrink-0"
              />
            )}
            <span className="flex-1">
              {renderInline(item.content || '')}
            </span>
          </label>
        </li>
      ))}
    </ListTag>
  )
}

function renderTable(block: MarkdownBlock): React.ReactElement {
  if (!block.rows || block.rows.length === 0) return null
  
  return (
    <div key="table" className="my-4 overflow-x-auto">
      <table className="min-w-full text-sm border-collapse border border-border/70">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {block.rows
              .filter(r => r.isHeader)
              .flatMap(r => r.cells.map((cell, idx) => 
                <th key={idx} className={cn(
                  "px-4 py-3 text-left font-semibold text-foreground border-r border-border/50 last:border-r-0",
                  block.align[idx] === 'center' && 'text-center',
                  block.align[idx] === 'right' && 'text-right'
                )}>
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
        <tbody>
          {block.rows
            .filter(r => !r.isHeader)
            .map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-muted/30' : ''}>
                {row.cells.map((cell, cellIdx) => (
                  <td key={cellIdx} className={cn(
                    "px-4 py-3 border-t border-r border-border/50 last:border-r-0 align-top",
                    block.align[cellIdx] === 'center' && 'text-center',
                    block.align[cellIdx] === 'right' && 'text-right'
                  )}>
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
      </table>
    </div>
  )
}

function renderBlockquote(block: MarkdownBlock): React.ReactElement {
  return (
    <blockquote key="blockquote" className="my-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {renderInline(block.content || '')}
      </div>
    </blockquote>
  )
}

/**
 * Render inline markdown (bold, italic, code, links, etc.)
 */
function renderInline(text: string): React.ReactNode {
  if (!text) return null
  
  // Split by inline code first to protect code from other parsing
  const codeRegex = /`([^`\n]+)`/g
  const parts = text.split(codeRegex)
  
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      // This is inline code
      return <code key={index} className="px-1.5 py-0.5 text-sm bg-muted rounded font-mono text-primary">{part}</code>
    }
    
    // Process bold, italic, links
    return processInlineFormatting(part)
  })
}

function processInlineFormatting(text: string): React.ReactNode {
  // Match **bold**, *italic*, [links](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g
  const parts = text.split(regex)
  
  return parts.map((part, index) => {
    if (!part) return null
    
    // Bold
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    
    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    
    // Links
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const href = linkMatch[2].trim()
      const safeHref = /^(https?:|mailto:|\/|#)/i.test(href) ? href : null
      if (!safeHref) return <span key={index}>{linkMatch[1]}</span>
      return (
        <a
          key={index}
          href={safeHref}
          target={/^https?:/i.test(safeHref) ? "_blank" : undefined}
          rel={/^https?:/i.test(safeHref) ? "noopener noreferrer" : undefined}
          className="text-primary underline hover:no-underline break-words"
        >
          {linkMatch[1]}
        </a>
      )
    }
    
    return <span key={index}>{part}</span>
  })
}
