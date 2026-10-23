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
<<<<<<< HEAD
import { Plus, MessageSquare, Bot, Search, Settings, Loader2, AlertCircle } from "lucide-react"
=======
import { Plus, MessageSquare, Bot, Sparkles, Search, Settings } from "lucide-react"
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Conversation {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
<<<<<<< HEAD
  _count?: { messages: number }
=======
  _count: { messages: number }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
}

export default function AssistantPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("chat")
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null)
  const [newConversationTitle, setNewConversationTitle] = React.useState("")
<<<<<<< HEAD
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
=======

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations")
      if (!res.ok) throw new Error("Failed to fetch")
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      return res.json()
    },
  })

<<<<<<< HEAD
  const conversations: Conversation[] = Array.isArray(conversationsData)
    ? conversationsData
    : conversationsData?.conversations || []

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", "assistant"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
    enabled: activeTab === "documents",
  })

=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
<<<<<<< HEAD
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
=======
      if (!res.ok) throw new Error("Failed to create")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
      setNewConversationTitle("")
    },
    onError: () => toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" }),
  })

  const handleNewConversation = () => {
    if (newConversationTitle.trim()) {
      createConversation.mutate(newConversationTitle.trim())
    }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-80 flex flex-col border-r bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Conversations</h2>
<<<<<<< HEAD
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreatingNew((prev) => !prev)}
            aria-label="New conversation"
          >
=======
          <Button variant="ghost" size="icon" onClick={() => setNewConversationTitle("")}>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            <Plus className="h-4 w-4" />
          </Button>
        </div>

<<<<<<< HEAD
        {isCreatingNew && (
          <div className="p-4 border-b space-y-2">
            <Input
              placeholder="New conversation title..."
              value={newConversationTitle}
              onChange={(e) => setNewConversationTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewConversation()}
              autoFocus
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
=======
        {newConversationTitle === "" && !isLoading && (
          <div className="p-4 border-b">
            <Input
              placeholder="New conversation title..."
              value={newConversationTitle}
              onChange={e => setNewConversationTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNewConversation()}
              autoFocus
            />
            <Button className="w-full mt-2" onClick={handleNewConversation} disabled={!newConversationTitle.trim()}>
              Create
            </Button>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
<<<<<<< HEAD
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
                <Button
                  key={conv.id}
                  variant={selectedConversation === conv.id ? "default" : "ghost"}
                  className="w-full justify-start text-left gap-2"
                  onClick={() => setSelectedConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{conv.title || "New Conversation"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv._count?.messages ?? 0} messages · {formatRelativeTime(conv.updatedAt)}
                    </p>
                  </div>
                </Button>
              ))}

            {!isLoading && !isError && conversations.length === 0 && (
=======
            {conversations?.map((conv: Conversation) => (
              <Button
                key={conv.id}
                variant={selectedConversation === conv.id ? "default" : "ghost"}
                className="w-full justify-start text-left gap-2"
                onClick={() => setSelectedConversation(conv.id)}
              >
                <MessageSquare className="h-4 w-4" />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium truncate">{conv.title || "New Conversation"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv._count.messages} messages · {formatRelativeTime(conv.updatedAt)}
                  </p>
                </div>
              </Button>
            ))}
            {(!conversations || conversations.length === 0) && !isLoading && (
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
              <p className="text-center text-sm text-muted-foreground py-4">
                No conversations yet. Create one to start chatting.
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
<<<<<<< HEAD
          <Button
            variant="outline"
            className="w-full"
            disabled={createConversation.isPending}
            onClick={() => createConversation.mutate("New Conversation")}
          >
=======
          <Button variant="outline" className="w-full" onClick={() => setNewConversationTitle("New Conversation")}>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="border-b">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Document Search
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col">
            {selectedConversation ? (
<<<<<<< HEAD
              <RAGChat
                conversationId={selectedConversation}
                onConversationCreated={(id) => setSelectedConversation(id)}
              />
=======
              <RAGChat />
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <Card className="max-w-md w-full">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">Welcome to ALEX</h3>
                      <p className="mt-2 text-muted-foreground">
                        Select a conversation from the sidebar or create a new one to start chatting with your AI assistant.
                      </p>
<<<<<<< HEAD
                      <Button
                        className="mt-6"
                        disabled={createConversation.isPending}
                        onClick={() => createConversation.mutate("New Conversation")}
                      >
=======
                      <Button className="mt-6" onClick={() => setNewConversationTitle("New Conversation")}>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
                        <Plus className="mr-2 h-4 w-4" />
                        New Conversation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="flex-1">
<<<<<<< HEAD
            <DocumentList
              documents={documentsData?.documents || []}
              isLoading={docsLoading}
              showUpload={false}
            />
=======
            <DocumentList documents={[]} showUpload={false} />
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          </TabsContent>

          <TabsContent value="settings" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>AI Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">AI Provider Configuration</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure your API keys in the Settings page to enable AI features.
                  </p>
                  <Button asChild>
<<<<<<< HEAD
                    <a href="/dashboard/ai-settings">Go to AI Settings</a>
=======
                    <a href="/dashboard/settings?tab=ai">Go to AI Settings</a>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-4">RAG Settings</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="default-limit">Default Result Limit</Label>
                      <Input id="default-limit" type="number" defaultValue="10" className="w-32 mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="similarity-threshold">Similarity Threshold</Label>
<<<<<<< HEAD
                      <Input
                        id="similarity-threshold"
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        defaultValue="0.7"
                        className="w-32 mt-1"
                      />
=======
                      <Input id="similarity-threshold" type="number" step="0.1" min="0" max="1" defaultValue="0.7" className="w-32 mt-1" />
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}