"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, Loader2, ChevronRight, ChevronLeft, Settings, Search, FlaskConical, HelpCircle, Link, Trash2, Link2, ListMinus, Filter, Trophy, Archive } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { MindMapViewer } from "@/components/study-studio/MindMapViewer"
import { DiagramViewer } from "@/components/study-studio/DiagramViewer"
import { exportMindMapAsSvg, exportMindMapAsPng, exportMindMapAsPdf, exportDiagramAsSvg, exportDiagramAsPng, exportDiagramAsPdf } from "@/lib/study-studio/export"
import { QuizViewer } from "@/components/study-studio/QuizViewer"
import { MarkdownRenderer } from "@/components/ui/markdown"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { RAGChat } from "@/components/rag/rag-chat"

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

// Research Notebook types
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

interface NotebookSourceItem {
  id: string
  notebookId: string
  documentId: string | null
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  documentType: string
  status: string
  pageCount: number | null
  chunksCount: number
  errorMessage: string | null
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

interface GeneratedQuizQuestion {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  citations?: Array<{
    id: string
    documentId: string
    documentTitle: string
    pageNumber: number | null
    sectionTitle: string | null
    excerpt: string
  }>
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

interface StudyStudioContentProps {
  initialTab: string
}

export function StudyStudioContent({ initialTab }: StudyStudioContentProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [selectedDeck, setSelectedDeck] = React.useState<string | null>(null)
  const [reviewMode, setReviewMode] = React.useState(false)
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [selectedSourceDoc, setSelectedSourceDoc] = React.useState("")
  
  // Research Notebook state
  const [selectedNotebook, setSelectedNotebook] = React.useState<string | null>(null)
  const [showCreateNotebook, setShowCreateNotebook] = React.useState(false)
  const [showAddTextSource, setShowAddTextSource] = React.useState(false)
  const [showCreateNote, setShowCreateNote] = React.useState(false)
  const [selectedExistingDocId, setSelectedExistingDocId] = React.useState("")
  const [textSourceTitle, setTextSourceTitle] = React.useState("")
  const [textSourceContent, setTextSourceContent] = React.useState("")
  const [noteTitle, setNoteTitle] = React.useState("")
  const [noteContent, setNoteContent] = React.useState("")
  const [selectedSourceDocIds, setSelectedSourceDocIds] = React.useState<string[]>([])
  const [generatedSynthesis, setGeneratedSynthesis] = React.useState<{
    type: string
    title: string
    content?: string
    faqs?: Array<{ question: string; answer: string; citations: any[] }>
    quiz?: { id: string; title: string; questions: GeneratedQuizQuestion[] }
    citations?: any[]
    provider?: string
    model?: string
  } | null>(null)
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = React.useState(false)
  const [researchActiveTab, setResearchActiveTab] = React.useState("notebooks")
  
  // States for generated content viewers
  const [generatedMindMap, setGeneratedMindMap] = React.useState<MindMapData | null>(null)
  const [generatedDiagram, setGeneratedDiagram] = React.useState<DiagramData | null>(null)
  const [generatedQuiz, setGeneratedQuiz] = React.useState<QuizData | null>(null)
   
   // Refs for export functionality
   const mindMapContainerRef = React.useRef<HTMLDivElement>(null)
   const diagramContainerRef = React.useRef<HTMLDivElement>(null)
   
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

  // Fetch research notebooks
  const { data: notebooksData, isLoading: notebooksLoading } = useQuery({
    queryKey: ["research-notebooks"],
    queryFn: async () => {
      const res = await fetch("/api/research/notebooks")
      if (!res.ok) throw new Error("Failed to fetch notebooks")
      return res.json()
    },
  })

  // Fetch notebook sources
  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["research-sources", selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { sources: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/sources`)
      if (!res.ok) throw new Error("Failed to fetch sources")
      return res.json()
    },
    enabled: Boolean(selectedNotebook),
  })

  // Fetch notebook notes
  const { data: notesData } = useQuery({
    queryKey: ["research-notes", selectedNotebook],
    queryFn: async () => {
      if (!selectedNotebook) return { notes: [] }
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/notes`)
      if (!res.ok) throw new Error("Failed to fetch notes")
      return res.json()
    },
    enabled: Boolean(selectedNotebook),
  })

