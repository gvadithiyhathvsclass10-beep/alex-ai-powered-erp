"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { RAGChat } from "@/components/rag/rag-chat"
import { Plus, FileText, Search, Brain, Sparkles, FlaskConical } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ResearchNotebook {
  id: string
  title: string
  description: string | null
  ownerId: string
  projectId: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  _count: { sources: number; notes: number }
}

interface ResearchSource {
  id: string
  notebookId: string
  documentId: string | null
  title: string
  authors: Record<string, unknown> | null
  publicationYear: number | null
  doi: string | null
  url: string | null
  createdAt: string
}

interface ResearchNote {
  id: string
  notebookId: string
  userId: string
  title: string
  content: string
  sourceIds: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export default function ResearchLabPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notebooks")
  const [selectedNotebook, setSelectedNotebook] = React.useState<string | null>(null)
  const [showCreateNotebook, setShowCreateNotebook] = React.useState(false)

  const { data: notebooks } = useQuery({
    queryKey: ['research-notebooks'],
    queryFn: async () => {
      const res = await fetch('/api/research/notebooks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: sources } = useQuery({
    queryKey: ['research-sources', selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { sources: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/sources`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedNotebook,
  })

  const { data: notes } = useQuery({
    queryKey: ['research-notes', selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { notes: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/notes`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedNotebook,
  })

  const createNotebook = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const res = await fetch('/api/research/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['research-notebooks'] })
      setSelectedNotebook(data.notebook.id)
      setShowCreateNotebook(false)
      toast({ title: "Notebook created" })
    },
    onError: () => toast({ title: "Error", description: "Failed to create notebook", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research Lab</h1>
          <p className="text-muted-foreground mt-1">Collaborative research workspace with AI assistance</p>
        </div>
        <Button onClick={() => setShowCreateNotebook(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Notebook
        </Button>
      </div>

      {showCreateNotebook && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create New Notebook</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createNotebook.mutate({ title: fd.get('title') as string, description: fd.get('description') as string }) }} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input name="title" placeholder="My Research Notebook" required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="What is this notebook about?" />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateNotebook(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="notebooks">Notebooks</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="notebooks" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notebooks?.notebooks?.map((notebook: ResearchNotebook) => (
              <Card key={notebook.id} onClick={() => setSelectedNotebook(notebook.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{notebook.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{notebook.description || 'No description'}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{notebook._count.sources} sources</span>
                    <span>•</span>
                    <span>{notebook._count.notes} notes</span>
                    <span>•</span>
                    <span>{formatRelativeTime(notebook.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card onClick={() => setShowCreateNotebook(true)} className="cursor-pointer hover:shadow-md transition-shadow border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Create new notebook</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          {selectedNotebook ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Sources</h2>
                <DocumentUpload notebookId={selectedNotebook} />
              </div>
              <DocumentList
                documents={sources?.sources?.map((s: ResearchSource) => ({
                  id: s.id,
                  title: s.title,
                  description: null,
                  fileName: s.title,
                  fileSize: "0",
                  mimeType: "application/pdf",
                  documentType: "PDF",
                  status: "READY" as any,
                  errorMessage: null,
                  pageCount: null,
                  subject: null,
                  project: null,
                  notebook: null,
                  chunksCount: 0,
                  createdAt: s.createdAt,
                  updatedAt: s.createdAt,
                  processedAt: null,
                })) || []}
                showUpload={false}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to manage its sources</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {selectedNotebook ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Notes</h2>
                <Button>New Note</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {notes?.notes?.map((note: ResearchNote) => (
                  <Card key={note.id}>
                    <CardHeader>
                      <CardTitle>{note.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose max-h-40 overflow-y-auto">{note.content}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to view its notes</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          {selectedNotebook ? (
            <RAGChat notebookId={selectedNotebook} />
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select a notebook to chat with its sources</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatRelativeTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}