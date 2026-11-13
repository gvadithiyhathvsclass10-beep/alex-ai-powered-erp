"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Mic, MicOff, AlertCircle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSpeechToText } from "@/hooks/use-speech-to-text"

interface VoiceInputButtonProps {
  /** Callback when final transcript is ready */
  onTranscript?: (transcript: string) => void
  /** Current text input value (to show voice input indicator) */
  inputValue?: string
  /** Setter for input value (to append transcript) */
  setInputValue?: (value: string) => void
  /** Disabled state */
  disabled?: boolean
  /** Loading state (e.g., AI is responding) */
  isLoading?: boolean
  /** Custom className */
  className?: string
  /** Language for recognition */
  language?: string
  /** Show audio level visualization */
  showAudioLevel?: boolean
  /** Tooltip text when not supported */
  unsupportedMessage?: string
}

/**
 * Reusable voice input button component.
 * Can be used in any chat composer or text input area.
 * 
 * Usage:
 * ```tsx
 * <VoiceInputButton
 *   onTranscript={(text) => setInput(prev => prev + " " + text)}
 *   inputValue={input}
 *   setInputValue={setInput}
 * />
 * ```
 */
export function VoiceInputButton({
  onTranscript,
  inputValue = "",
  setInputValue,
  disabled = false,
  isLoading = false,
  className,
  language = "en-US",
  showAudioLevel = true,
  unsupportedMessage = "Speech recognition not supported in this browser",
}: VoiceInputButtonProps) {
  const {
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
  } = useSpeechToText({
    language,
    onResult: onTranscript,
    continuous: false,
    interimResults: true,
  })

  // Show voice input indicator above the text input
  const showVoiceIndicator = transcript || interimTranscript

  const handleClick = () => {
    if (isListening) {
      stopListening()
    } else if (isSupported && !isLoading && !disabled) {
      startListening()
    }
  }

  return (
    <div className={cn("relative", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? "destructive" : isSupported ? "outline" : "outline"}
              size="icon"
              className={cn(
                "h-10 w-10 rounded-xl transition-all",
                isListening ? "bg-destructive/10 border-destructive/20 animate-pulse" : "hover:bg-primary/10",
                !isSupported && "opacity-50 cursor-not-allowed",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleClick}
              disabled={disabled || isLoading || (!isSupported && !isListening)}
              aria-label={isListening ? "Stop listening" : isSupported ? "Start voice input" : unsupportedMessage}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : isSupported ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5 opacity-50" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            {isListening ? "Stop listening" : isSupported ? "Voice input" : unsupportedMessage}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Audio level indicator when recording */}
      {isListening && showAudioLevel && (
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

      {/* Voice input indicator (shows transcript above input) */}
      {showVoiceIndicator && (
        <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-yellow-50/50 border border-yellow-200/50 rounded-lg text-xs text-yellow-800 dark:text-yellow-900 animate-in slide-in-from-bottom-2">
          <span className="font-medium">Voice input: </span>
          <span>{transcript}{interimTranscript && <span className="text-yellow-600">{interimTranscript}</span>}</span>
        </div>
      )}

      {/* Error display with retry */}
      {error && (
        <div className="absolute bottom-full left-0 right-0 mb-1 p-2 bg-red-50/50 border border-red-200/50 rounded-lg text-xs text-red-800 dark:text-red-900 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
          <span>
            <AlertCircle className="h-3 w-3 inline mr-1" />
            {error}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={retryListening} aria-label="Retry voice input">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}