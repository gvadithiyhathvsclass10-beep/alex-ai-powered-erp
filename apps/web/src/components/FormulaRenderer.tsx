'use client'

import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface FormulaRendererProps {
  formula: string
  displayMode?: boolean
  className?: string
  onError?: (error: Error) => void
}

export function FormulaRenderer({ 
  formula, 
  displayMode = false, 
  className = '',
  onError 
}: FormulaRendererProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    
    try {
      katex.render(formula, containerRef.current, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: {
          '\\RR': '\\mathbb{R}',
          '\\CC': '\\mathbb{C}',
          '\\NN': '\\mathbb{N}',
          '\\ZZ': '\\mathbb{Z}',
          '\\QQ': '\\mathbb{Q}',
        },
      })
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown KaTeX error')
      setError(error)
      onError?.(error)
    }
  }, [formula, displayMode, onError])

  if (error) {
    return (
      <span 
        className={`font-mono text-sm text-destructive ${className}`}
        title={`Formula render error: ${error.message}`}
      >
        {formula}
      </span>
    )
  }

  return (
    <span 
      ref={containerRef} 
      className={`katex-formula ${className}`}
      data-formula={formula}
    />
  )
}

export function InlineFormula({ formula, className = '' }: { formula: string; className?: string }) {
  return <FormulaRenderer formula={formula} displayMode={false} className={className} />
}

export function BlockFormula({ formula, className = '' }: { formula: string; className?: string }) {
  return <FormulaRenderer formula={formula} displayMode={true} className={className} />
}

export function FormulaList({ 
  formulas, 
  displayMode = true,
  className = '',
  itemClassName = ''
}: { 
  formulas: string[] 
  displayMode?: boolean
  className?: string
  itemClassName?: string
}) {
  return (
    <div className={className}>
      {formulas.map((formula, index) => (
        <div key={index} className={`formula-item ${itemClassName}`}>
          <FormulaRenderer formula={formula} displayMode={displayMode} />
        </div>
      ))}
    </div>
  )
}

export function AutoFormula({ 
  text, 
  className = '',
  inlineDelimiters = ['$', '$'],
  blockDelimiters = ['$$', '$$']
}: { 
  text: string
  className?: string
  inlineDelimiters?: [string, string]
  blockDelimiters?: [string, string]
}) {
  const [parts, setParts] = useState<Array<{ type: 'text' | 'inline' | 'block'; content: string }>>([])

  useEffect(() => {
    const result: Array<{ type: 'text' | 'inline' | 'block'; content: string }> = []
    let remaining = text
    const [blockOpen, blockClose] = blockDelimiters
    const [inlineOpen, inlineClose] = inlineDelimiters

    while (remaining.length > 0) {
      const blockStart = remaining.indexOf(blockOpen)
      const inlineStart = remaining.indexOf(inlineOpen)

      if (blockStart !== -1 && (blockStart < inlineStart || inlineStart === -1)) {
        if (blockStart > 0) {
          result.push({ type: 'text', content: remaining.slice(0, blockStart) })
        }
        const blockEnd = remaining.indexOf(blockClose, blockStart + blockOpen.length)
        if (blockEnd !== -1) {
          result.push({ 
            type: 'block', 
            content: remaining.slice(blockStart + blockOpen.length, blockEnd) 
          })
          remaining = remaining.slice(blockEnd + blockClose.length)
        } else {
          result.push({ type: 'text', content: remaining })
          break
        }
      } else if (inlineStart !== -1) {
        if (inlineStart > 0) {
          result.push({ type: 'text', content: remaining.slice(0, inlineStart) })
        }
        const inlineEnd = remaining.indexOf(inlineClose, inlineStart + inlineOpen.length)
        if (inlineEnd !== -1) {
          result.push({ 
            type: 'inline', 
            content: remaining.slice(inlineStart + inlineOpen.length, inlineEnd) 
          })
          remaining = remaining.slice(inlineEnd + inlineClose.length)
        } else {
          result.push({ type: 'text', content: remaining })
          break
        }
      } else {
        result.push({ type: 'text', content: remaining })
        break
      }
    }

    setParts(result)
  }, [text, inlineDelimiters, blockDelimiters])

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part.type === 'text' && <span>{part.content}</span>}
          {part.type === 'inline' && <InlineFormula formula={part.content} />}
          {part.type === 'block' && <BlockFormula formula={part.content} />}
        </React.Fragment>
      ))}
    </span>
  )
}

import React from 'react'