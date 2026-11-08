"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, Loader2, ChevronRight, ChevronLeft, Settings, Search } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { MindMapViewer } from "@/components/study-studio/MindMapViewer"
import { DiagramViewer } from "@/components/study-studio/DiagramViewer"
import { QuizViewer } from "@/components/study-studio/QuizViewer"
import { MarkdownRenderer } from "@/components/ui/markdown"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface StudyMaterial {
  id: string
  title: string
  content: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  topic: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface FlashcardDeck {
  id: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  algorithm: string
  _count: { cards: number }
  createdAt: string
  updatedAt: string
}

interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  difficulty: number
  interval: number
  repetitions: number
  easeFactor: number
  nextReview: string
  lastReviewed: string | null
}

interface MindMapData {
  id: string
  title: string
  sourceDocId: string
  nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
  createdAt: string
}

interface DiagramData {
  id: string
  title: string
  type: 'mermaid' | 'graphviz' | 'plantuml'
  definition: { type: 'mermaid' | 'graphviz' | 'plantuml'; code: string; title?: string }
  createdAt: string
}

interface QuizData {
  id: string
  title: string
  difficulty: string
  questions: Array<{
    id: string
    prompt: string
    options: string[]
    answer: number
    explanation?: string
  }>
  createdAt: string
}

interface Document {
  id: string
  title: string
  fileName: string
  status: string
  subjectId?: string | null
}

interface StudyJob {
  id: string
  type: string
  status: string
  sourceDocId: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  result: any
  errorMessage: string | null
}

