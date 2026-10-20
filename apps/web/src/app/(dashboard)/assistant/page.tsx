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
import { Plus, MessageSquare, Bot, Sparkles, Search, Settings } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Conversation {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  _count: { messages: number }
}

export default function AssistantPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("chat")
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null)
  const [newConversationTitle, setNewConversationTitle] = React.useState("")

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations")
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
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
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-80 flex flex-col border-r bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Conversations</h2>
          <Button variant="ghost" size="icon" onClick={() => setNewConversationTitle("")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

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
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
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
              <p className="text-center text-sm text-muted-foreground py-4">
                No conversations yet. Create one to start chatting.
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={() => setNewConversationTitle("New Conversation")}>
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
              <RAGChat />
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
                      <Button className="mt-6" onClick={() => setNewConversationTitle("New Conversation")}>
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
            <DocumentList documents={[]} showUpload={false} />
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
                    <a href="/dashboard/settings?tab=ai">Go to AI Settings</a>
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
                      <Input id="similarity-threshold" type="number" step="0.1" min="0" max="1" defaultValue="0.7" className="w-32 mt-1" />
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