"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Send,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
  Sparkles,
} from "lucide-react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  sources?: Source[]
  createdAt: string
}

interface Citation {
  id: string
  documentId: string
  documentTitle: string
  pageNumber: number | null
  sectionTitle: string | null
  excerpt: string
  relevanceScore: number
}

interface Source {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  pageNumber: number | null
  sectionTitle: string | null
  similarity: number
  document: {
    id: string
    title: string
    fileName: string
    documentType: string
    ownerId: string
  }
}

interface RAGChatProps {
  subjectId?: string
  projectId?: string
  notebookId?: string
  documentIds?: string[]
  initialMessages?: Message[]
}

export function RAGChat({
  subjectId,
  projectId,
  notebookId,
  documentIds,
  initialMessages = [],
}: RAGChatProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = React.useState<Message[]>(initialMessages)
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSources, setShowSources] = React.useState<Record<string, boolean>>({})
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          subjectId,
          projectId,
          notebookId,
          documentIds,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Query failed')
      }

      return response.json()
    },
    onSuccess: (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        sources: data.sources,
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, newMessage])
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

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    sendMessage.mutate(input)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Assistant
          <span className="text-xs text-muted-foreground">(RAG)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 pb-4">
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                showSources={showSources[message.id]}
                onToggleSources={() => setShowSources(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                onCopy={copyToClipboard}
              />
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3 animate-pulse">
                    <div className="h-4 bg-muted-foreground/50 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted-foreground/50 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <Separator />
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask a question about your documents..."
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1 min-h-[80px] max-h-[200px] resize-none"
              disabled={isLoading}
              rows={2}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="lg"
              className="self-end"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            Powered by your documents. Answers include citations to source material.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

interface MessageBubbleProps {
  message: Message
  showSources: boolean
  onToggleSources: () => void
  onCopy: (text: string) => void
}

function MessageBubble({ message, showSources, onToggleSources, onCopy }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      )}>
        {isUser ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn(
        "flex-1 max-w-[85%]",
        isUser ? "text-right" : "text-left"
      )}>
        <div className={cn(
          "inline-block rounded-2xl px-4 py-2",
          isUser ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
        )}>
          <div className="whitespace-pre-wrap">{message.content}</div>
          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.citations.map((citation, index) => (
                <Badge
                  key={citation.id}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={() => navigator.clipboard.writeText(citation.excerpt)}
                >
                  [{index + 1}] {citation.documentTitle}
                  {citation.pageNumber && <span className="ml-1">p.{citation.pageNumber}</span>}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{formatRelativeTime(message.createdAt)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCopy(message.content)}
            title="Copy message"
          >
            <Copy className="h-3 w-3" />
          </Button>
          {((message.citations && message.citations.length > 0) || (message.sources && message.sources.length > 0)) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleSources}
              title={showSources ? "Hide sources" : "Show sources"}
            >
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
        </div>
        {showSources && (
          <div className="mt-2 ml-10 mr-2 space-y-2 border-l-2 border-muted pl-3">
            {message.sources?.map((source, index) => (
              <SourceCard key={source.id} source={source} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface SourceCardProps {
  source: Source
  index: number
}

function SourceCard({ source, index }: SourceCardProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm">{source.document.title}</span>
        <Badge variant="outline" className="text-xs">
          {Math.round(source.similarity * 100)}%
        </Badge>
      </div>
      {source.pageNumber && (
        <span className="text-xs text-muted-foreground">Page {source.pageNumber}</span>
      )}
      {source.sectionTitle && (
        <span className="text-xs text-muted-foreground">Section: {source.sectionTitle}</span>
      )}
      <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
        {source.content}
      </div>
    </div>
  )
}