// Shared Document Selector Component
function DocumentSelector({ 
  value, 
  onChange, 
  documents,
  placeholder = "Select a processed document",
  className,
  disabled
}: {
  value: string
  onChange: (value: string) => void
  documents: Document[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const filteredDocs = documents.filter(d => d.status === "READY")
  
  return (
    <div className={cn("w-full", className)}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredDocs.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No processed documents available. Upload a document first.
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title} {doc.subjectId && `(${doc.subjectId})`}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

// Loading State Component
function LoadingState({ message = "Processing...", subtitle }: { message?: string; subtitle?: string }) {
  return (
    <Card className="animate-in slide-in-from-bottom-2">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">{message}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// Empty State Component
function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}: { 
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("text-center py-12", className)}>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-muted">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

// Generation Card Component
function GenerationCard({ 
  icon: Icon, 
  title, 
  description, 
  onClick, 
  disabled = false,
  loading = false,
  children
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card onClick={onClick} className={cn("hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col", disabled && "opacity-50 cursor-not-allowed")}>
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-auto pt-4 border-t">
          {children || (
            <Button className="w-full justify-between" variant="outline" size="sm" disabled={disabled || loading}>
              <span>{loading ? "Generating..." : "Generate"}</span>
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudyStudioPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notes")
  const [selectedDeck, setSelectedDeck] = React.useState<string | null>(null)
  const [reviewMode, setReviewMode] = React.useState(false)
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [selectedSourceDoc, setSelectedSourceDoc] = React.useState("")
  
  // States for generated content viewers
  const [generatedMindMap, setGeneratedMindMap] = React.useState<MindMapData | null>(null)
  const [generatedDiagram, setGeneratedDiagram] = React.useState<DiagramData | null>(null)
  const [generatedQuiz, setGeneratedQuiz] = React.useState<QuizData | null>(null)
  
  // Loading states for generation
  const [generatingMindMap, setGeneratingMindMap] = React.useState(false)
  const [generatingDiagram, setGeneratingDiagram] = React.useState(false)
  const [generatingQuiz, setGeneratingQuiz] = React.useState(false)
  
  // Generation type for notes
  const [selectedNoteType, setSelectedNoteType] = React.useState<string | null>(null)

  // Fetch user documents
  const { data: documents, isError: documentsError, isLoading: documentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
    retry: 1,
  })

  // Fetch existing mind maps
  const { data: mindMapsData, isError: mindMapsError } = useQuery({
    queryKey: ['mindmaps'],
    queryFn: async () => {
      const res = await fetch('/api/mindmaps/generate')
      if (!res.ok) throw new Error('Failed to fetch mind maps')
      const data = await res.json()
      return data.mindMaps || []
    },
    retry: 1,
  })

  // Fetch existing diagrams
  const { data: diagrams, isError: diagramsError } = useQuery({
    queryKey: ['diagrams'],
    queryFn: async () => {
      const res = await fetch('/api/diagrams/generate')
      if (!res.ok) throw new Error('Failed to fetch diagrams')
      return res.json()
    },
    retry: 1,
  })

  // Fetch existing quizzes
  const { data: quizzesData, isError: quizzesError } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const res = await fetch('/api/quizzes/generate')
      if (!res.ok) throw new Error('Failed to fetch quizzes')
      const data = await res.json()
      return data.quizzes || []
    },
    retry: 1,
  })

  // Fetch study notes
  const { data: notes, isError: notesError, isLoading: notesLoading } = useQuery({
    queryKey: ['study-materials'],
    queryFn: async () => {
      const res = await fetch('/api/study-materials')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    retry: 1,
  })

  // Fetch flashcard decks
  const { data: decks, isError: decksError, isLoading: decksLoading } = useQuery({
    queryKey: ['flashcard-decks'],
    queryFn: async () => {
      const res = await fetch('/api/flashcards/decks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    retry: 1,
  })

  // Fetch deck cards
  const { data: deckCards, isError: deckCardsError } = useQuery({
    queryKey: ['flashcards', selectedDeck],
    queryFn: async () => {
      if (!selectedDeck) return { cards: [] }
      const res = await fetch(`/api/flashcards/decks/${selectedDeck}/cards`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedDeck,
    retry: 1,
  })

  // Fetch study jobs for polling
  const { data: studyJobs } = useQuery({
    queryKey: ['study-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/study-jobs')
      if (!res.ok) throw new Error('Failed to fetch jobs')
      return res.json()
    },
    refetchInterval: 3000,
    retry: 1,
  })

  // Check if any critical queries failed
  const hasCriticalError = documentsError || notesError || decksError || mindMapsError || quizzesError

  const documentsList = Array.isArray(documents) ? documents : (documents?.documents || [])
  const filteredDocuments = documentsList.filter((d: any) => d.status === "READY")

  // Create study job and poll for completion
  const createStudyJob = async (type: string, sourceDocId: string, input: Record<string, any> = {}) => {
    const res = await fetch('/api/study-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sourceDocId, input }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create job')
    return data.job
  }

  // Poll for job completion
  const waitForJob = async (jobId: string, onProgress?: (progress: number) => void): Promise<any> => {
    const maxAttempts = 600 // 30 minutes at 3s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`/api/study-jobs?id=${jobId}`)
      if (!res.ok) throw new Error('Failed to check job status')
      const job = await res.json()
      
      if (job.status === 'completed') {
        return job.result
      }
      if (job.status === 'failed') {
        throw new Error(job.errorMessage || 'Job failed')
      }
      
      if (onProgress) {
        onProgress(job.status === 'processing' ? 50 : 10)
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    throw new Error('Job timed out')
  }

  // Generate study notes
  const generateNotes = useMutation({
    mutationFn: async ({ sourceDocId, type }: { sourceDocId: string; type: string }) => {
      const job = await createStudyJob('notes', sourceDocId, { type })
      return waitForJob(job.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-materials'] })
      toast({ title: "Notes generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate notes", variant: "destructive" }),
  })

  // Generate flashcards
  const generateFlashcards = useMutation({
    mutationFn: async ({ sourceDocId, count }: { sourceDocId: string; count: number }) => {
      const job = await createStudyJob('flashcards', sourceDocId, { count })
      return waitForJob(job.id)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] })
      setSelectedDeck(data.deckId || data.deck?.id)
      setActiveTab("flashcards")
      toast({ title: "Flashcards generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate flashcards", variant: "destructive" }),
  })

  // Review flashcard
  const reviewCard = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
      const res = await fetch(`/api/flashcards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      if (!res.ok) throw new Error('Review failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedDeck] })
      if (currentCardIndex < (deckCards?.cards?.length || 0) - 1) {
        setCurrentCardIndex(prev => prev + 1)
      } else {
        setReviewMode(false)
        toast({ title: "Review complete!" })
      }
      setShowAnswer(false)
    },
    onError: () => toast({ title: "Error", description: "Failed to submit review", variant: "destructive" }),
  })

  // Generate mind map
  const generateMindMap = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    setGeneratingMindMap(true)
    try {
      const job = await createStudyJob('mindmaps', selectedSourceDoc)
      const result = await waitForJob(job.id)
      setGeneratedMindMap(result.mindMap || result)
      toast({ title: 'Mind map generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate mind map', variant: 'destructive' })
    } finally {
      setGeneratingMindMap(false)
    }
  }, [selectedSourceDoc])

  // Generate diagram
  const generateDiagram = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    setGeneratingDiagram(true)
    try {
      const job = await createStudyJob('diagrams', selectedSourceDoc)
      const result = await waitForJob(job.id)
      setGeneratedDiagram(result)
      toast({ title: 'Diagram generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate diagram', variant: 'destructive' })
    } finally {
      setGeneratingDiagram(false)
    }
  }, [selectedSourceDoc])

  // Generate quiz
  const generateQuiz = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    setGeneratingQuiz(true)
    try {
      const job = await createStudyJob('quizzes', selectedSourceDoc)
      const result = await waitForJob(job.id)
      setGeneratedQuiz(result.quiz || result)
      toast({ title: 'Quiz generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate quiz', variant: 'destructive' })
    } finally {
      setGeneratingQuiz(false)
    }
  }, [selectedSourceDoc])

  // Close generated content
  const closeGenerated = React.useCallback((type: 'mindmap' | 'diagram' | 'quiz') => {
    if (type === 'mindmap') setGeneratedMindMap(null)
    else if (type === 'diagram') setGeneratedDiagram(null)
    else if (type === 'quiz') setGeneratedQuiz(null)
  }, [])

  // Note type options
  const noteTypes = [
    { type: "concise", title: "Concise Notes", icon: FileText, desc: "Key points only" },
    { type: "detailed", title: "Detailed Notes", icon: BookOpen, desc: "Comprehensive coverage" },
    { type: "exam", title: "Exam Notes", icon: Target, desc: "High-yield for tests" },
    { type: "formulas", title: "Formula Sheet", icon: Zap, desc: "Equations & constants" },
    { type: "definitions", title: "Definitions", icon: Sparkles, desc: "Key terms explained" },
    { type: "comparison", title: "Comparison Table", icon: Brain, desc: "Side-by-side analysis" },
  ]

  // Show error state if critical queries failed
  if (hasCriticalError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Studio</h1>
          <p className="text-muted-foreground mt-1">Generate and manage your study materials</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 p-4">
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Failed to load Study Studio data</h3>
                <p className="text-muted-foreground mt-1">
                  Could not fetch documents or study materials. This may be due to a temporary server issue.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study Studio</h1>
        <p className="text-muted-foreground mt-1">Generate and manage your study materials</p>
      </div>

      {/* Document Selector - Shared across all tabs */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="pt-4 pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 w-full sm:w-80">
              <DocumentSelector 
                value={selectedSourceDoc} 
                onChange={setSelectedSourceDoc} 
                documents={documentsList}
                disabled={documentsLoading}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedSourceDoc("")}
                disabled={!selectedSourceDoc}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <DocumentUpload
                onSuccess={(doc) => {
                  setSelectedSourceDoc(doc.id)
                }}
              />
            </div>
          </div>
          {filteredDocuments.length > 0 && (
            <div className="mt-4">
              <DocumentList documents={documentsList} showUpload={false} />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notes">Smart Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="mindmaps">Mind Maps</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
        </TabsList>

        {/* SMART NOTES TAB */}
        <TabsContent value="notes" className="mt-4 space-y-6">
          <div className="space-y-6">
            {/* Generation Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Study Notes
                </CardTitle>
                <CardDescription>
                  Select a document above and choose a note type to generate AI-powered study content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSourceDoc ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {noteTypes.map(item => (
                      <GenerationCard
                        key={item.type}
                        icon={item.icon}
                        title={item.title}
                        description={item.desc}
                        onClick={() => generateNotes.mutate({ sourceDocId: selectedSourceDoc, type: item.type })}
                        disabled={generateNotes.isPending}
                        loading={generateNotes.isPending}
                      >
                        <Button className="w-full justify-between" variant="outline" size="sm" disabled={generateNotes.isPending} onClick={(e) => { e.stopPropagation(); generateNotes.mutate({ sourceDocId: selectedSourceDoc, type: item.type }) }}>
                          <span>{generateNotes.isPending ? "Generating..." : "Generate"}</span>
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </GenerationCard>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="Select a document to begin"
                    description="Choose a processed document from the selector above to generate study notes."
                  />
                )}
              </CardContent>
            </Card>

            {/* Generated Study Materials */}
            {notes?.materials?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Generated Study Materials
                  </CardTitle>
                  <CardDescription>{notes.materials.length} materials generated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {notes.materials.map((material: StudyMaterial) => (
                      <Card key={material.id} className="overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="truncate">{material.title}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{material.type}</Badge>
                              {material.topic && <Badge variant="secondary" className="text-xs">{material.topic}</Badge>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none max-h-[600px] overflow-y-auto">
                            <MarkdownRenderer content={material.content} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {(!notes?.materials?.length || notes.materials.length === 0) && selectedSourceDoc && !generateNotes.isPending && (
              <EmptyState
                icon={FileText}
                title="No notes generated yet"
                description="Select a note type above to generate your first study material."
              />
            )}
          </div>
        </TabsContent>

        {/* FLASHCARDS TAB */}
        <TabsContent value="flashcards" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Flashcard Decks</h2>
            {selectedSourceDoc && (
              <Button onClick={() => setSelectedDeck("new")} disabled={generateFlashcards.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Generate Flashcards
              </Button>
            )}
          </div>

          {selectedDeck === "new" ? (
            <Card>
              <CardHeader>
                <CardTitle>Create New Deck</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4 max-w-md">
                  <div>
                    <Label>Deck Title</Label>
                    <Input placeholder="e.g., Biology Chapter 1" defaultValue={selectedSourceDoc ? undefined : ""} />
                  </div>
                  {selectedSourceDoc && (
                    <>
                      <input type="hidden" name="sourceDocId" value={selectedSourceDoc} />
                      <div>
                        <Label>Number of Cards</Label>
                        <Input type="number" defaultValue="20" min="5" max="100" name="count" />
                      </div>
                      <Button type="submit" disabled={generateFlashcards.isPending} onClick={(e) => { e.preventDefault(); generateFlashcards.mutate({ sourceDocId: selectedSourceDoc, count: 20 }) }}>
                        {generateFlashcards.isPending ? "Generating..." : "Generate Flashcards"}
                      </Button>
                    </>
                  )}
                  {!selectedSourceDoc && (
                    <p className="text-sm text-muted-foreground">Select a document above to enable flashcard generation.</p>
                  )}
                </form>
              </CardContent>
            </Card>
          ) : selectedDeck ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Review Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {deckCards?.cards?.length || 0} cards · Card {currentCardIndex + 1} of {deckCards?.cards?.length || 0}
                  </p>
                </div>
                <Button onClick={() => setReviewMode(true)} disabled={reviewMode}>
                  {reviewMode ? "Reviewing..." : "Start Review"}
                </Button>
              </div>

              {reviewMode && deckCards?.cards?.[currentCardIndex] ? (
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="pt-6 pb-8">
                    <div className="text-center">
                      <div className="mb-4 text-sm text-muted-foreground">
                        Card {currentCardIndex + 1} of {deckCards.cards.length}
                      </div>
                      <div
                        className="h-64 border rounded-lg p-8 flex items-center justify-center cursor-pointer bg-card"
                        onClick={() => setShowAnswer(true)}
                      >
                        {showAnswer ? (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Answer</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].back}</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Question</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].front}</p>
                            <p className="mt-4 text-sm text-muted-foreground">Click to reveal answer</p>
                          </div>
                        )}
                      </div>
                      {showAnswer && (
                        <div className="mt-6 flex justify-center gap-2">
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 1 })}>Again</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 2 })}>Hard</Button>
                          <Button variant="default" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 3 })}>Good</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 4 })}>Easy</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {decks?.decks?.map((deck: FlashcardDeck) => (
                    <Card key={deck.id} onClick={() => setSelectedDeck(deck.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle>{deck.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{deck._count.cards} cards · {deck.algorithm}</p>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedDeck(deck.id) }}>
                          Review
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks?.decks?.map((deck: FlashcardDeck) => (
                <Card key={deck.id} onClick={() => setSelectedDeck(deck.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{deck.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{deck._count.cards} cards · {deck.algorithm}</p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedDeck(deck.id) }}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {(!decks?.decks?.length || decks.decks.length === 0) && !selectedDeck && !selectedSourceDoc && (
            <EmptyState
              icon={Brain}
              title="No flashcard decks yet"
              description="Select a document and click 'Generate Flashcards' to create your first deck."
            />
          )}
        </TabsContent>

        {/* MIND MAPS TAB */}
        <TabsContent value="mindmaps" className="mt-4 space-y-6">
          {/* Generated mind map viewer */}
          {generatedMindMap && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedMindMap.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('mindmap')} aria-label="Close mind map">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <MindMapViewer 
                  data={{ 
                    nodes: generatedMindMap.nodes, 
                    edges: generatedMindMap.edges 
                  }} 
                  title={generatedMindMap.title}
                  onDownloadPdf={() => window.print()}
                  className="h-[600px] w-full"
                />
              </CardContent>
            </Card>
          )}

          {generatingMindMap && (
            <LoadingState message="Generating mind map..." subtitle="This may take a moment" />
          )}

          {/* Generate new mind map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generate Mind Map
              </CardTitle>
              <CardDescription>
                Create a structured concept mind map from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <DocumentSelector 
                  value={selectedSourceDoc} 
                  onChange={setSelectedSourceDoc} 
                  documents={documentsList}
                  className="w-full sm:w-80"
                />
                <Button onClick={generateMindMap} disabled={!selectedSourceDoc || generatingMindMap}>
                  {generatingMindMap ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Mind Map
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing mind maps list */}
          {(mindMapsData?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Mind Maps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {mindMapsData.map((mindMap: MindMapData) => (
                    <Card key={mindMap.id} className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                      <CardHeader>
                        <CardTitle className="truncate">{mindMap.title}</CardTitle>
                        <CardDescription>{mindMap.nodes.length} nodes · {mindMap.edges.length} connections</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <MindMapViewer 
                          data={{ 
                            nodes: mindMap.nodes, 
                            edges: mindMap.edges 
                          }} 
                          title={mindMap.title}
                          className="h-[350px] w-full"
                        />
                      </CardContent>
                    </Card>
                  )) || []}
                </div>
              </CardContent>
            </Card>
          )}

          {(!mindMapsData?.length && !generatingMindMap && !generatedMindMap) && (
            <EmptyState
              icon={Brain}
              title="No mind maps yet"
              description="Select a document and click 'Generate Mind Map' to create your first concept map."
            />
          )}
        </TabsContent>

        {/* DIAGRAMS TAB */}
        <TabsContent value="diagrams" className="mt-4 space-y-6">
          {/* Generated diagram viewer */}
          {generatedDiagram && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedDiagram.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('diagram')} aria-label="Close diagram">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <DiagramViewer 
                  definition={generatedDiagram.definition}
                  title={generatedDiagram.title}
                  onDownloadPdf={() => window.print()}
                  height={600}
                />
              </CardContent>
            </Card>
          )}

          {generatingDiagram && (
            <LoadingState message="Generating diagram..." subtitle="This may take a moment" />
          )}

          {/* Generate new diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Generate Diagram
              </CardTitle>
              <CardDescription>
                Create Mermaid, Graphviz, or PlantUML diagrams from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <DocumentSelector 
                  value={selectedSourceDoc} 
                  onChange={setSelectedSourceDoc} 
                  documents={documentsList}
                  className="w-full sm:w-80"
                />
                <Button onClick={generateDiagram} disabled={!selectedSourceDoc || generatingDiagram}>
                  {generatingDiagram ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Diagram
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing diagrams list */}
          {(diagrams?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Diagrams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {diagrams.map((diagram: DiagramData) => (
                    <Card key={diagram.id} className="hover:shadow-md transition-shadow overflow-hidden">
                      <CardHeader>
                        <CardTitle className="truncate">{diagram.title}</CardTitle>
                        <CardDescription>{diagram.type} diagram</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <DiagramViewer 
                          definition={diagram.definition}
                          title={diagram.title}
                          height={350}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!diagrams?.length && !generatingDiagram && !generatedDiagram) && (
            <EmptyState
              icon={Zap}
              title="No diagrams yet"
              description="Select a document and click 'Generate Diagram' to create your first diagram."
            />
          )}
        </TabsContent>

        {/* QUIZZES TAB */}
        <TabsContent value="quizzes" className="mt-4 space-y-6">
          {/* Generated quiz viewer */}
          {generatedQuiz && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedQuiz.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{generatedQuiz.difficulty}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('quiz')} aria-label="Close quiz">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <QuizViewer 
                  quiz={generatedQuiz}
                  onExportPdf={() => window.print()}
                />
              </CardContent>
            </Card>
          )}

          {generatingQuiz && (
            <LoadingState message="Generating quiz..." subtitle="This may take a moment" />
          )}

          {/* Generate new quiz */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Generate Quiz
              </CardTitle>
              <CardDescription>
                Create multiple-choice quizzes grounded in your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <DocumentSelector 
                  value={selectedSourceDoc} 
                  onChange={setSelectedSourceDoc} 
                  documents={documentsList}
                  className="w-full sm:w-80"
                />
                <Button onClick={generateQuiz} disabled={!selectedSourceDoc || generatingQuiz}>
                  {generatingQuiz ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Quiz
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing quizzes list */}
          {(quizzesData?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Quizzes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {quizzesData.map((quiz: QuizData) => (
                    <Card key={quiz.id} className="hover:shadow-md transition-shadow flex flex-col">
                      <CardHeader>
                        <CardTitle className="truncate">{quiz.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{quiz.difficulty}</Badge>
                          <Badge variant="secondary">{quiz.questions.length} questions</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        <p className="text-sm text-muted-foreground mb-4 flex-1">
                          {quiz.questions.slice(0, 2).map(q => q.prompt.slice(0, 60)).join(' · ')}
                          {quiz.questions.length > 2 && '…'}
                        </p>
                        <div className="flex items-center gap-2 pt-4 border-t">
                          <Button 
                            variant="default" 
                            className="flex-1"
                            onClick={() => setGeneratedQuiz(quiz)}
                          >
                            Start Quiz
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              if (confirm('Delete this quiz?')) {
                                await fetch(`/api/quizzes/generate?id=${quiz.id}`, { method: 'DELETE' })
                                queryClient.invalidateQueries({ queryKey: ['quizzes'] })
                                toast({ title: 'Quiz deleted' })
                              }
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(!quizzesData?.length && !generatingQuiz && !generatedQuiz) && (
            <EmptyState
              icon={CheckCircle2}
              title="No quizzes yet"
              description="Select a document and click 'Generate Quiz' to create your first practice quiz."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}