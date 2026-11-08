"use client"

import { useState, useCallback, useEffect, useRef } from "react"

interface SpeechSynthesisOptions {
  voice?: SpeechSynthesisVoice | null
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
  onBoundary?: (event: SpeechSynthesisEvent) => void
}

interface UseSpeechSynthesisReturn {
  speak: (text: string, options?: SpeechSynthesisOptions) => void
  cancel: () => void
  pause: () => void
  resume: () => void
  isSpeaking: boolean
  isSupported: boolean
  error: string | null
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isSpeakingRef = useRef(false)

  // Check browser support
  useEffect(() => {
    setIsSupported("speechSynthesis" in window)
  }, [])

  const speak = useCallback((
    text: string,
    options: SpeechSynthesisOptions = {}
  ) => {
    if (!isSupported) {
      setError("Speech synthesis is not supported in this browser")
      return
    }

    if (!text.trim()) return

    // Cancel any ongoing speech
    cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance

    // Set voice if provided
    if (options.voice) {
      utterance.voice = options.voice
    }

    // Set other options
    utterance.rate = options.rate ?? 1
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1

    utterance.onstart = () => {
      setIsSpeaking(true)
      isSpeakingRef.current = true
      if (options.onStart) options.onStart()
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      isSpeakingRef.current = false
      utteranceRef.current = null
      if (options.onEnd) options.onEnd()
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      const errorMessage = getErrorMessage(event.error)
      setError(errorMessage)
      if (options.onError) options.onError(errorMessage)
      setIsSpeaking(false)
      isSpeakingRef.current = false
      utteranceRef.current = null
    }

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (options.onBoundary) options.onBoundary(event)
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch (err) {
      const errorMessage = "Failed to start speech synthesis"
      setError(errorMessage)
    }
  }, [])

  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    isSpeakingRef.current = false
    utteranceRef.current = null
  }, [])

  const pause = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause()
    }
  }, [])

  const resume = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume()
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
    error
  }
}

function getErrorMessage(error: SpeechSynthesisErrorCode): string {
  switch (error) {
    case "canceled":
      return "Speech synthesis was canceled"
    case "interrupted":
      return "Speech synthesis was interrupted"
    case "audio-busy":
      return "Audio system is busy"
    case "audio-hardware":
      return "Audio hardware error"
    case "network":
      return "Network error during speech synthesis"
    case "synthesis-unavailable":
      return "Speech synthesis unavailable"
    case "synthesis-failed":
      return "Speech synthesis failed"
    case "language-unavailable":
      return "Language not available for synthesis"
    case "voice-unavailable":
      return "Selected voice unavailable"
    case "text-too-long":
      return "Text too long for synthesis"
    case "invalid-argument":
      return "Invalid argument for synthesis"
    default:
      return `Speech synthesis error: ${error}`
  }
}