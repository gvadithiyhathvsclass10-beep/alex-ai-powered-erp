"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Bot,
  AlertCircle,
  CheckCircle2,
  BookmarkPlus,
  Sparkles,
  Zap,
  FileText,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

export interface Citation {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  excerpt: string
  relevanceScore: number
}

export interface SourceItem {
  id: string
  documentId: string
  documentTitle?: string
  content?: string
  excerpt?: string
  chunkIndex?: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  document?: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  sources?: SourceItem[]
  isSourceSupported?: boolean
  groundingStatus?: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "NO_SOURCES"
  groundingNote?: string
  createdAt: string
  provider?: string
  model?: string
}

interface RAGChatProps {
  conversationId?: string
  onConversationCreated?: (id: string) => void
  onSaveAsNote?: (title: string, content: string) => void
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  sourceIds?: string[]
  initialMessages?: Message[]
}

export function RAGChat({
  conversationId,
  onConversationCreated,
  onSaveAsNote,
  subjectId,
  projectId,
  notebookId,
  documentIds,
  sourceIds,
  initialMessages = [],
}: RAGChatProps) {
  const queryClient = useQueryClient()
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(
    conversationId
  )
  const [messages, setMessages] = React.useState<Message[]>(initialMessages)
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSources, setShowSources] = React.useState<Record<string, boolean>>({})
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // Sync conversationId prop to state
  React.useEffect(() => {
    setActiveConversationId(conversationId)
  }, [conversationId])

  // Reset when context changes (notebookId, projectId, subjectId)
  React.useEffect(() => {
    if (!conversationId) {
      setActiveConversationId(undefined)
      setMessages(initialMessages)
    }
  }, [notebookId, projectId, subjectId, conversationId, initialMessages])

  const {
    data: conversationData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    error: historyError,
  } = useQuery({
    queryKey: ["conversation", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null
      const res = await fetch(`/api/conversations/${activeConversationId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load conversation messages")
      }
      return res.json()
    },
    enabled: Boolean(activeConversationId),
  })

  // Load conversation messages when data is available
  React.useEffect(() => {
    if (!activeConversationId) {
      return
    }
    if (conversationData?.messages && Array.isArray(conversationData.messages)) {
      setMessages((prevMessages) => {
        // Only update if we have new data
        const newMessages = conversationData.messages.map((m: { id: string; role: string; content: string; metadata?: Record<string, unknown>; createdAt?: string }) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          citations: m.metadata?.citations || [],
          sources: m.metadata?.sources || [],
          isSourceSupported: m.metadata?.isSourceSupported,
          groundingStatus: m.metadata?.groundingStatus,
          groundingNote: m.metadata?.groundingNote,
          provider: m.metadata?.provider,
          model: m.metadata?.model,
          createdAt: m.createdAt || new Date().toISOString(),
        }))
        // Prevent unnecessary updates
        if (prevMessages.length === newMessages.length && 
            prevMessages.every((msg, i) => msg.id === newMessages[i].id)) {
          return prevMessages
        }
        return newMessages
      })
    }
  }, [activeConversationId, conversationData])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: activeConversationId,
          subjectId,
          projectId,
          notebookId,
          documentIds,
          sourceIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Query failed")
      }

      return response.json()
    },
    onSuccess: (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        sources: data.sources || [],
        isSourceSupported: data.isSourceSupported,
        groundingStatus: data.groundingStatus,
        groundingNote: data.groundingNote,
        provider: data.provider,
        model: data.model,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, newMessage])
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      if (data.conversationId) {
        setActiveConversationId(data.conversationId)
        queryClient.invalidateQueries({ queryKey: ["conversation", data.conversationId] })
        if (!conversationId && onConversationCreated) {
          onConversationCreated(data.conversationId)
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)
    sendMessage.mutate(currentInput)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <Card className="flex flex-col h-full panel">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary flex-shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {conversationData?.conversation?.title ||
                  (notebookId ? "Notebook Grounded Q&A" : "AI Assistant")}
                <Badge 
                  variant="outline" 
                  className="text-xs font-normal ml-2 border-primary/30 text-primary bg-primary/10"
                >
                  {notebookId ? "Source-Grounded" : "RAG"}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeConversationId 
                  ? `Conversation • ${conversationData?.conversation?._count?.messages || 0} messages`
                  : "Start a new conversation"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {activeConversationId && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 hover:bg-secondary"
                onClick={() => {
                  setActiveConversationId(undefined)
                  setMessages([])
                }}
              >
                <Sparkles className="h-3 w-3" />
                New Thread
              </Button>
            )}
            
            {/* Provider indicator */}
            {conversationData?.conversation && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary border border-border/50 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span>{conversationData.conversation.provider || "AI"}</span>
                <span className="text-muted-foreground/50">/</span>
                <span>{conversationData.conversation.model || "default"}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 pb-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading conversation history...</span>
              </div>
            ) : isHistoryError ? (
              <div className="flex items-center justify-center py-8 text-destructive gap-2">
                <AlertCircle className="h-5 w-5" />
                <span>
                  {historyError instanceof Error ? historyError.message : "Failed to load conversation"}
                </span>
              </div>
            ) : messages.length === 0 ? (
              <WelcomeEmptyState notebookId={notebookId} />
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showSources={Boolean(showSources[message.id])}
                  onToggleSources={() =>
                    setShowSources((prev) => ({ ...prev, [message.id]: !prev[message.id] }))
                  }
                  onCopy={copyToClipboard}
                  onSaveAsNote={onSaveAsNote}
                />
              ))
            )}
            {isLoading && (
              <LoadingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        <Separator className="border-border/50" />
        <form onSubmit={handleSubmit} className="mt-4 space-y-2">
          <div className="flex gap-2">
            <Textarea
              placeholder={
                notebookId
                  ? "Ask a question or follow-up grounded in your notebook sources..."
                  : "Ask a question about your documents or coursework..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              className="flex-1 min-h-[80px] max-h-[200px] resize-none input-futuristic"
              disabled={isLoading}
              rows={2}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="lg"
              className="self-end h-12 btn-primary-gradient"
            >
              <span className="flex items-center gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isLoading ? "Sending..." : "Send"}</span>
              </span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 text-center">
            Responses cite source title, page, and section when supported, and explicitly identify unsupported questions.
            {notebookId && " Notebook mode: answers cite exact source, page, and section."}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

function WelcomeEmptyState({ notebookId }: { notebookId?: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="relative mx-auto mb-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary">
          <Bot className="h-8 w-8 text-primary-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {notebookId ? "Notebook Grounded Q&A" : "No messages yet"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {notebookId
          ? "Ask a question about your notebook sources. Answers cite the exact source, page, and section, and clearly flag unsupported topics."
          : "Ask a question below to begin your conversation with ALEX."}
      </p>
    </div>
  )
}

function LoadingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="bg-secondary border border-border/50 rounded-lg p-3 animate-pulse">
          <div className="h-4 bg-primary/20 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-primary/20 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  showSources: boolean
  onToggleSources: () => void
  onCopy: (text: string) => void
  onSaveAsNote?: (title: string, content: string) => void
}

function MessageBubble({
  message,
  showSources,
  onToggleSources,
  onCopy,
  onSaveAsNote,
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const hasCitations = Boolean(message.citations && message.citations.length > 0)
  const hasSources = Boolean(message.sources && message.sources.length > 0)
  const isSupported =
    message.isSourceSupported !== undefined
      ? message.isSourceSupported
      : message.groundingStatus === "SUPPORTED" || hasCitations

  const groundingStatusColor = {
    SUPPORTED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    PARTIAL: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    UNSUPPORTED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    NO_SOURCES: "text-muted-foreground bg-muted border-border/50",
  }

  return (
    <div className={cn("flex gap-3 animate-in", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-gradient-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn("flex-1 max-w-[85%]", isUser ? "text-right" : "text-left")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-3",
            isUser ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-secondary border border-border/50 rounded-tl-none"
          )}
        >
          {/* Grounding Status Badge */}
          {!isUser && (message.groundingStatus || message.isSourceSupported !== undefined) && (
            <div className="mb-2.5 flex items-center gap-2 flex-wrap">
              {message.groundingStatus && (
                <Badge
                  variant="outline"
                  className={cn("text-[11px] flex items-center gap-1", groundingStatusColor[message.groundingStatus])}
                >
                  {message.groundingStatus === "SUPPORTED" && <CheckCircle2 className="h-3 w-3" />}
                  {message.groundingStatus === "PARTIAL" && <AlertCircle className="h-3 w-3" />}
                  {message.groundingStatus === "UNSUPPORTED" && <AlertCircle className="h-3 w-3" />}
                  {message.groundingStatus === "NO_SOURCES" && <FileText className="h-3 w-3" />}
                  {message.groundingStatus === "SUPPORTED" && "Source-Supported"}
                  {message.groundingStatus === "PARTIAL" && "Partially Supported"}
                  {message.groundingStatus === "UNSUPPORTED" && "Not Supported by Sources"}
                  {message.groundingStatus === "NO_SOURCES" && "No Sources Available"}
                </Badge>
              )}
              {message.groundingNote && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {message.groundingNote}
                </span>
              )}
            </div>
          )}

          {/* Message Content with Markdown */}
          <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
            {message.content}
          </div>

          {/* Citations */}
          {hasCitations && (
            <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
              {message.citations!.map((citation, index) => (
                <Badge
                  key={citation.id || index}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 flex items-center gap-1"
                  onClick={() => navigator.clipboard.writeText(citation.excerpt || "")}
                  title={citation.excerpt}
                >
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                    {index + 1}
                  </span>
                  <span className="truncate max-w-[200px]">{citation.documentTitle}</span>
                  {citation.pageNumber && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-secondary text-muted-foreground">
                      p.{citation.pageNumber}
                    </span>
                  )}
                  {citation.sectionTitle && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent/20 text-accent">
                      {citation.sectionTitle}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Model Info */}
          {!isUser && (message.provider || message.model) && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {message.provider && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                    {message.provider}
                  </span>
                )}
                {message.model && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-accent/10 text-accent">
                    {message.model}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(message.createdAt)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 mt-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-secondary"
            onClick={() => onCopy(message.content)}
            title="Copy message"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!isUser && onSaveAsNote && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-secondary"
              onClick={() =>
                onSaveAsNote(
                  `Q&A Note (${new Date().toLocaleDateString()})`,
                  message.content
                )
              }
              title="Save answer to Notebook Notes"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </Button>
          )}
          {(hasCitations || hasSources) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-secondary"
              onClick={onToggleSources}
              title={showSources ? "Hide cited excerpts" : "Show cited excerpts"}
            >
              {showSources ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
        
        {showSources && (
          <div className="mt-2 ml-4 mr-2 space-y-2 border-l-2 border-primary/20 pl-3 animate-in">
            {(message.sources && message.sources.length > 0
              ? message.sources
              : (message.citations || []).map(c => ({
                  id: c.id,
                  documentId: c.documentId,
                  documentTitle: c.documentTitle,
                  pageNumber: c.pageNumber,
                  sectionTitle: c.sectionTitle,
                  similarity: c.relevanceScore,
                  excerpt: c.excerpt,
                }))
            ).map((source, index) => (
              <SourceCard key={source.id || index} source={source} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface SourceCardProps {
  source: SourceItem
  index: number
}

function SourceCard({ source, index }: SourceCardProps) {
  const title = source.documentTitle || source.document?.title || `Source ${index + 1}`
  const text = source.excerpt || source.content || ""
  return (
    <div className="bg-secondary/50 border border-border/50 rounded-lg p-3 hover:border-primary/20 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm flex items-center gap-1">
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
            {index + 1}
          </span>
          {title}
        </span>
        {typeof source.similarity === "number" && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
            {Math.round(source.similarity * 100)}% match
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {source.pageNumber && <span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />Page {source.pageNumber}</span>}
        {source.sectionTitle && <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" />Section: {source.sectionTitle}</span>}
      </div>
      {text && <div className="mt-2 text-xs text-muted-foreground/80 whitespace-pre-wrap bg-background/50 p-2 rounded">{text}</div>}
    </div>
  )
}