  // Fetch all user documents for linking to notebooks
  const { data: allUserDocuments } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents")
      if (!res.ok) return { documents: [] }
      return res.json()
    },
  })

  const notebookSources: NotebookSourceItem[] = sourcesData?.sources || []

  const currentNotebook: ResearchNotebook | undefined = (notebooksData?.notebooks || []).find(
    (n: ResearchNotebook) => n.id === selectedNotebook
  )

  // Sync selected source doc IDs when notebook or sources change
  React.useEffect(() => {
    const readyDocIds = notebookSources
      .map(s => s.documentId)
      .filter((id): id is string => Boolean(id))
    setSelectedSourceDocIds(readyDocIds)
  }, [selectedNotebook, sourcesData])

  // Check if any critical queries failed
  const hasCriticalError = documentsError || notesError || decksError || mindMapsError || quizzesError

  const documentsList = Array.isArray(documents) ? documents : (documents?.documents || [])
  const filteredDocuments = documentsList.filter((d: any) => d.status === "READY")

  // Generate study material directly (synchronous)
  const generateStudyMaterial = async (type: string, sourceDocId: string, input: Record<string, any> = {}) => {
    const res = await fetch('/api/study-studio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, sourceDocId, input }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to generate')
    return data.result
  }

  // Generate study notes
  const generateNotes = useMutation({
    mutationFn: async ({ sourceDocId, type }: { sourceDocId: string; type: string }) => {
      return generateStudyMaterial('notes', sourceDocId, { type })
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
      return generateStudyMaterial('flashcards', sourceDocId, { count })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] })
      setSelectedDeck(data.deckId || data.deck?.id)
      setActiveTab("flashcards")
      toast({ title: "Flashcards generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate flashcards", variant: "destructive" }),
  })

  // Research Notebook mutations
  const createNotebook = useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const res = await fetch("/api/research/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Failed to create notebook")
      return payload
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setSelectedNotebook(data.notebook.id)
      setShowCreateNotebook(false)
      setResearchActiveTab("sources")
      toast({ title: "Notebook created", description: `"${data.notebook.title}" is ready for sources.` })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const deleteNotebook = useMutation({
    mutationFn: async (notebookId: string) => {
      const res = await fetch(`/api/research/notebooks/${notebookId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete notebook")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setSelectedNotebook(null)
      setResearchActiveTab("notebooks")
      toast({ title: "Notebook deleted" })
    },
  })

  const addSourceMutation = useMutation({
    mutationFn: async (payload: { documentId?: string; title?: string; content?: string }) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to add source")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setShowAddTextSource(false)
      setTextSourceTitle("")
      setTextSourceContent("")
      setSelectedExistingDocId("")
      toast({ title: "Source added and indexed in notebook" })
    },
    onError: (err: Error) =>
      toast({ title: "Error adding source", description: err.message, variant: "destructive" }),
  })

  const removeSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(
        `/api/research/notebooks/${selectedNotebook}/sources?sourceId=${encodeURIComponent(sourceId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to remove source")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({ title: "Source removed from notebook" })
    },
  })

  const createNoteMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string; tags?: string[] }) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          sourceIds: selectedSourceDocIds,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to save note")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      setShowCreateNote(false)
      setNoteTitle("")
      setNoteContent("")
      toast({ title: "Note saved to notebook" })
    },
    onError: (err: Error) =>
      toast({ title: "Error saving note", description: err.message, variant: "destructive" }),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!selectedNotebook) throw new Error("No notebook selected")
      const res = await fetch(
        `/api/research/notebooks/${selectedNotebook}/notes?noteId=${encodeURIComponent(noteId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete note")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({ title: "Note deleted" })
    },
  })

  const generateArtifactMutation = useMutation({
    mutationFn: async (type: "summary" | "study_guide" | "faq" | "quiz") => {
      if (!selectedNotebook) throw new Error("Select a notebook first")
      const res = await fetch(`/api/research/notebooks/${selectedNotebook}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          documentIds: selectedSourceDocIds.length > 0 ? selectedSourceDocIds : undefined,
          count: 5,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Generation failed")
      return data
    },
    onSuccess: (data) => {
      setGeneratedSynthesis(data)
      setQuizAnswers({})
      setQuizSubmitted(false)
      queryClient.invalidateQueries({ queryKey: ["research-notes", selectedNotebook] })
      queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
      toast({
        title: `${data.title || "Notebook synthesis"} ready`,
        description: `Grounded in ${data.sourcesUsed || 1} source(s) via ${data.provider} (${data.model}).`,
      })
    },
    onError: (err: Error) =>
      toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  })

  const toggleSourceSelection = (docId: string | null) => {
    if (!docId) return
    setSelectedSourceDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    )
  }

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
      const result = await generateStudyMaterial('mindmaps', selectedSourceDoc)
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
      const result = await generateStudyMaterial('diagrams', selectedSourceDoc)
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
      const result = await generateStudyMaterial('quizzes', selectedSourceDoc)
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

  // Download handlers
  const handleDownloadMindMapSvg = React.useCallback(async () => {
    if (!generatedMindMap) return
    try {
      await exportMindMapAsSvg(
        { nodes: generatedMindMap.nodes, edges: generatedMindMap.edges, title: generatedMindMap.title },
        mindMapContainerRef
      )
    } catch (error) {
      console.error('Failed to download SVG:', error)
    }
  }, [generatedMindMap])

  const handleDownloadMindMapPng = React.useCallback(async () => {
    if (!generatedMindMap) return
    try {
      await exportMindMapAsPng(
        { nodes: generatedMindMap.nodes, edges: generatedMindMap.edges, title: generatedMindMap.title },
        mindMapContainerRef
      )
    } catch (error) {
      console.error('Failed to download PNG:', error)
    }
  }, [generatedMindMap])

  const handleDownloadMindMapPdf = React.useCallback(async () => {
    if (!generatedMindMap) return
    try {
      await exportMindMapAsPdf(
        { nodes: generatedMindMap.nodes, edges: generatedMindMap.edges, title: generatedMindMap.title },
        mindMapContainerRef
      )
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }, [generatedMindMap])

  const handleDownloadDiagramSvg = React.useCallback(async () => {
    if (!generatedDiagram) return
    try {
      const diagramData = {
        svg: document.querySelector('.diagram-viewer svg')?.outerHTML || '',
        title: generatedDiagram.title,
        type: generatedDiagram.type,
      }
      await exportDiagramAsSvg(diagramData, diagramContainerRef)
    } catch (error) {
      console.error('Failed to download SVG:', error)
    }
  }, [generatedDiagram])

  const handleDownloadDiagramPng = React.useCallback(async () => {
    if (!generatedDiagram) return
    try {
      const diagramData = {
        svg: document.querySelector('.diagram-viewer svg')?.outerHTML || '',
        title: generatedDiagram.title,
        type: generatedDiagram.type,
      }
      await exportDiagramAsPng(diagramData, diagramContainerRef)
    } catch (error) {
      console.error('Failed to download PNG:', error)
    }
  }, [generatedDiagram])

  const handleDownloadDiagramPdf = React.useCallback(async () => {
    if (!generatedDiagram) return
    try {
      const diagramData = {
        svg: document.querySelector('.diagram-viewer svg')?.outerHTML || '',
        title: generatedDiagram.title,
        type: generatedDiagram.type,
      }
      await exportDiagramAsPdf(diagramData, diagramContainerRef)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }, [generatedDiagram])

  // Note type options
  const noteTypes = [
    { type: "concise", title: "Concise Notes", icon: FileText, desc: "Key points only" },
    { type: "detailed", title: "Detailed Notes", icon: BookOpen, desc: "Comprehensive coverage" },
    { type: "exam", title: "Exam Notes", icon: Target, desc: "High-yield for tests" },
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="notes">Smart Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="mindmaps">Mind Maps</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="research">Research Notebook</TabsTrigger>
          <TabsTrigger value="important-questions">Important Questions</TabsTrigger>
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
                  ref={mindMapContainerRef}
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
                  ref={diagramContainerRef}
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

        {/* RESEARCH NOTEBOOK TAB */}
        <TabsContent value="research" className="mt-4 space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Research Notebook</h1>
                <p className="text-muted-foreground mt-1">
                  Source-grounded notebooks for multi-document analysis, study guides, FAQs, quizzes, and cited Q&A
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentNotebook && (
                  <Badge variant="secondary" className="text-xs px-3 py-1">
                    Active: {currentNotebook.title} ({notebookSources.length} sources)
                  </Badge>
                )}
                <Button onClick={() => setShowCreateNotebook(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Notebook
                </Button>
              </div>
            </div>

            {showCreateNotebook && (
              <Card className="max-w-2xl border-primary/40">
                <CardHeader>
                  <CardTitle>Create New Research Notebook</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      const fd = new FormData(e.currentTarget)
                      createNotebook.mutate({
                        title: fd.get("title") as string,
                        description: fd.get("description") as string,
                      })
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <Label>Title</Label>
                      <Input name="title" placeholder="e.g., Molecular Biology & CRISPR Review" required />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea name="description" placeholder="Research scope, course, or thesis topic..." />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={createNotebook.isPending}>
                        {createNotebook.isPending ? "Creating..." : "Create Notebook"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowCreateNotebook(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Tabs value={researchActiveTab} onValueChange={setResearchActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="notebooks">Notebooks ({notebooksData?.notebooks?.length || 0})</TabsTrigger>
                <TabsTrigger value="sources">Sources ({notebookSources.length})</TabsTrigger>
                <TabsTrigger value="synthesis">Summaries, Guides, FAQs & Quizzes</TabsTrigger>
                <TabsTrigger value="chat">Grounded Q&A</TabsTrigger>
                <TabsTrigger value="notes">Notes ({notesData?.notes?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="notebooks" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {notebooksData?.notebooks?.map((notebook: ResearchNotebook) => (
                    <Card
                      key={notebook.id}
                      onClick={() => {
                        setSelectedNotebook(notebook.id)
                        setResearchActiveTab("sources")
                      }}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        selectedNotebook === notebook.id ? "border-primary ring-1 ring-primary" : ""
                      }`}
                    >
                      <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div>
                          <CardTitle>{notebook.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notebook.description || "No description"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={e => {
                            e.stopPropagation()
                            deleteNotebook.mutate(notebook.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{notebook._count?.sources ?? 0} sources</span>
                          <span>•</span>
                          <span>{notebook._count?.notes ?? 0} notes</span>
                          <span>•</span>
                          <span>{formatRelativeTime(notebook.updatedAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Card
                    onClick={() => setShowCreateNotebook(true)}
                    className="cursor-pointer hover:shadow-md transition-shadow border-dashed"
                  >
                    <CardContent className="pt-12 pb-12 text-center">
                      <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Create new notebook</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                {selectedNotebook ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <DocumentUpload
                        notebookId={selectedNotebook}
                        onSuccess={() => {
                          queryClient.invalidateQueries({ queryKey: ["research-sources", selectedNotebook] })
                          queryClient.invalidateQueries({ queryKey: ["research-notebooks"] })
                        }}
                      />

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Link className="h-4 w-4" />
                            Add Existing Document or Pasted Text Source
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Link Existing Processed Document</Label>
                            <div className="flex gap-2">
                              <Select value={selectedExistingDocId} onValueChange={setSelectedExistingDocId}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Choose from your uploaded documents..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(allUserDocuments?.documents || []).map((doc: any) => (
                                    <SelectItem key={doc.id} value={doc.id}>
                                      {doc.title} ({doc.documentType})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                disabled={!selectedExistingDocId || addSourceMutation.isPending}
                                onClick={() => addSourceMutation.mutate({ documentId: selectedExistingDocId })}
                              >
                                Link Source
                              </Button>
                            </div>
                          </div>

                          <div className="pt-2 border-t">
                            {!showAddTextSource ? (
                              <Button
                                variant="secondary"
                                className="w-full"
                                onClick={() => setShowAddTextSource(true)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Paste Raw Text / Lecture Notes as Source
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                <Input
                                  placeholder="Source title (e.g., Lecture 4 Transcript)"
                                  value={textSourceTitle}
                                  onChange={e => setTextSourceTitle(e.target.value)}
                                />
                                <Textarea
                                  placeholder="Paste source text, abstract, or markdown content here..."
                                  value={textSourceContent}
                                  onChange={e => setTextSourceContent(e.target.value)}
                                  rows={4}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={
                                      !textSourceTitle.trim() ||
                                      !textSourceContent.trim() ||
                                      addSourceMutation.isPending
                                    }
                                    onClick={() =>
                                      addSourceMutation.mutate({
                                        title: textSourceTitle,
                                        content: textSourceContent,
                                      })
                                    }
                                  >
                                    {addSourceMutation.isPending ? "Processing..." : "Process & Add Source"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setShowAddTextSource(false)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>Notebook Sources ({notebookSources.length})</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            Checked sources ({selectedSourceDocIds.length}) are active for Grounded Q&A, Summaries, Study Guides, FAQs, and Quizzes.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResearchActiveTab("synthesis")}
                            disabled={notebookSources.length === 0}
                          >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            Synthesize & Quiz
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setResearchActiveTab("chat")}
                            disabled={notebookSources.length === 0}
                          >
                            <Brain className="mr-1.5 h-4 w-4" />
                            Ask Sources
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {sourcesLoading ? (
                          <div className="py-8 text-center text-muted-foreground">Loading sources...</div>
                        ) : notebookSources.length === 0 ? (
                          <div className="py-10 text-center text-muted-foreground">
                            <FileText className="mx-auto h-10 w-10 mb-2 opacity-50" />
                            <p>No sources in this notebook yet. Upload a document or paste text above to begin.</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {notebookSources.map(source => {
                              const isSelected = Boolean(
                                source.documentId && selectedSourceDocIds.includes(source.documentId)
                              )
                              return (
                                <div
                                  key={source.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/40 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSourceSelection(source.documentId)}
                                      className="h-4 w-4 rounded border-primary"
                                      aria-label={`Include ${source.title}`}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm truncate">{source.title}</span>
                                        <Badge variant="outline" className="text-[11px]">
                                          {source.documentType}
                                        </Badge>
                                        <Badge
                                          variant={source.status === "READY" ? "secondary" : "destructive"}
                                          className="text-[11px]"
                                        >
                                          {source.status}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                                        <span>{source.fileName}</span>
                                        {source.pageCount && <span>· {source.pageCount} page(s)</span>}
                                        <span>· {source.chunksCount} indexed chunks</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeSourceMutation.mutate(source.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
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

              <TabsContent value="synthesis" className="mt-4">
                {selectedNotebook ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      {[
                        {
                          type: "summary" as const,
                          title: "Notebook Summary",
                          desc: "Executive briefing across all active sources",
                          icon: Sparkles,
                        },
                        {
                          type: "study_guide" as const,
                          title: "Study Guide",
                          desc: "Key concepts, definitions, formulas & review questions",
                          icon: BookOpen,
                        },
                        {
                          type: "faq" as const,
                          title: "Generate FAQs",
                          desc: "Frequently asked questions with page/section citations",
                          icon: HelpCircle,
                        },
                        {
                          type: "quiz" as const,
                          title: "Grounded Quiz",
                          desc: "Interactive multiple-choice quiz with cited explanations",
                          icon: CheckCircle2,
                        },
                      ].map(action => (
                        <Card
                          key={action.type}
                          onClick={() => {
                            if (!generateArtifactMutation.isPending) {
                              generateArtifactMutation.mutate(action.type)
                            }
                          }}
                          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20"
                        >
                          <CardContent className="pt-6 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                                <action.icon className="h-5 w-5" />
                              </div>
                              {generateArtifactMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            <h4 className="font-semibold text-sm">{action.title}</h4>
                            <p className="text-xs text-muted-foreground">{action.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {generatedSynthesis && (
                      <Card className="border-primary/30">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle>{generatedSynthesis.title}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              Grounded in your active notebook sources ({generatedSynthesis.provider} · {generatedSynthesis.model})
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            Source-Supported
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {generatedSynthesis.type === "quiz" && generatedSynthesis.quiz ? (
                            <div className="space-y-4">
                              {generatedSynthesis.quiz.questions.map((q, qIdx) => (
                                <div key={q.id} className="p-4 border rounded-lg space-y-3">
                                  <p className="font-medium text-sm">
                                    {qIdx + 1}. {q.prompt}
                                  </p>
                                  <div className="grid gap-2">
                                    {q.options.map((opt, oIdx) => {
                                      const selected = quizAnswers[q.id] === oIdx
                                      const isCorrect = q.answer === oIdx
                                      return (
                                        <Button
                                          key={oIdx}
                                          type="button"
                                          variant={
                                            quizSubmitted
                                              ? isCorrect
                                                ? "default"
                                                : selected
                                                  ? "destructive"
                                                  : "outline"
                                              : selected
                                                ? "default"
                                                : "outline"
                                          }
                                          className="justify-start text-left h-auto py-2 px-3 text-sm"
                                          onClick={() => {
                                            if (!quizSubmitted) {
                                              setQuizAnswers(prev => ({ ...prev, [q.id]: oIdx }))
                                            }
                                          }}
                                        >
                                          {opt}
                                        </Button>
                                      )
                                    })}
                                  </div>
                                  {quizSubmitted && (
                                    <div className="p-3 rounded bg-muted text-xs space-y-1">
                                      <p className="font-medium">{q.explanation}</p>
                                      {q.citations && q.citations.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {q.citations.map((c, cIdx) => (
                                            <Badge key={cIdx} variant="outline" className="text-[10px]">
                                              {c.documentTitle}
                                              {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                              {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                              <div className="flex items-center gap-3">
                                {!quizSubmitted ? (
                                  <Button onClick={() => setQuizSubmitted(true)}>Check Quiz Answers</Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setQuizAnswers({})
                                      setQuizSubmitted(false)
                                    }}
                                  >
                                    Retake Quiz
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : generatedSynthesis.type === "faq" && generatedSynthesis.faqs ? (
                            <div className="space-y-3">
                              {generatedSynthesis.faqs.map((faq, idx) => (
                                <div key={idx} className="p-4 border rounded-lg space-y-2">
                                  <h4 className="font-semibold text-sm">
                                    Q{idx + 1}: {faq.question}
                                  </h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
                                  {faq.citations && faq.citations.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {faq.citations.map((c: any, cIdx: number) => (
                                        <Badge key={cIdx} variant="outline" className="text-xs">
                                          [{cIdx + 1}] {c.documentTitle}
                                          {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                          {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="prose max-w-none whitespace-pre-wrap text-sm border rounded-lg p-4 bg-muted/20">
                                {generatedSynthesis.content}
                              </div>
                              {generatedSynthesis.citations && generatedSynthesis.citations.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {generatedSynthesis.citations.map((c: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      [{idx + 1}] {c.documentTitle}
                                      {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
                                      {c.sectionTitle ? ` · ${c.sectionTitle}` : ""}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-12 pb-12 text-center">
                      <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        Select a notebook to generate summaries, study guides, FAQs, and quizzes
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="chat" className="mt-4">
                {selectedNotebook ? (
                  <RAGChat
                    notebookId={selectedNotebook}
                    documentIds={selectedSourceDocIds.length > 0 ? selectedSourceDocIds : undefined}
                    onSaveAsNote={(title, content) =>
                      createNoteMutation.mutate({ title, content, tags: ["qa-saved"] })
                    }
                  />
                ) : (
                  <Card>
                    <CardContent className="pt-12 pb-12 text-center">
                      <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Select a notebook to chat with its sources</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                {selectedNotebook ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Notebook Notes ({notesData?.notes?.length || 0})</h2>
                      <Button onClick={() => setShowCreateNote(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Note
                      </Button>
                    </div>

                    {showCreateNote && (
                      <Card className="border-primary/40">
                        <CardHeader>
                          <CardTitle className="text-base">Add Research Note</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Input
                            placeholder="Note title..."
                            value={noteTitle}
                            onChange={e => setNoteTitle(e.target.value)}
                          />
                          <Textarea
                            placeholder="Write your research observations or synthesis..."
                            value={noteContent}
                            onChange={e => setNoteContent(e.target.value)}
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button
                              disabled={!noteTitle.trim() || !noteContent.trim() || createNoteMutation.isPending}
                              onClick={() =>
                                createNoteMutation.mutate({
                                  title: noteTitle,
                                  content: noteContent,
                                  tags: ["manual"],
                                })
                              }
                            >
                              Save Note
                            </Button>
                            <Button variant="outline" onClick={() => setShowCreateNote(false)}>
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      {notesData?.notes?.map((note: ResearchNote) => (
                        <Card key={note.id}>
                          <CardHeader className="flex flex-row items-start justify-between pb-2">
                            <div>
                              <CardTitle className="text-base">{note.title}</CardTitle>
                              <div className="flex gap-1 mt-1">
                                {(note.tags || []).map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-[10px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardHeader>
                          <CardContent>
                            <div className="prose max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">
                              {note.content}
                            </div>
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
            </Tabs>
          </div>
        </TabsContent>

        {/* IMPORTANT QUESTIONS TAB */}
        <TabsContent value="important-questions" className="mt-4 space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Important Questions Analyser</h1>
                <p className="text-muted-foreground mt-1">
                  Analyse Question Banks and Previous Year Question Papers to identify high-priority exam topics
                </p>
              </div>
              <Button variant="outline" disabled>
                <Plus className="mr-2 h-4 w-4" />
                Upload Question Papers
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
                <CardDescription>
                  This feature will allow you to upload Question Bank documents and Previous Year Question Papers (PYQs) 
                  to analyse recurring patterns, identify important topics, and generate practice questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-primary/20">
                    <CardContent className="pt-6 space-y-2">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <ListMinus className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold text-sm">Question Extraction</h4>
                      <p className="text-xs text-muted-foreground">Extract individual questions from PDFs, DOCX, and text documents</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/20">
                    <CardContent className="pt-6 space-y-2">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <Filter className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold text-sm">PYQ Analysis</h4>
                      <p className="text-xs text-muted-foreground">Identify recurring topics, question formats, and unit-wise distribution across years</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/20">
                    <CardContent className="pt-6 space-y-2">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold text-sm">Important Question Ranking</h4>
                      <p className="text-xs text-muted-foreground">Evidence-based priority ranking with frequency, recency, and marks weightage</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
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