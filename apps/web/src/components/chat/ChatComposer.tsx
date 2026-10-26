"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { 
  Send, 
  Loader2, 
  Mic, 
  MicOff, 
  Paperclip, 
  X, 
  FileText, 
  Image, 
  Download,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// SpeechRecognition types for browser compatibility
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

interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  file: File
}

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: AttachedFile[]) => void
  onVoiceInput?: (transcript: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  maxAttachments?: number
  maxFileSize?: number // in bytes
  acceptedFileTypes?: string[]
  placeholderText?: string
}

const DEFAULT_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]

export function ChatComposer({
  onSendMessage,
  onVoiceInput,
  disabled = false,
  isLoading = false,
  placeholder = "Ask a question...",
  maxAttachments = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  placeholderText,
}: ChatComposerProps) {
  const { toast } = useToast()
  const [input, setInput] = React.useState("")
  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])
  const [showAttachmentMenu, setShowAttachmentMenu] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false)
  const [transcript, setTranscript] = React.useState("")
  const [interimTranscript, setInterimTranscript] = React.useState("")
  const [isSupported, setIsSupported] = React.useState(false)
  const [recognitionError, setRecognitionError] = React.useState<string | null>(null)
  const [audioLevel, setAudioLevel] = React.useState(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Refs for voice recognition (not state, to avoid re-renders during recognition)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const audioStreamRef = React.useRef<MediaStream | null>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  const cleanupRef = React.useRef(false)

  // Check browser support on mount
  React.useEffect(() => {
    const win = window as Window & {
      SpeechRecognition?: { new(): SpeechRecognition }
      webkitSpeechRecognition?: { new(): SpeechRecognition }
      SpeechGrammarList?: { new(): SpeechGrammarList }
      webkitSpeechGrammarList?: { new(): SpeechGrammarList }
    }
    
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
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
    }
  }, [])

  const updateAudioLevel = () => {
    if (!analyserRef.current || cleanupRef.current) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0)
    const average = sum / dataArray.length
    const normalized = Math.min(average / 128, 1) // Normalize to 0-1
    
    setAudioLevel(normalized)
    
    if (!cleanupRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }

  // Create a fresh SpeechRecognition instance for each session
  const createRecognition = (): SpeechRecognition | null => {
    const win = window as Window & {
      SpeechRecognition?: { new(): SpeechRecognition }
      webkitSpeechRecognition?: { new(): SpeechRecognition }
      SpeechGrammarList?: { new(): SpeechGrammarList }
      webkitSpeechGrammarList?: { new(): SpeechGrammarList }
    }
    
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) return null
    
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.maxAlternatives = 1
    
    // Add grammar if available
    const SpeechGrammarList = win.SpeechGrammarList || win.webkitSpeechGrammarList
    if (SpeechGrammarList) {
      const grammar = new SpeechGrammarList()
      grammar.addFromString('#JSGF V1.0; grammar punctuation; public <punc> = . | ? | ! | , | ; | : ;', 1)
      recognition.grammars = grammar
    }
    
    return recognition
  }

  const startListening = async () => {
    if (isRecording || !isSupported) return
    
    setRecognitionError(null)
    
    try {
      // Request microphone access first
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
        setIsRecording(true)
        setRecognitionError(null)
      }
      
      recognition.onend = () => {
        setIsRecording(false)
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
          setTranscript(prev => prev + " " + final)
          setInput(prev => prev + " " + final)
        }
      }
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error)
        setIsRecording(false)
        
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone permission was denied. Please allow microphone access in your browser settings and try again.',
          'service-not-allowed': 'Speech recognition service is not available in this browser.',
          'no-speech': 'No speech was detected. Please try speaking closer to the microphone.',
          'audio-capture': 'No microphone found or microphone access failed. Please check your microphone.',
          'network': 'Network error occurred during speech recognition. Please check your connection.',
          'aborted': 'Voice input was cancelled.',
          'language-not-supported': 'The selected language is not supported for speech recognition.',
        }
        
        const errorMessage = messages[event.error] || `Speech recognition failed: ${event.error}`
        setRecognitionError(errorMessage)
        
        toast({
          title: "Voice input error",
          description: errorMessage,
          variant: "destructive",
        })
      }
      
      recognition.onnomatch = () => {
        setRecognitionError("No speech matched. Please try again.")
        toast({
          title: "No match",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        })
      }
      
      // Store recognition instance in a ref for cleanup
      recognitionRef.current = recognition
      
      recognition.start()
      setTranscript("")
      setInterimTranscript("")
    } catch (error) {
      console.error("Failed to start recognition:", error)
      
      let errorMessage = "Failed to start voice recognition."
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          errorMessage = "Microphone permission denied. Please allow microphone access in browser settings."
        } else if (error.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone and try again."
        } else if (error.name === "NotReadableError") {
          errorMessage = "Microphone is in use by another application."
        }
      }
      
      setRecognitionError(errorMessage)
      toast({
        title: "Voice input error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Ref to hold the current recognition instance
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)

  const stopListening = () => {
    // Stop recognition
    if (recognitionRef.current) {
      if (isRecording) {
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
    setIsRecording(false)
  }

  const retryListening = () => {
    setRecognitionError(null)
    stopListening()
    // Small delay to ensure clean state
    setTimeout(() => startListening(), 100)
  }

  const handleFileSelect = async (files: FileList) => {
    const newAttachments: AttachedFile[] = []
    
    for (let i = 0; i < Math.min(files.length, maxAttachments - attachments.length); i++) {
      const file = files[i]
      
      // Validate file type
      if (!acceptedFileTypes.some(type => 
        type === "*/*" || file.type === type || file.type.startsWith(type.replace("*", ""))
      )) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} (${file.type}) is not supported.`,
          variant: "destructive",
        })
        continue
      }
      
      // Validate file size
      if (file.size > maxFileSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the maximum size of ${Math.round(maxFileSize / 1024 / 1024)}MB.`,
          variant: "destructive",
        })
        continue
      }
      
      // Create preview for images
      let preview: string | undefined
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file)
      }
      
      newAttachments.push({
        id: `file-${Date.now()}-${i}`,
        name: file.name,
        type: file.type,
        size: file.size,
        preview,
        file,
      })
    }
    
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
    }
  }

  const removeAttachment = (id: string) => {
    const removed = attachments.find((attachment) => attachment.id === id)
    if (removed?.preview) URL.revokeObjectURL(removed.preview)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleFileClick = () => fileInputRef.current?.click()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim() + (interimTranscript ? " " + interimTranscript : "")
    if (!content.trim() && attachments.length === 0) return
    
    onSendMessage(content, attachments)
    setInput("")
    attachments.forEach((attachment) => {
      if (attachment.preview) URL.revokeObjectURL(attachment.preview)
    })
    setAttachments([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    setTranscript("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const displayInput = input + (interimTranscript ? " " + interimTranscript : "")

  return (
    <div className="flex flex-col gap-2">
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
          {attachments.map((attachment) => (
            <div 
              key={attachment.id} 
              className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/50"
            >
              {attachment.preview ? (
                <img 
                  src={attachment.preview} 
                  alt={attachment.name} 
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-8 w-8 rounded bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-xs font-medium truncate">{attachment.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(attachment.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {/* Voice Input & Attachment Area */}
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFileTypes.join(",")}
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl transition-colors hover:bg-primary/10"
              onClick={handleFileClick}
              disabled={attachments.length >= maxAttachments || disabled || isLoading}
              aria-label="Attach files"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </div>

          {/* Text Input Area */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText || placeholder}
              disabled={disabled || isLoading}
              className={cn(
                "flex-1 min-h-[60px] max-h-[200px] resize-none pr-12",
                "bg-background border-border/50 focus:border-primary/50",
                disabled && "opacity-50"
              )}
              rows={1}
              style={{ minHeight: "60px", maxHeight: "200px" }}
            />
            {transcript && (
              <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-yellow-50/50 border border-yellow-200/50 rounded-lg text-xs text-yellow-800 dark:text-yellow-900">
                <span className="font-medium">Voice input: </span>
                <span>{transcript}</span>
              </div>
            )}
            {recognitionError && (
              <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-red-50/50 border border-red-200/50 rounded-lg text-xs text-red-800 dark:text-red-900 flex items-center justify-between gap-2">
                <span>
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {recognitionError}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={retryListening} aria-label="Retry voice input">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Voice Input Button */}
          <div className="relative">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={isRecording ? "default" : isSupported ? "outline" : "outline"}
                    size="icon"
                    className={cn(
                      "h-10 w-10 rounded-xl transition-all",
                      isRecording ? "bg-red-500 text-white animate-pulse" : "hover:bg-primary/10",
                      !isSupported && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={isRecording ? stopListening : isSupported ? startListening : undefined}
                    disabled={disabled || isLoading || (!isSupported && !isRecording)}
                    aria-label={isRecording ? "Stop listening" : isSupported ? "Start voice input" : "Speech recognition not supported"}
                  >
                    {isRecording ? (
                      <MicOff className="h-5 w-5" />
                    ) : isSupported ? (
                      <Mic className="h-5 w-5" />
                    ) : (
                      <MicOff className="h-5 w-5 opacity-50" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {isRecording ? "Stop listening" : isSupported ? "Voice input" : "Speech recognition not supported in this browser"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Audio level indicator when recording */}
            {isRecording && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 px-2 py-1 bg-background border border-border rounded-lg shadow-lg">
                <span className="text-xs text-muted-foreground font-mono">Level:</span>
                <div className="flex items-end gap-1 h-8">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-t bg-primary/20 transition-all duration-75"
                      style={{
                        height: audioLevel > (i - 1) * 0.2 ? `${Math.max(8, audioLevel * 32)}px` : "8px",
                        backgroundColor: audioLevel > i * 0.18 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.2)"
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            type="submit"
            disabled={!displayInput.trim() && attachments.length === 0 || isLoading || disabled}
            size="lg"
            className={cn(
              "h-10 w-10 rounded-xl btn-primary-gradient flex-shrink-0",
              isLoading && "opacity-50"
            )}
            aria-label={isLoading ? "Sending..." : "Send message"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}