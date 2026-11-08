"use client"

import * as React from "react"
import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Mic, MicOff, Volume2, VolumeX, Send, StopCircle, Loader2,
  Copy, CheckCircle2, AlertCircle, Mic2, MessageSquare,
  Trash2, Settings, History, Brain, Sparkles, Volume2 as Volume2Icon,
  X, Minimize2, Maximize2, ChevronDown, Plus
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis"
import { Message, Conversation } from "./types"

interface VoiceAssistantProps {
  onNavigate?: (href: string) => void
}

export function VoiceAssistant({ onNavigate }: VoiceAssistantProps) {
  const queryClient = useQueryClient()
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isListening, setIsListening] = React.useState(false)
  const [isSpeaking, setIsSpeaking] = React.useState(false)
  const [inputText, setInputText] = React.useState("")
  const [transcript, setTranscript] = React.useState("")
  const [selectedVoice, setSelectedVoice] = React.useState<SpeechSynthesisVoice | null>(null)
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([])
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice")
  const [activeTab, setActiveTab] = React.useState("chat")
  const [showSettings, setShowSettings] = React.useState(false)

  // Load voices on mount
  React.useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      if (availableVoices.length > 0) {
        setVoices(availableVoices)
        const englishVoice = availableVoices.find(v => v.lang.startsWith("en"))
        if (englishVoice && !selectedVoice) setSelectedVoice(englishVoice)
      }
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [selectedVoice])

  // Speech Recognition Hook
  const {
    transcript: recognizedText,
    isListening: recognitionListening,
    startListening,
    stopListening,
    resetTranscript,
    error: recognitionError,
    isSupported: isSpeechRecognitionSupported
  } = useSpeechRecognition({
    onResult: (text) => setTranscript(text),
    onEnd: () => setIsListening(false),
    continuous: false,
    interimResults: true
  })

  // Speech Synthesis Hook
  const {
    speak,
    cancel,
    isSpeaking: synthesisSpeaking,
    isSupported: isSpeechSynthesisSupported
  } = useSpeechSynthesis()

  // Sync states
  const isListening = recognitionListening
  const isSpeaking = synthesisSpeaking

  // Load conversation history
  const { data: conversationsData } = useQuery({
    queryKey: ["voice-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/voice-assistant/conversations")
      if (!res.ok) throw new Error("Failed to fetch conversations")
      return res.json()
    }
  })

  const conversations = conversationsData?.conversations || []

  // Load messages for current conversation
  const { data: messagesData } = useQuery({
    queryKey: ["voice-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      const res = await fetch(`/api/voice-assistant/conversations/${conversationId}/messages`)
      if (!res.ok) throw new Error("Failed to fetch messages")
      return res.json()
    },
    enabled: !!conversationId
  })

  const messagesFromApi = messagesData?.messages || []
  const allMessages = [...messagesFromApi, ...messages]

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/voice-assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      })
      if (!res.ok) throw new Error("Failed to create conversation")
      return res.json()
    },
    onSuccess: (data) => {
      const conv = data?.conversation || data
      if (conv?.id) {
        setConversationId(conv.id)
        queryClient.invalidateQueries({ queryKey: ["voice-conversations"] })
      }
    },
    onError: (err) => toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create conversation", variant: "destructive" })
  })

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ text, conversationId: convId }: { text: string; conversationId: string }) => {
      const res = await fetch("/api/voice-assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, conversationId: convId })
      })
      if (!res.ok) throw new Error("Failed to send message")
      return res.json()
    },
    onSuccess: (data) => {
      const response = data?.response || data?.message
      if (response) {
        setMessages(prev => [...prev, { role: "assistant", content: response, timestamp: new Date().toISOString() }])
        if (inputMode === "voice" && selectedVoice) {
          speak(response, { voice: selectedVoice })
        }
      }
      queryClient.invalidateQueries({ queryKey: ["voice-messages", conversationId] })
      setIsProcessing(false)
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send message", variant: "destructive" })
      setIsProcessing(false)
    }
  })

  // Handle sending text message
  const handleSendText = () => {
    if (!inputText.trim() || isProcessing) return
    if (!conversationId) {
      createConversation.mutate("Voice Assistant Chat")
      setTimeout(() => {
        if (conversationId) {
          sendMessage.mutate({ text: inputText, conversationId })
        }
      }, 500)
    } else {
      sendMessage.mutate({ text: inputText, conversationId })
    }
    setInputText("")
  }

  // Handle voice input
  const handleVoiceInput = async () => {
    if (!isSpeechRecognitionSupported) {
      toast({ title: "Not Supported", description: "Speech recognition is not supported in this browser", variant: "destructive" })
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    resetTranscript()
    setIsListening(true)
    startListening()
  };  

  // Handle transcript result
  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      const text = transcript.trim()
      if (text) {
        setInputText(text)
        if (!conversationId) {
          createConversation.mutate("Voice Assistant Chat")
          setTimeout(() => {
            if (conversationId) {
              sendMessage.mutate({ text, conversationId })
            }
          }, 500)
        } else {
          sendMessage.mutate({ text, conversationId })
        }
        resetTranscript()
      }
    }, [transcript, isListening, isProcessing, conversationId]);

  // Handle speaking response
  const handleSpeakResponse = (text: string) => {
    if (selectedVoice && isSpeechSynthesisSupported) {
      speak(text, { voice: selectedVoice })
    }
  }

  // Stop speaking
  const handleStopSpeaking = () => {
    cancel()
    setIsSpeaking(false)
  }

  // Copy message to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voice-assistant/conversations/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete conversation")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-conversations"] })
      if (conversationId === conversationId) setConversationId(null)
      setMessages([])
      toast({ title: "Conversation deleted" })
    },
    onError: (err) => toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete", variant: "destructive" })
  })

  // Check browser support
  const isVoiceSupported = isSpeechRecognitionSupported && isSpeechSynthesisSupported

  return (
    <div className="flex h-[100dvh] min-h-0 bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4 sm:px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Voice Assistant</h1>
              <p className="text-xs text-muted-foreground">Your personal AI academic mentor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Voice Support Indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    isVoiceSupported ? "bg-green-500/20 text-green-600" : "bg-destructive/20 text-destructive"
                  )}>
                    {isVoiceSupported ? (
                      <>
                        <Volume2Icon className="h-3 w-3" />
                        <Mic2 className="h-3 w-3" />
                      </>
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    <span>{isVoiceSupported ? "Voice Ready" : "Voice Unavailable"}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isVoiceSupported 
                    ? "Speech recognition and synthesis are available" 
                    : "Speech recognition or synthesis not supported in this browser"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Settings */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(!showSettings)}
                    className="h-9 w-9 rounded-lg"
                    aria-label={showSettings ? "Close settings" : "Open settings"}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* New Conversation */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => createConversation.mutate("Voice Assistant Chat")}
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />
            <div className="relative w-full max-w-sm bg-background border-l border-border h-full p-4 overflow-y-auto animate-in slide-in-from-right">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Voice Assistant Settings</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Voice Selection</Label>
                  <Select value={selectedVoice?.name || ""} onValueChange={(name) => {
                    const voice = voices.find(v => v.name === name)
                    if (voice) setSelectedVoice(voice)
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          <div className="flex items-center gap-2">
                            <span className="flex-1">{voice.name}</span>
                            <span className="text-xs text-muted-foreground">{voice.lang}</span>
                            {voice.default && <CheckCircle2 className="h-3 w-3 text-primary" />}
                          </div>
                        </SelectItem>
                      ))}
                      {voices.length === 0 && (
                        <SelectItem value="" disabled>No voices available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Input Mode</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={inputMode === "voice" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setInputMode("voice")}
                      disabled={!isSpeechRecognitionSupported}
                    >
                      <Mic2 className="mr-2 h-4 w-4" />
                      Voice
                      {!isSpeechRecognitionSupported && <span className="ml-1 text-xs">(Unavailable)</span>}
                    </Button>
                    <Button
                      variant={inputMode === "text" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setInputMode("text")}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Text
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Auto-speak responses</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="auto-speak"
                      checked={!!selectedVoice}
                      onChange={(e) => {
                        if (e.target.checked && !selectedVoice) {
                          const englishVoice = voices.find(v => v.lang.startsWith("en"))
                          if (englishVoice) setSelectedVoice(englishVoice)
                        }
                      }}
                    />
                    <Label htmlFor="auto-speak" className="text-sm cursor-pointer">
                      Speak AI responses automatically
                    </Label>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button variant="destructive" className="w-full" onClick={() => { setShowSettings(false); toast({ title: "Settings saved" }) }}>
                    Save & Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="border-b border-border/50 bg-background/50">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col">
              {/* Conversation Area */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {allMessages.length === 0 ? (
                    <EmptyState
                      icon={Brain}
                      title="Welcome to your AI Academic Mentor"
                      description="Start a conversation by voice or text. I can help with explanations, study planning, exam prep, and more."
                      action={
                        <Button
                          variant="default"
                          className="w-full sm:w-auto btn-primary-gradient"
                          onClick={() => createConversation.mutate("Voice Assistant Chat")}
                          disabled={isProcessing}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Start New Conversation
                        </Button>
                      }
                    />
                  ) : (
                    <>
                      {allMessages.map((msg, index) => (
                        <MessageBubble
                          key={`${msg.role}-${msg.timestamp}-${index}`}
                          message={msg}
                          onCopy={() => copyToClipboard(msg.content)}
                          onSpeak={() => handleSpeakResponse(msg.content)}
                          isSpeaking={isSpeaking}
                          onStopSpeak={handleStopSpeaking}
                        />
                      ))}
                      {isProcessing && (
                        <MessageBubble
                          message={{ role: "assistant", content: "", timestamp: new Date().toISOString() }}
                          isStreaming
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Error Display */}
                {recognitionError && (
                  <div className="mx-4 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    {recognitionError}
                  </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-border/50 bg-background/50">
                  <div className="flex items-end gap-2">
                    {inputMode === "voice" ? (
                      <div className="flex-1 flex items-center gap-2">
                        {transcript && (
                          <div className="flex-1 px-4 py-2 bg-secondary rounded-lg text-sm text-foreground">
                            {transcript}
                          </div>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={isListening ? "destructive" : "default"}
                                size="lg"
                                className={cn("h-12 w-12 rounded-full", isListening ? "animate-pulse bg-destructive/10 border-destructive/20" : "btn-primary-gradient")}
                                onClick={handleVoiceInput}
                                disabled={!isSpeechRecognitionSupported || isProcessing}
                                aria-label={isListening ? "Stop listening" : "Start listening"}
                              >
                                {isListening ? (
                                  <MicOff className="h-6 w-6" />
                                ) : (
                                  <Mic2 className="h-6 w-6" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {isListening ? "Stop listening" : "Start voice input"}
                              {!isSpeechRecognitionSupported && <span className="block text-xs">(Not supported in this browser)</span>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-end gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSendText()
                              }
                            }}
                            placeholder="Type your message..."
                            className="flex-1"
                            disabled={isProcessing}
                          />
                          <Button
                            onClick={handleSendText}
                            disabled={!inputText.trim() || isProcessing}
                            className="btn-primary-gradient"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Mode Toggle */}
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={inputMode === "voice" ? "default" : "outline"}
                              size="icon"
                              onClick={() => setInputMode("voice")}
                              disabled={!isSpeechRecognitionSupported}
                              className="h-9 w-9"
                            >
                              <Mic2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Voice input { !isSpeechRecognitionSupported && "(Unavailable)" }
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={inputMode === "text" ? "default" : "outline"}
                              size="icon"
                              onClick={() => setInputMode("text")}
                              className="h-9 w-9"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Text input</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-auto p-4">
                <div className="space-y-3">
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <History className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No conversation history</p>
                      <p className="text-sm">Your voice conversations will appear here</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <Card
                        key={conv.id}
                        className={cn("transition-all hover:shadow-md cursor-pointer", conversationId === conv.id && "ring-2 ring-primary")}
                        onClick={() => setConversationId(conv.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{conv.title}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {conv.messageCount || 0} messages · {formatRelativeTime(conv.updatedAt)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(conv.id) }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    )
  }
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  )
}

function MessageBubble({ message, onCopy, onSpeak, isSpeaking, onStopSpeak, isStreaming }: {
  message: Message
  onCopy: () => void
  onSpeak: (text: string) => void
  isSpeaking: boolean
  onStopSpeak: () => void
  isStreaming?: boolean
}) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3 animate-in", isUser ? "flex-row-reverse" : "")}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-muted">
        {isUser ? <MessageSquare className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
      </div>
      <div className={cn("flex-1 max-w-[70%] space-y-2", isUser ? "text-right" : "")}>
        <div className={cn(
          "relative px-4 py-2 rounded-2xl",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-secondary text-secondary-foreground rounded-tl-none"
        )}>
          {isStreaming ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content || ""}</p>
          )}
          <div className="absolute bottom-1 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy} aria-label="Copy">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {message.role === "assistant" && !isStreaming && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={isSpeaking ? onStopSpeak : () => onSpeak(message.content)}
                      disabled={!message.content}
                      aria-label={isSpeaking ? "Stop speaking" : "Speak response"}
                    >
                      {isSpeaking ? (
                        <StopCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2Icon className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isSpeaking ? "Stop speaking" : "Speak response"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(message.timestamp)}</p>
      </div>
    </div>
  )
}

export type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export type Conversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

function formatRelativeTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString()
}