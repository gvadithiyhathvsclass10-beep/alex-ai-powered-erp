"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DocumentList } from "@/components/documents/document-list"
import { DocumentUpload } from "@/components/documents/document-upload"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentStatus } from "@prisma/client"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface DocumentListItem {
  id: string
  title: string
  description: string | null
  fileName: string
  fileSize: string
  mimeType: string
  documentType: string
  status: DocumentStatus
  errorMessage: string | null
  pageCount: number | null
  subject: { id: string; name: string; code: string } | null
  project: { id: string; title: string } | null
  notebook: { id: string; title: string } | null
  chunksCount: number
  createdAt: string
  updatedAt: string
  processedAt: string | null
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("personal")

  const { data: personalDocs, isLoading: personalLoading } = useQuery({
    queryKey: ['documents', 'personal'],
    queryFn: async () => {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: subjectDocs, isLoading: subjectLoading } = useQuery({
    queryKey: ['documents', 'subject'],
    queryFn: async () => {
      const res = await fetch('/api/documents?subjectId=current')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: false,
  })

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/retry`, { method: 'POST' })
      if (!res.ok) throw new Error('Retry failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast({ title: "Processing restarted" })
    },
    onError: () => toast({ title: "Error", description: "Failed to retry", variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast({ title: "Document deleted" })
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  })

  const handleRetry = (id: string) => retryMutation.mutate(id)
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-1">Manage your documents and knowledge base</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="personal">Personal Documents</TabsTrigger>
          <TabsTrigger value="subjects">Subject Resources</TabsTrigger>
          <TabsTrigger value="projects">Project Documents</TabsTrigger>
          <TabsTrigger value="research">Research Notebooks</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <DocumentList
            documents={personalDocs?.documents || []}
            isLoading={personalLoading}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onView={(id) => window.location.href = `/dashboard/documents/${id}`}
            onEdit={(id) => console.log('edit', id)}
            showUpload={true}
          />
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Select a subject from the Subjects page to view its resources.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Select a project from the Projects page to view its documents.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Notebook Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Select a notebook from the Research Lab to view its documents.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}