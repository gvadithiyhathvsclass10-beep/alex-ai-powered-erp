"use client"

import * as React from "react"
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
import { Plus, MessageSquare, Bot, Search, Settings, Loader2, AlertCircle, ChevronRight, ChevronLeft, Sparkles, Brain, Zap, FileText, Upload, ExternalLink, Wifi, WifiOff, CheckCircle2, History, GraduationCap, LayoutDashboard, ClipboardCheck, Calendar, FlaskConical, FolderKanban, UserCheck, Book } from "lucide-react"
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
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("chat")
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null)
  const [newConversationTitle, setNewConversationTitle] = React.useState("")
  const [isCreatingNew, setIsCreatingNew] = React.useState(false)
  const [rightPanelOpen, setRightPanelOpen] = React.useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = React.useState(true)
  const [selectedProvider, setSelectedProvider] = React.useState<string>("")

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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* LEFT PANEL - Navigation & Conversation History */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar transition-all duration-300 ease-out flex flex-col",
          leftPanelOpen ? "w-80 lg:w-80" : "w-16 lg:w-16",
          "lg:translate-x-0"
        )}
        aria-label="Navigation & conversations"
      >
        <div className="flex h-full flex-col">
          {/* Brand Header */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            
            {!leftPanelOpen ? (
              <Link href="/dashboard" className="flex items-center justify-center relative z-10 group" title="ALEX Dashboard">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform duration-200">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
                </div>
              </Link>
            ) : (
              <Link href="/dashboard" className="flex items-center gap-3 font-bold text-lg relative z-10 group">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform duration-200">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
                </div>
                <span className="text-foreground">ALEX</span>
              </Link>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-secondary relative z-10"
              aria-label={leftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", leftPanelOpen ? "" : "rotate-180")} />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
            <NavSection title="AI Assistant" collapsed={!leftPanelOpen}>
              <NavLink
                href="/dashboard/assistant"
                icon={Bot}
                label="AI Chat"
                badge="NEW"
                isActive={pathname === "/dashboard/assistant"}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/documents"
                icon={FileText}
                label="Documents"
                isActive={pathname === "/dashboard/documents"}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/ai-settings"
                icon={Settings}
                label="AI Settings"
                isActive={pathname === "/dashboard/ai-settings"}
                collapsed={!leftPanelOpen}
              />
            </NavSection>

            <NavSection title="Academic" collapsed={!leftPanelOpen}>
              <NavLink
                href="/dashboard/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                isActive={pathname === "/dashboard" || pathname === "/dashboard/dashboard"}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/subjects"
                icon={Book}
                label="Subjects"
                isActive={pathname.startsWith("/dashboard/subjects")}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/assignments"
                icon={ClipboardCheck}
                label="Assignments"
                isActive={pathname.startsWith("/dashboard/assignments")}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/attendance"
                icon={UserCheck}
                label="Attendance"
                isActive={pathname.startsWith("/dashboard/attendance")}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/planner"
                icon={Calendar}
                label="Planner"
                isActive={pathname.startsWith("/dashboard/planner")}
                collapsed={!leftPanelOpen}
              />
            </NavSection>

            <NavSection title="Research & Study" collapsed={!leftPanelOpen}>
              <NavLink
                href="/dashboard/research"
                icon={FlaskConical}
                label="Research Lab"
                isActive={pathname.startsWith("/dashboard/research")}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/study-studio"
                icon={Brain}
                label="Study Studio"
                isActive={pathname.startsWith("/dashboard/study-studio")}
                collapsed={!leftPanelOpen}
              />
              <NavLink
                href="/dashboard/projects"
                icon={FolderKanban}
                label="Projects"
                isActive={pathname.startsWith("/dashboard/projects")}
                collapsed={!leftPanelOpen}
              />
            </NavSection>
          </nav>

          {/* Conversation History */}
          {!leftPanelOpen ? null : (
            <div className="border-t border-sidebar-border flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <h2 className="font-semibold text-foreground">Conversations</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCreatingNew((prev) => !prev)}
                  aria-label="New conversation"
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {isCreatingNew && (
                <div className="p-4 border-b border-sidebar-border space-y-2">
                  <Input
                    placeholder="New conversation title..."
                    value={newConversationTitle}
                    onChange={(e) => setNewConversationTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNewConversation()}
                    autoFocus
                    className="input-futuristic"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleNewConversation}
                      disabled={createConversation.isPending}
                    >
                      {createConversation.isPending ? "Creating..." : "Create"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreatingNew(false)
                        setNewConversationTitle("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {isLoading && (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading conversations...</span>
                    </div>
                  )}

                  {isError && (
                    <div className="p-4 text-center space-y-2">
                      <div className="flex items-center justify-center gap-1 text-destructive text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error instanceof Error ? error.message : "Failed to load"}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => refetch()}>
                        Retry
                      </Button>
                    </div>
                  )}

                  {!isLoading &&
                    !isError &&
                    conversations.map((conv: Conversation) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={selectedConversation === conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        onDelete={(e) => {
                          e.stopPropagation()
                          // Delete handler would go here
                        }}
                      />
                    ))}

                  {!isLoading && !isError && conversations.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No conversations yet. Create one to start chatting.
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-sidebar-border">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={createConversation.isPending}
                  onClick={() => createConversation.mutate("New Conversation")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Chat
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        leftPanelOpen ? "lg:pl-80" : "lg:pl-16"
      )}>
        {/* Top Bar with Provider Selector */}
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
              <Select value={selectedProvider || (activeProvider?.id || "")} onValueChange={setSelectedProvider}>
                <SelectTrigger id="provider-select" className="w-[200px] h-9 input-futuristic">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
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

            {/* Right Panel Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-9 w-9 rounded-lg hover:bg-secondary"
              aria-label={rightPanelOpen ? "Hide utility panel" : "Show utility panel"}
            >
              {rightPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
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
                    <Button asChild variant="default" className="btn-primary-gradient">
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
      </main>

      {/* RIGHT PANEL - Utility Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-30 h-screen border-l bg-sidebar transition-all duration-300 ease-out flex flex-col",
          rightPanelOpen ? "w-80 lg:w-80" : "w-0 lg:w-0",
          "lg:translate-x-0"
        )}
        aria-label="Utility panel"
      >
        <div className="flex h-full flex-col">
          {/* Panel Header */}
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-primary/5 pointer-events-none" />
            <h2 className="font-semibold text-foreground relative z-10">Quick Actions</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(false)}
              className="h-8 w-8 rounded-lg transition-all duration-200 hover:bg-secondary relative z-10"
              aria-label="Close utility panel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Actions</h3>
                <QuickActionButton
                  icon={Upload}
                  label="Upload Document"
                  description="Add files to your knowledge base"
                  onClick={() => setActiveTab("documents")}
                  primary
                />
                <QuickActionButton
                  icon={Settings}
                  label="AI Settings"
                  description="Configure providers & models"
                  onClick={() => window.location.href = "/dashboard/ai-settings"}
                />
                <QuickActionButton
                  icon={FileText}
                  label="Browse Documents"
                  description="View all uploaded documents"
                  onClick={() => window.location.href = "/dashboard/documents"}
                />
                <QuickActionButton
                  icon={Sparkles}
                  label="Solution Generator"
                  description="Generate structured solutions"
                  onClick={() => window.location.href = "/dashboard/solution-generator"}
                />
              </div>

              {/* Model Info */}
              <div className="space-y-3 border-t border-sidebar-border pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Model Info</h3>
                {activeProvider ? (
                  <div className="panel-elevated p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{activeProvider.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{activeProvider.model}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-secondary">
                        <p className="text-2xl font-bold text-primary">Chat</p>
                        <p className="text-xs text-muted-foreground">Primary</p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary">
                        <p className="text-2xl font-bold text-accent">RAG</p>
                        <p className="text-xs text-muted-foreground">Enabled</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="panel-elevated p-4 text-center text-muted-foreground">
                    No provider configured
                  </div>
                )}
              </div>

              {/* Recent Documents */}
              <div className="space-y-3 border-t border-sidebar-border pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Recent Documents</h3>
                {docsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : documentsData?.documents?.length > 0 ? (
                  <div className="space-y-2">
                    {documentsData.documents.slice(0, 5).map((doc: any) => (
                      <div key={doc.id} className="panel-elevated p-3 hover:border-primary/20 transition-all duration-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.documentType} • {formatRelativeTime(doc.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full text-sm" asChild>
                      <Link href="/dashboard/documents">View All Documents</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="panel-elevated p-4 text-center text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
                    <p className="text-sm">No documents yet</p>
                    <Button variant="outline" className="mt-2 w-full" asChild>
                      <Link href="/dashboard/documents">Upload First Document</Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Useful Links */}
              <div className="space-y-3 border-t border-sidebar-border pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Quick Links</h3>
                <div className="space-y-2">
                  <QuickLink icon={Brain} label="Study Studio" href="/dashboard/study-studio" />
                  <QuickLink icon={FlaskConical} label="Research Lab" href="/dashboard/research" />
                  <QuickLink icon={Calendar} label="Smart Planner" href="/dashboard/planner" />
                  <QuickLink icon={FolderKanban} label="Projects" href="/dashboard/projects" />
                  <QuickLink icon={Book} label="Subjects" href="/dashboard/subjects" />
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

import Link from "next/link"
import { usePathname } from "next/navigation"

const pathname = "/dashboard/assistant" // This will be overridden by the actual pathname in the component

function NavSection({ title, children, collapsed }: { title: string; children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1 mt-2">
        {title}
      </p>
      {children}
    </div>
  )
}

function NavLink({ href, icon: Icon, label, badge, isActive, collapsed }: { 
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: string
  isActive: boolean
  collapsed: boolean
}) {
  const baseClasses = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
  const activeClasses = "bg-primary/15 border-l-2 border-primary text-primary shadow-[inset_0_0_20px_-5px_rgba(0,212,255,0.15)]"
  const inactiveClasses = "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/10"

  return (
    <Link
      href={href}
      className={cn(baseClasses, isActive ? activeClasses : inactiveClasses)}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0">
        <Icon className={cn("h-5 w-5", isActive && "text-primary")} aria-hidden="true" />
      </span>
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge && (
            <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function ConversationItem({ conversation, isActive, onClick, onDelete }: { 
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-2",
        isActive
          ? "bg-primary/15 border border-primary/30 text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-border"
      )}
    >
      <MessageSquare className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
      <div className="flex-1 text-left min-w-0">
        <p className="font-medium truncate">{conversation.title || "New Conversation"}</p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {conversation._count?.messages ?? 0} messages
          <span>·</span>
          {formatRelativeTime(conversation.updatedAt)}
          {conversation.provider && (
            <>
              <span>·</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary">{conversation.provider}</span>
            </>
          )}
        </p>
      </div>
      {!isActive && (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onDelete}>
          <History className="h-3 w-3" />
        </Button>
      )}
    </button>
  )
}

function QuickActionButton({ icon: Icon, label, description, onClick, primary }: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-lg transition-all duration-200 flex items-center gap-3 text-left",
        primary
          ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-[0_0_20px_-5px_rgba(0,212,255,0.4)]"
          : "bg-secondary hover:bg-surface-hover border border-border/50 hover:border-primary/20"
      )}
    >
      <div className={cn("p-2 rounded-lg flex-shrink-0", primary ? "bg-primary-foreground/20" : "bg-primary/10")}>
        <Icon className={cn("h-5 w-5", primary ? "text-primary-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{label}</p>
        <p className="text-xs truncate">{primary ? description : <span className="text-muted-foreground">{description}</span>}</p>
      </div>
    </button>
  )
}

function QuickLink({ icon: Icon, label, href }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200">
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function WelcomeScreen({ onNewConversation, isCreating }: { onNewConversation: () => void; isCreating: boolean }) {
  const promptSuggestions = [
    "Summarize my latest uploaded documents",
    "Help me create a study plan for finals",
    "Explain the key concepts from my research papers",
    "Generate flashcards from my lecture notes",
    "What are my upcoming assignment deadlines?",
    "Analyze my attendance patterns",
  ]

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full panel-hover animate-in">
        <CardContent className="pt-8 pb-6 px-6 sm:px-8">
          <div className="text-center">
            {/* Animated AI Avatar */}
            <div className="mx-auto mb-6 relative">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-primary mx-auto">
                <Bot className="h-10 w-10 text-primary-foreground" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-30 blur-xl animate-pulse" />
              </div>
              {/* Orbiting dots */}
              <div className="absolute inset-0 -inset-2 rounded-2xl border border-primary/20 animate-spin-slow" />
            </div>

            <h3 className="text-2xl font-bold text-foreground mb-2">Welcome to ALEX</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your AI-powered academic assistant with document-grounded RAG, multi-provider support, and real-time citations.
            </p>

            {/* Provider Status */}
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

            {/* Prompt Suggestions */}
            <div className="space-y-3 mb-6">
              <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">Try asking:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {promptSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      // This would ideally set the input in RAGChat
                      onNewConversation()
                    }}
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

            {/* Footer info */}
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