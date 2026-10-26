"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { ChatComposer } from "@/components/chat/ChatComposer"
import { MessageBubble } from "@/components/chat/ChatMessage"
import {
  Bot,
  Sparkles,
  FileText,
  Zap,
  Loader2,
  AlertCircle,
  X,
  Check,
  RotateCcw,
} from "lucide-react"

interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  file: File
}

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
  useDocuments?: boolean
  onDocumentSelectionChange?: (docIds: string[]) => void
  selectedDocumentIds?: string[]
}

export function RAGChat({
  conversationId,
  onConversationCreated,
  onSaveAsNote,
  subjectId,
  projectId,
  notebookId,
  documentIds: propDocumentIds,
  sourceIds,
  initialMessages = [],
  useDocuments: useDocumentsProp = false,
  onDocumentSelectionChange,
  selectedDocumentIds = [],
}: RAGChatProps) {
  const queryClient = useQueryClient()
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(
    conversationId
  )
  const [messages, setMessages] = React.useState<Message[]>(initialMessages)
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSources, setShowSources] = React.useState<Record<string, boolean>>({})
  const [showDocumentSelector, setShowDocumentSelector] = React.useState(false)
  const [localSelectedDocIds, setLocalSelectedDocIds] = React.useState<string[]>(selectedDocumentIds)
  const [useDocuments, setUseDocuments] = React.useState(useDocumentsProp)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, projectId, subjectId])

  // Sync selectedDocumentIds prop to local state
  React.useEffect(() => {
    setLocalSelectedDocIds(selectedDocumentIds)
  }, [selectedDocumentIds])

  // Sync useDocuments prop to local state
  React.useEffect(() => {
    setUseDocuments(useDocumentsProp)
  }, [useDocumentsProp])

  // Sync local selection to parent when it changes
  React.useEffect(() => {
    onDocumentSelectionChange?.(localSelectedDocIds)
  }, [localSelectedDocIds])

  // Fetch selected documents for display in composer
  const {
    data: selectedDocumentsData,
  } = useQuery({
    queryKey: ["selected-documents", localSelectedDocIds],
    queryFn: async () => {
      if (localSelectedDocIds.length === 0) return []
      const res = await fetch("/api/documents", { credentials: "include" })
      if (!res.ok) return []
      const data = await res.json()
      return (data.documents || []).filter((d: any) => localSelectedDocIds.includes(d.id))
    },
    enabled: localSelectedDocIds.length > 0,
  })

  const effectiveDocumentIds = localSelectedDocIds.length > 0 ? localSelectedDocIds : undefined

  const handleDocumentSelectionChange = (docIds: string[]) => {
    setLocalSelectedDocIds(docIds)
    // Auto-enable document context when documents are selected
    if (docIds.length > 0 && !useDocuments) {
      setUseDocuments(true)
    }
    onDocumentSelectionChange?.(docIds)
  }

  const handleToggleDocumentSelector = () => {
    setShowDocumentSelector(!showDocumentSelector)
  }

  const {
    data: conversationData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["conversation", activeConversationId],
    queryFn: async ({ signal }) => {
      if (!activeConversationId) return null
      const requestedConversationId = activeConversationId
      const res = await fetch(`/api/conversations/${requestedConversationId}`, { signal })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load conversation messages")
      }
      return res.json()
    },
    enabled: Boolean(activeConversationId),
    staleTime: 0,
    refetchOnMount: "always",
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
      mutationFn: async ({ query, attachments }: { query: string; attachments?: AttachedFile[] }) => {
        const formData = new FormData()
        formData.append("query", query)
        formData.append("conversationId", activeConversationId || "")
        formData.append("subjectId", subjectId || "")
        formData.append("projectId", projectId || "")
        formData.append("notebookId", notebookId || "")
        formData.append("documentIds", JSON.stringify(effectiveDocumentIds))
        formData.append("sourceIds", JSON.stringify(sourceIds))
        formData.append("useDocuments", JSON.stringify(Boolean(effectiveDocumentIds && effectiveDocumentIds.length > 0)))
        
        if (attachments && attachments.length > 0) {
          attachments.forEach((attachment, index) => {
            formData.append(`attachments[${index}]`, attachment.file)
          })
        }

        const response = await fetch("/api/rag/query", {
          method: "POST",
          body: formData,
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
          if (onConversationCreated && data.conversationId !== conversationId) {
            onConversationCreated(data.conversationId)
          }
        }
      },
      onError: (error) => {
        const detail = error instanceof Error ? error.message : "Failed to send message"
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `I couldn't get a response from the AI provider. ${detail} Check AI Settings to confirm the API key and selected model, then try again.`,
          createdAt: new Date().toISOString(),
        }])
        toast({ title: "AI response failed", description: detail, variant: "destructive" })
      },
      onSettled: () => {
        setIsLoading(false)
      },
    })

    const handleSubmit = async (content: string, attachments: AttachedFile[]) => {
      if (!content.trim() && attachments.length === 0) return
      if (isLoading) return

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)
      try {
        await sendMessage.mutateAsync({ query: content, attachments })
      } catch {
        // The mutation's onError handler already shows the actionable error message.
      }
    }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <Card className="flex min-h-0 flex-col panel">
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
                  {notebookId ? "Source-Grounded" : useDocuments ? "Document Context" : "General Chat"}
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
            
            {/* Document Context Toggle & Selector */}
            {!notebookId && (
              <div className="relative flex items-center gap-2">
                <Button
                  type="button"
                  variant={useDocuments ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={handleToggleDocumentSelector}
                >
                  <FileText className="h-3 w-3" />
                  {useDocuments ? "Documents Active" : "Add Documents"}
                </Button>
                {showDocumentSelector && (
                  <DocumentSelector
                    selectedIds={localSelectedDocIds}
                    onChange={handleDocumentSelectionChange}
                    onClose={handleToggleDocumentSelector}
                  />
                )}
              </div>
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
        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-4 pb-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading conversation history...</span>
              </div>
            ) : isHistoryError ? (
              <div className="flex items-center justify-center py-8 text-destructive gap-2">
                <AlertCircle className="h-5 w-5" />
                <div className="flex flex-col items-center gap-3">
                  <span>{historyError instanceof Error ? historyError.message : "Failed to load conversation"}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchHistory()}>
                    Retry loading history
                  </Button>
                </div>
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
        
        {/* Selected Documents from Library */}
        {useDocuments && localSelectedDocIds.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
            {(selectedDocumentsData || []).filter((d: any) => localSelectedDocIds.includes(d.id))
              .map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/30"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs font-medium truncate">{doc.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {doc.pageCount ? `${doc.pageCount} pages · ` : ''}{doc.chunksCount} chunks
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-primary hover:text-destructive"
                    onClick={() => handleDocumentSelectionChange(localSelectedDocIds.filter(id => id !== doc.id))}
                    aria-label={`Remove ${doc.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
          </div>
        )}
        
        <Separator className="border-border/50" />
        <ChatComposer
          onSendMessage={handleSubmit}
          disabled={isLoading}
          isLoading={isLoading}
          placeholder={
            notebookId
              ? "Ask a question or follow-up grounded in your notebook sources..."
              : useDocuments
              ? "Ask about your selected documents..."
              : "Ask a question..."
          }
          maxAttachments={5}
          maxFileSize={10 * 1024 * 1024}
          acceptedFileTypes={[
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
          ]}
        />
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

export interface MessageBubbleProps {
  message: Message
  showSources: boolean
  onToggleSources: () => void
  onCopy: (text: string) => void
  onSaveAsNote?: (title: string, content: string) => void
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

interface DocumentSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
  showOnlyReady?: boolean
}

interface DocumentWithStatus {
  id: string
  title: string
  fileName: string
  status: string
  pageCount: number | null
  chunksCount: number
  documentType: string
}

function DocumentSelector({ selectedIds, onChange, onClose, showOnlyReady = true }: DocumentSelectorProps) {
  const [documents, setDocuments] = React.useState<DocumentWithStatus[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchDocuments = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/documents", { credentials: "include" })
      if (!res.ok) {
        // Handle HTTP errors (401, 403, 500, etc.)
        let errorMessage = "Failed to load documents"
        try {
          const errorData = await res.json()
          if (errorData?.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Ignore JSON parse errors on error responses
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      // Validate that documents is an array
      const docs = Array.isArray(data.documents) ? data.documents : []
      // Validate each document has required fields
      const validDocs = docs.filter(
        (doc: unknown): doc is DocumentWithStatus =>
          typeof doc === "object" &&
          doc !== null &&
          typeof (doc as Record<string, unknown>).id === "string" &&
          typeof (doc as Record<string, unknown>).title === "string" &&
          typeof (doc as Record<string, unknown>).fileName === "string" &&
          typeof (doc as Record<string, unknown>).status === "string" &&
          typeof (doc as Record<string, unknown>).chunksCount === "number" &&
          typeof (doc as Record<string, unknown>).documentType === "string"
      )
      // Filter to only show READY documents for RAG if showOnlyReady is true
      const filteredDocs = showOnlyReady ? validDocs.filter(d => d.status === 'READY') : validDocs
      setDocuments(filteredDocs)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch documents"
      setError(message)
      console.error("Failed to fetch documents:", e)
    } finally {
      setIsLoading(false)
    }
  }, [showOnlyReady])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocuments()
  }, [fetchDocuments])

  const handleToggle = (docId: string) => {
    const newIds = selectedIds.includes(docId)
      ? selectedIds.filter(id => id !== docId)
      : [...selectedIds, docId]
    onChange(newIds)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      UPLOADED: { label: "Uploaded", color: "bg-gray-100 text-gray-800" },
      QUEUED: { label: "Queued", color: "bg-blue-100 text-blue-800" },
      EXTRACTING: { label: "Extracting", color: "bg-yellow-100 text-yellow-800" },
      CHUNKING: { label: "Chunking", color: "bg-yellow-100 text-yellow-800" },
      EMBEDDING: { label: "Embedding", color: "bg-yellow-100 text-yellow-800" },
      INDEXING: { label: "Indexing", color: "bg-yellow-100 text-yellow-800" },
      READY: { label: "Ready", color: "bg-green-100 text-green-800" },
      FAILED: { label: "Failed", color: "bg-red-100 text-red-800" },
    }
    const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800" }
    return <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-lg p-2 z-50">
        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading documents...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-lg p-2 z-50">
        <div className="flex flex-col items-center gap-2 py-4 text-center text-sm">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchDocuments}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Filter documents for display (showOnlyReady filtering done in fetchDocuments)
  const filteredDocuments = documents

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-sm font-medium">Select Documents</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchDocuments}
            disabled={isLoading}
            aria-label="Refresh document list"
          >
            <RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredDocuments.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {showOnlyReady 
              ? "No processed documents available for RAG. Upload and wait for processing to complete."
              : "No documents available. Upload documents first."
            }
          </div>
        ) : (
          <div className="p-1 space-y-1">
            {filteredDocuments.map((doc) => {
              const isReady = doc.status === 'READY'
              return (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => handleToggle(doc.id)}
                  disabled={!isReady}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition ${
                    selectedIds.includes(doc.id)
                      ? "bg-primary/10 border border-primary/30 text-primary"
                      : isReady
                      ? "hover:bg-secondary"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Check
                    className={`h-4 w-4 shrink-0 ${selectedIds.includes(doc.id) ? "text-primary" : "text-muted-foreground/30"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      {getStatusBadge(doc.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <p className="truncate">{doc.fileName}</p>
                      {doc.pageCount && <span>· {doc.pageCount} pages</span>}
                      {doc.chunksCount > 0 && <span>· {doc.chunksCount} chunks</span>}
                    </div>
                  </div>
                  {!isReady && (
                    <span className="text-xs text-muted-foreground ml-auto">Not ready for RAG</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{selectedIds.length} document(s) selected</span>
          <Button size="sm" variant="outline" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}