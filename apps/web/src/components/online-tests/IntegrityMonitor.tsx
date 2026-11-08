"use client"

import * as React from "react"
import { useEffect, useRef, useCallback } from "react"

interface IntegrityMonitorProps {
  testId: string
  attemptId: string
  warningsCount: number
  onWarning: (count: number, type: string) => void
}

const VALID_WARNING_TYPES = [
  'TAB_SWITCH',
  'WINDOW_BLUR', 
  'FULLSCREEN_EXIT',
  'COPY_ATTEMPT',
  'PASTE_ATTEMPT',
  'RIGHT_CLICK'
] as const

type WarningType = typeof VALID_WARNING_TYPES[number]

export function IntegrityMonitor({ testId, attemptId, warningsCount, onWarning }: IntegrityMonitorProps) {
  const warningsRef = useRef(warningsCount)
  const isSubmittedRef = useRef(false)
  const warningSentRef = useRef<Set<WarningType>>(new Set())

  warningsRef.current = warningsCount

  const sendWarning = useCallback(async (type: WarningType, details?: Record<string, any>) => {
    if (isSubmittedRef.current) return
    if (warningsRef.current >= 5) return

    // Prevent duplicate warnings of the same type within a short window
    const warningKey = `${type}-${Date.now()}`
    if (warningSentRef.current.has(type)) {
      // Allow repeated warnings but with a cooldown
      const lastWarning = sessionStorage.getItem(`last-warning-${type}`)
      if (lastWarning && Date.now() - parseInt(lastWarning) < 2000) {
        return
      }
    }

    warningSentRef.current.add(type)
    sessionStorage.setItem(`last-warning-${type}`, Date.now().toString())

    try {
      const res = await fetch(`/api/online-tests/${testId}/warnings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, warningType: type, details }),
      })

      const data = await res.json()
      if (res.ok) {
        warningsRef.current = data.warningsCount
        onWarning(data.warningsCount, type)
        
        if (data.autoSubmitted) {
          isSubmittedRef.current = true
          // Dispatch event for TestPlayer to handle auto-submission
          window.dispatchEvent(new CustomEvent('integrity-warning', {
            detail: { warningType: type, warningsCount: data.warningsCount, autoSubmitted: true }
          }))
        } else {
          // Dispatch event for TestPlayer to show warning modal
          window.dispatchEvent(new CustomEvent('integrity-warning', {
            detail: { warningType: type, warningsCount: data.warningsCount, autoSubmitted: false }
          }))
        }
      }
    } catch (error) {
      console.error('Failed to send integrity warning:', error)
    }
  }, [testId, attemptId, onWarning])

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendWarning('TAB_SWITCH', { timestamp: Date.now() })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [sendWarning])

  // Window blur detection
  useEffect(() => {
    const handleBlur = () => {
      // Only warn if not in fullscreen (fullscreen exit is handled separately)
      if (!document.fullscreenElement) {
        sendWarning('WINDOW_BLUR', { timestamp: Date.now() })
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [sendWarning])

  // Fullscreen exit detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        sendWarning('FULLSCREEN_EXIT', { timestamp: Date.now() })
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [sendWarning])

  // Copy/Paste detection
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      sendWarning('COPY_ATTEMPT', { timestamp: Date.now() })
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      sendWarning('PASTE_ATTEMPT', { timestamp: Date.now() })
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      sendWarning('RIGHT_CLICK', { timestamp: Date.now() })
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [sendWarning])

  // Keyboard shortcuts detection (DevTools, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U - DevTools shortcuts
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault()
        sendWarning('RIGHT_CLICK', { timestamp: Date.now(), reason: 'DevTools shortcut' })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sendWarning])

  // Prevent drag and drop
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
    }

    document.addEventListener('dragstart', handleDragStart)
    return () => document.removeEventListener('dragstart', handleDragStart)
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isSubmittedRef.current = true
    }
  }, [])

  // This component doesn't render anything visible
  return null
}