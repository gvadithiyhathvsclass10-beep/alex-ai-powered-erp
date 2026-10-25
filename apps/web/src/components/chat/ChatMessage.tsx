"use client"

import * as React from "react"
import { cn, formatRelativeTime } from "@/lib/utils"
import { 
  Copy, 
  Bot, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText as FileTextIcon
} from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
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

interface MessageBubbleProps {
  message: Message
  showSources: boolean
  onToggleSources: () => void
  onCopy: (text: string) => void
  onSaveAsNote?: (title: string, content: string) => void
}

export function MessageBubble({
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
                  {message.groundingStatus === "NO_SOURCES" && <FileTextIcon className="h-3 w-3" />}
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
          <MarkdownRenderer content={message.content} />

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
          {/* Save as Note button would go here if onSaveAsNote provided */}
          {(hasCitations || message.sources?.length) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-secondary"
              onClick={onToggleSources}
              title="Show sources"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        
        {/* Sources Panel */}
        {showSources && (
          <div className="mt-2 ml-4 mr-2 space-y-2 border-l-2 border-primary/20 pl-3 animate-in">
            {/* Sources would be rendered here if passed as prop */}
          </div>
        )}
      </div>
    </div>
  )
}