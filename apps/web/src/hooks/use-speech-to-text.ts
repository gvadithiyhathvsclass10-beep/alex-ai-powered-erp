"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  serviceURI: string
  grammars: SpeechGrammarList
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechGrammarList {
  length: number
  item(index: number): SpeechGrammar
  [index: number]: SpeechGrammar
  addFromURI(src: string, weight?: number): void
  addFromString(string: string, weight?: number): void
}

interface SpeechGrammar {
  src: string
  weight: number
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: { new(): SpeechRecognition }
  webkitSpeechRecognition?: { new(): SpeechRecognition }
  SpeechGrammarList?: { new(): SpeechGrammarList }
  webkitSpeechGrammarList?: { new(): SpeechGrammarList }
}

export interface UseSpeechToTextOptions {
  /** Called when final transcript is available */
  onResult?: (transcript: string) => void
  /** Called when recognition starts */
  onStart?: () => void
  /** Called when recognition ends */
  onEnd?: () => void
  /** Called when recognition error occurs */
  onError?: (error: string) => void
  /** Continuous recognition (default: false) */
  continuous?: boolean
  /** Return interim results (default: true) */
  interimResults?: boolean
  /** Language (default: 'en-US') */
  language?: string
  /** Auto-stop on silence (default: true) */
  autoStop?: boolean
}

export interface UseSpeechToTextReturn {
  /** Current final transcript */
  transcript: string
  /** Current interim (partial) transcript */
  interimTranscript: string
  /** Whether recognition is active */
  isListening: boolean
  /** Whether browser supports speech recognition */
  isSupported: boolean
  /** Current error message if any */
  error: string | null
  /** Audio level for visualization (0-1) */
  audioLevel: number
  /** Start listening */
  startListening: () => Promise<void>
  /** Stop listening */
  stopListening: () => void
  /** Reset transcript */
  resetTranscript: () => void
  /** Retry after error */
  retryListening: () => void
}

/**
 * Shared speech-to-text hook for all chat interfaces.
 * Provides consistent behavior across ChatComposer, RAGChat, VoiceAssistant, etc.
 */
export function useSpeechToText({
  onResult,
  onStart,
  onEnd,
  onError,
  continuous = false,
  interimResults = true,
  language = "en-US",
  autoStop = true,
}: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const cleanupRef = useRef(false)
  const isListeningRef = useRef(false)

  // Check browser support on mount
  useEffect(() => {
    const win = window as WindowWithSpeechRecognition
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current = true
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || cleanupRef.current) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const sum = dataArray.reduce((a, b) => a + b, 0)
    const average = sum / dataArray.length
    const normalized = Math.min(average / 128, 1)
    
    setAudioLevel(normalized)
    
    if (!cleanupRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [])

  const createRecognition = useCallback((): SpeechRecognition | null => {
    const win = window as WindowWithSpeechRecognition
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) return null
    
    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1
    
    // Add grammar for punctuation if available
    const SpeechGrammarList = win.SpeechGrammarList || win.webkitSpeechGrammarList
    if (SpeechGrammarList) {
      const grammar = new SpeechGrammarList()
      grammar.addFromString('#JSGF V1.0; grammar punctuation; public <punc> = . | ? | ! | , | ; | : ;', 1)
      recognition.grammars = grammar
    }
    
    return recognition
  }, [continuous, interimResults, language])

  const startListening = useCallback(async () => {
    if (isListeningRef.current || !isSupported) return
    
    setError(null)
    
    try {
      // Request microphone access directly - most reliable approach
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      audioStreamRef.current = stream
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser
      
      // Create a fresh recognition instance for this session
      const recognition = createRecognition()
      if (!recognition) {
        throw new Error("Speech recognition not supported")
      }
      
      // Start audio level visualization
      updateAudioLevel()
      
      // Set up recognition handlers
      recognition.onstart = () => {
        setIsListening(true)
        isListeningRef.current = true
        setError(null)
        onStart?.()
      }
      
      recognition.onend = () => {
        setIsListening(false)
        isListeningRef.current = false
        // Stop audio visualization
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        setAudioLevel(0)
        onEnd?.()
      }
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ""
        let final = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }
        setInterimTranscript(interim)
        if (final) {
          const newTranscript = transcript + " " + final
          setTranscript(newTranscript)
          onResult?.(final)
        }
      }
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error)
        setIsListening(false)
        isListeningRef.current = false
        
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone permission was denied. Please allow microphone access in browser settings (click 🔒 lock icon in address bar).',
          'service-not-allowed': 'Speech recognition service is not available in this browser.',
          'no-speech': 'No speech was detected. Please try speaking closer to the microphone.',
          'audio-capture': 'No microphone found or microphone access failed. Please check your microphone.',
          'network': 'Network error occurred during speech recognition. Please check your connection.',
          'aborted': 'Voice input was cancelled.',
          'language-not-supported': 'The selected language is not supported for speech recognition.',
        }
        
        const errorMessage = messages[event.error] || `Speech recognition failed: ${event.error}`
        setError(errorMessage)
        onError?.(errorMessage)
      }
      
      recognition.onnomatch = () => {
        const errorMessage = "No speech matched. Please try again."
        setError(errorMessage)
        onError?.(errorMessage)
      }
      
      // Store recognition instance in ref for cleanup
      recognitionRef.current = recognition
      
      recognition.start()
      setTranscript("")
      setInterimTranscript("")
    } catch (err) {
      console.error("Failed to start recognition:", err)
      
      let errorMessage = "Failed to start voice recognition."
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "Microphone permission denied. Please allow microphone access in browser settings (click 🔒 lock icon in address bar)."
        } else if (err.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone and try again."
        } else if (err.name === "NotReadableError") {
          errorMessage = "Microphone is in use by another application."
        } else if (err.name === "SecurityError") {
          errorMessage = "Security error: This page must be served over HTTPS (or localhost) for microphone access."
        }
      }
      
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }, [createRecognition, isSupported, onStart, onEnd, onError, transcript, updateAudioLevel])

  const stopListening = useCallback(() => {
    // Stop recognition
    if (recognitionRef.current) {
      if (isListeningRef.current) {
        recognitionRef.current.stop()
      } else {
        recognitionRef.current.abort()
      }
      recognitionRef.current = null
    }
    
    // Cleanup audio resources
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setAudioLevel(0)
    setIsListening(false)
    isListeningRef.current = false
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
  }, [])

  const retryListening = useCallback(() => {
    setError(null)
    stopListening()
    // Small delay to ensure clean state
    setTimeout(() => startListening(), 100)
  }, [startListening, stopListening])

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    audioLevel,
    startListening,
    stopListening,
    resetTranscript,
    retryListening,
  }
}