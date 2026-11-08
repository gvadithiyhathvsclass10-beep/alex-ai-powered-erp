"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface UseSpeechRecognitionOptions {
  onResult?: (text: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
  continuous?: boolean
  interimResults?: boolean
  language?: string
}

interface UseSpeechRecognitionReturn {
  transcript: string
  isListening: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  error: string | null
  isSupported: boolean
}

export function useSpeechRecognition({
  onResult,
  onEnd,
  onError,
  continuous = false,
  interimResults = true,
  language = "en-US"
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false)

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript("")
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser")
      return
    }

    if (isListeningRef.current) return

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language

    recognition.onstart = () => {
      setIsListening(true)
      isListeningRef.current = true
      setError(null)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const fullTranscript = finalTranscript || interimTranscript
      setTranscript(fullTranscript)

      if (onResult && finalTranscript) {
        onResult(finalTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error)
      setError(errorMessage)
      if (onError) onError(errorMessage)
      setIsListening(false)
      isListeningRef.current = false
    }

    recognition.onend = () => {
      setIsListening(false)
      isListeningRef.current = false
      if (onEnd) onEnd()
    }

    try {
      recognition.start()
    } catch (err) {
      const errorMessage = "Failed to start speech recognition"
      setError(errorMessage)
      if (onError) onError(errorMessage)
      setIsListening(false)
      isListeningRef.current = false
    }
  }, [continuous, interimResults, language, onResult, onEnd, onError, isSupported])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported
  }
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "no-speech":
      return "No speech was detected. Please try again."
    case "audio-capture":
      return "Audio capture failed. Please check your microphone."
    case "not-allowed":
      return "Microphone access denied. Please allow microphone access."
    case "network":
      return "Network error occurred. Please check your connection."
    case "aborted":
      return "Speech recognition was aborted."
    case "service-not-allowed":
      return "Speech recognition service not allowed."
    case "bad-grammar":
      return "Grammar error in recognition."
    case "language-not-supported":
      return "Language not supported."
    default:
      return `Speech recognition error: ${error}`
  }
}