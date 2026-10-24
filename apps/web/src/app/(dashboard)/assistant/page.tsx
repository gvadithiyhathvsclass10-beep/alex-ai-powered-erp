"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RAGChat } from "@/components/rag/rag-chat"
import { DocumentList } from "@/components/documents/document-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, MessageSquare, Bot, Search, Settings, Loader2, AlertCircle, ChevronRight, ChevronLeft, Sparkles, Brain, Zap, FileText, Upload, ExternalLink, Wifi, WifiOff, CheckCircle2, History } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Conversation {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
  model?: string
  provider?: string
}

interface AIProvider {
  id: string
  name: string
  model: string
  isActive: boolean
  isDefault: boolean
}

export default function AssistantPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("chat")
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null)
  const [newConversationTitle, setNewConversationTitle] = React.useState("")
  const [isCreatingNew, setIsCreatingNew] = React.useState(false)

  const {
    data: conversationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to fetch conversations")
      }
      return res.json()
    },
  })

  const conversations: Conversation[] = Array.isArray(conversationsData)
    ? conversationsData
    : conversationsData?.conversations || []

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: async () => {
      const res = await fetch("/api/ai/credentials")
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
  })

  const providers: AIProvider[] = Array.isArray(providersData) ? providersData : providersData?.credentials || []

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", "assistant"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
    enabled: activeTab === "documents",
  })

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to create conversation")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      const created = data?.conversation || data
      if (created?.id) {
        setSelectedConversation(created.id)
      }
      setNewConversationTitle("")
      setIsCreatingNew(false)
      toast({ title: "Conversation created" })
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create conversation",
        variant: "destructive",
      }),
  })

  const handleNewConversation = () => {
    const title = newConversationTitle.trim() || "New Conversation"
    createConversation.mutate(title)
  }

  const activeProvider = providers.find(p => p.isDefault) || providers[0]

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4 sm:px-6 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">AI Assistant</h1>
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
            RAG Enabled
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Provider Selector */}
          <div className="hidden sm:flex items-center gap-2">
            <Label htmlFor="provider-select" className="text-xs text-muted-foreground">Model</Label>
            <Select value={activeProvider?.id || ""} onValueChange={() => {}}>
              <SelectTrigger id="provider-select" className="w-[200px] h-9 input-futuristic">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.model}</span>
                      {p.isDefault && (
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </SelectItem>
                ))}
                {providers.length === 0 && (
                  <SelectItem value="" disabled>
                    No providers configured
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border/50">
            <div className={cn(
              "flex h-2 w-2 rounded-full",
              activeProvider?.isActive ? "bg-neon-green" : "bg-muted-foreground"
            )} />
            <span className="text-xs font-medium text-muted-foreground">
              {activeProvider?.isActive ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="border-b border-border/50 bg-background/50">
            <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Bot className="h-4 w-4" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Search className="h-4 w-4" />
              Document Search
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
            {selectedConversation ? (
              <div className="flex-1 flex flex-col">
                <RAGChat
                  conversationId={selectedConversation}
                  onConversationCreated={(id) => setSelectedConversation(id)}
                />
              </div>
            ) : (
              <WelcomeScreen
                onNewConversation={() => createConversation.mutate("New Conversation")}
                isCreating={createConversation.isPending}
                providers={providers}
              />
            )}
          </TabsContent>

          <TabsContent value="documents" className="flex-1 overflow-auto p-4">
            <DocumentList
              documents={documentsData?.documents || []}
              isLoading={docsLoading}
              showUpload={false}
            />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto p-4">
            <Card className="h-full panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  AI Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 h-[calc(100%-80px)] overflow-auto">
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">AI Provider Configuration</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure your API keys in the Settings page to enable AI features.
                  </p>
                  <Button asChild variant="default" className="btn-primary-gradient" onClick={() => router.push("/dashboard/ai-settings")}>
                    <span>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Go to AI Settings
                    </span>
                  </Button>
                </div>
                <div className="border-t border-border/50 pt-4 space-y-4">
                  <h4 className="font-medium text-foreground">RAG Settings</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="default-limit">Default Result Limit</Label>
                      <Input id="default-limit" type="number" defaultValue="10" className="w-32 input-futuristic" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="similarity-threshold">Similarity Threshold</Label>
                      <Input
                        id="similarity-threshold"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        defaultValue="0.7"
                        className="w-32 input-futuristic"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-4 space-y-4">
                  <h4 className="font-medium text-foreground">Active Provider</h4>
                  {activeProvider ? (
                    <div className="panel-elevated p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{activeProvider.name}</p>
                          <p className="text-sm text-muted-foreground">{activeProvider.model}</p>
                        </div>
                        <span className="ml-auto px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          Active
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-elevated p-4 text-center text-muted-foreground">
                      No active provider configured
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function WelcomeScreen({ onNewConversation, isCreating, providers }: { onNewConversation: () => void; isCreating: boolean; providers?: Array<{ id: string; name: string; model: string; isActive: boolean; isDefault: boolean }> }) {
  const promptSuggestions = [
    "Summarize my latest uploaded documents",
    "Help me create a study plan for finals",
    "Explain the key concepts from my research papers",
    "Generate flashcards from my lecture notes",
    "What are my upcoming assignment deadlines?",
    "Analyze my attendance patterns",
  ]

  const activeProvider = providers?.find(p => p.isDefault) || providers?.[0]

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="chat-welcome-card w-full panel-hover animate-in">
        <CardContent className="pt-8 pb-6 px-6 sm:px-8">
          <div className="text-center">
            <div className="mx-auto mb-6 relative">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-primary mx-auto">
                <Bot className="h-10 w-10 text-primary-foreground" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-30 blur-xl animate-pulse" />
              </div>
              <div className="absolute inset-0 -inset-2 rounded-2xl border border-primary/20 animate-spin-slow" />
            </div>

            <h3 className="text-2xl font-bold text-foreground mb-2">Welcome to ALEX</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Your AI-powered academic assistant with document-grounded RAG, multi-provider support, and real-time citations.
            </p>

            <div className="flex items-center justify-center gap-4 mb-6 p-4 rounded-xl bg-secondary border border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex h-2 w-2 rounded-full bg-neon-green" />
                <span className="text-sm font-medium text-foreground">Ready</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span className="text-sm">RAG Active</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span className="text-sm">Multi-Provider</span>
              </div>
            </div>

            {activeProvider && (
              <div className="mb-6 p-4 rounded-xl bg-secondary border border-border/50 text-left">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">Active Provider</p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{activeProvider.name}</p>
                    <p className="text-xs text-muted-foreground">{activeProvider.model}</p>
                  </div>
                  <span className="ml-auto px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                    Connected
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">Try asking:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {promptSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => onNewConversation()}
                    className="p-3 rounded-lg bg-secondary border border-border/50 hover:border-primary/30 hover:bg-surface-hover transition-all duration-200 text-left group"
                  >
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{suggestion}</span>
                  </button>
                ))}
              </div>

              <Button
                onClick={onNewConversation}
                disabled={isCreating}
                className="w-full btn-primary-gradient"
              >
                <span className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  {isCreating ? "Starting..." : "Start New Conversation"}
                </span>
              </Button>
            </div>

            <div className="border-t border-border/50 pt-4 text-center">
              <p className="text-xs text-muted-foreground/60">
                Conversations are saved automatically. Your data stays private.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}