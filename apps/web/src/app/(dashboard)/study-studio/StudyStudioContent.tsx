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
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, Loader2, ChevronRight, ChevronLeft, Settings, Search, FlaskConical, HelpCircle, Link, Trash2, Link2, ListMinus, Filter, Trophy, Archive, FolderOpen, FilePlus, X, Upload } from "lucide-react"
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
import { ImportantQuestionsNewTab } from "@/components/study-studio/important-questions/ImportantQuestionsNewTab"
import { EmptyState, LoadingState } from "@/components/ui/empty-state"

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

interface Subject {
  id: string
  name: string
  code: string
  semester: string | null
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

// Important Questions Analyser types
interface QuestionPaper {
  id: string
  userId: string
  title: string
  fileName: string
  fileSize: string
  mimeType: string
  storagePath: string
  paperType: 'QB' | 'PYQ'
  subjectId: string | null
  semester: string | null
  unit: string | null
  academicYear: string | null
  examinationYear: number | null
  marks: number | null
  status: string
  pageCount: number | null
  metadata: any
  createdAt: string
  updatedAt: string
  subject?: { id: string; name: string; code: string } | null
  _count?: { questions: number }
  questions?: ExtractedQuestion[]
}

interface ExtractedQuestion {
  id: string
  questionPaperId: string
  questionNumber: string
  text: string
  subQuestions: any | null
  marks: number | null
  unit: string | null
  topic: string | null
  concept: string | null
  questionType: string | null
  difficulty: string | null
  year: number | null
  pageReference: number | null
  extractionConfidence: number
  flags: string[]
  createdAt: string
  updatedAt: string
}

interface QuestionAnalysis {
  id: string
  userId: string
  title: string
  subjectId: string | null
  paperIds: string[]
  totalQuestions: number
  exactRepeats: number
  semanticRepeats: number
  analysisData: any
  createdAt: string
  updatedAt: string
  subject?: { id: string; name: string; code: string } | null
  priorityItems?: QuestionPriorityItem[]
}

interface QuestionPriorityItem {
  id: string
  analysisId: string
  questionId: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
  frequency: number
  recencyScore: number
  marksWeight: number
  unitRelevance: number
  papersCount: number
  createdAt: string
  // From analysisData
  questionText?: string
  concept?: string
  units?: string[]
  topics?: string[]
  concepts?: string[]
  questionTypes?: string[]
  firstYear?: number | null
  lastYear?: number | null
  avgMarks?: number
  isExactRepeat?: boolean
  matchedQuestionIds?: string[]
}

interface GeneratedPracticePaper {
  id: string
  userId: string
  title: string
  sourceAnalysisId: string | null
  paperType: 'PRACTICE' | 'MOCK' | 'PREDICTED' | 'UNIT_WISE'
  subjectId: string | null
  unit: string | null
  questions: any[]
  totalMarks: number
  durationMinutes: number | null
  metadata: any
  createdAt: string
  updatedAt: string
  subject?: { id: string; name: string; code: string } | null
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
  
  // Important Questions Analyser state
  const [iqPapers, setIqPapers] = React.useState<QuestionPaper[]>([])
  const [selectedIqPaper, setSelectedIqPaper] = React.useState<QuestionPaper | null>(null)
  const [showUploadPaper, setShowUploadPaper] = React.useState(false)
  const [uploadPaperForm, setUploadPaperForm] = React.useState({
    title: '',
    paperType: 'PYQ' as 'QB' | 'PYQ',
    subjectId: '',
    semester: '',
    unit: '',
    academicYear: '',
    examinationYear: '',
    marks: '',
    files: [] as File[],
  })
  const [selectedExistingPaperIds, setSelectedExistingPaperIds] = React.useState<string[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [iqAnalyses, setIqAnalyses] = React.useState<QuestionAnalysis[]>([])
  const [selectedIqAnalysis, setSelectedIqAnalysis] = React.useState<QuestionAnalysis | null>(null)
  const [showCreateAnalysis, setShowCreateAnalysis] = React.useState(false)
  const [createAnalysisForm, setCreateAnalysisForm] = React.useState({
    title: '',
    subjectId: '',
    paperIds: [] as string[],
    filters: {} as any,
  })
  const [showGeneratePractice, setShowGeneratePractice] = React.useState(false)
  const [generatePracticeForm, setGeneratePracticeForm] = React.useState({
    title: '',
    paperType: 'PRACTICE' as 'PRACTICE' | 'MOCK' | 'PREDICTED' | 'UNIT_WISE',
    subjectId: '',
    unit: '',
    questionCount: 10,
    totalMarks: 100,
    durationMinutes: '',
    difficulty: 'MEDIUM',
    questionTypes: [] as string[],
    sourceAnalysisId: '',
  })
  const [iqActiveTab, setIqActiveTab] = React.useState("papers")
  const [extractingPaper, setExtractingPaper] = React.useState<string | null>(null)
  const [creatingAnalysis, setCreatingAnalysis] = React.useState(false)
  const [generatingPractice, setGeneratingPractice] = React.useState(false)

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

  // Fetch question papers
  const { data: papersData, refetch: refetchPapers } = useQuery({
    queryKey: ["question-papers"],
    queryFn: async () => {
      const res = await fetch("/api/study-studio/important-questions-v2/documents")
      if (!res.ok) throw new Error("Failed to fetch question papers")
      return res.json()
    },
  })

  // Fetch analyses
  const { data: analysesData, refetch: refetchAnalyses } = useQuery({
    queryKey: ["question-analyses"],
    queryFn: async () => {
      const res = await fetch("/api/study-studio/important-questions-v2/analyses")
      if (!res.ok) throw new Error("Failed to fetch analyses")
      return res.json()
    },
  })

  // Fetch subjects for Important Questions
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", "my"],
    queryFn: async () => {
      const res = await fetch("/api/subjects/my")
      if (!res.ok) return { subjects: [] }
      return res.json()
    },
  })

  const iqSubjects: Subject[] = subjectsData?.subjects || []

  const questionPapers: QuestionPaper[] = papersData?.papers || []
  const questionAnalyses: QuestionAnalysis[] = analysesData?.analyses || []

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

  // Important Questions mutations
  const uploadPaperMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/study-studio/important-questions-v2/documents", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error?.message || "Failed to upload paper")
      return data
    },
    onSuccess: () => {
      refetchPapers()
      setShowUploadPaper(false)
      setUploadPaperForm({
        title: '',
        paperType: 'PYQ',
        subjectId: '',
        semester: '',
        unit: '',
        academicYear: '',
        examinationYear: '',
        marks: '',
        files: [],
      })
      toast({ title: "Question paper uploaded successfully" })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const extractQuestionsMutation = useMutation({
    mutationFn: async ({ paperId, provider, model }: { paperId: string; provider?: string; model?: string }) => {
      setExtractingPaper(paperId)
      const res = await fetch(`/api/study-studio/important-questions-v2/documents/${paperId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'extract', provider, model }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error?.message || "Failed to extract questions")
      return data
    },
    onSuccess: (data, variables) => {
      refetchPapers()
      setExtractingPaper(null)
      toast({ title: `Extracted ${data.extractedCount} questions` })
      // Auto-select the paper to show extracted questions
      const paper = questionPapers.find(p => p.id === variables.paperId)
      if (paper) setSelectedIqPaper({ ...paper, questions: data.questions })
    },
    onError: (err: Error) => {
      setExtractingPaper(null)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const deletePaperMutation = useMutation({
    mutationFn: async (paperId: string) => {
      const res = await fetch(`/api/study-studio/important-questions-v2/documents/${paperId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete paper")
      return res.json()
    },
    onSuccess: () => {
      refetchPapers()
      if (selectedIqPaper?.id === selectedIqPaper?.id) setSelectedIqPaper(null)
      toast({ title: "Question paper deleted" })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const createAnalysisMutation = useMutation({
    mutationFn: async (data: { title: string; subjectId: string; paperIds: string[]; filters: any }) => {
      setCreatingAnalysis(true)
      const res = await fetch("/api/study-studio/important-questions-v2/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: data.paperIds,
          title: data.title,
          instructions: data.filters?.additionalInstructions,
          focusUnits: data.filters?.focusUnits,
          prioritizeMarks: data.filters?.prioritizeMarks,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error?.message || "Failed to create analysis")
      return payload
    },
    onSuccess: (data) => {
      refetchAnalyses()
      setCreatingAnalysis(false)
      setShowCreateAnalysis(false)
      setCreateAnalysisForm({ title: '', subjectId: '', paperIds: [], filters: {} })
      setSelectedIqAnalysis(data.analysis)
      setIqActiveTab("analysis")
      toast({ title: "Analysis created successfully" })
    },
    onError: (err: Error) => {
      setCreatingAnalysis(false)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/study-studio/important-questions-v2/analyses/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete analysis")
      return { id }
    },
    onSuccess: (data) => {
      refetchAnalyses()
      if (selectedIqAnalysis?.id === data.id) setSelectedIqAnalysis(null)
      toast({ title: "Analysis deleted" })
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const generatePracticeMutation = useMutation({
    mutationFn: async (data: any) => {
      setGeneratingPractice(true)
      const res = await fetch("/api/important-questions/generate-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Failed to generate practice paper")
      return payload
    },
    onSuccess: (data) => {
      setGeneratingPractice(false)
      setShowGeneratePractice(false)
      setGeneratePracticeForm({
        title: '',
        paperType: 'PRACTICE',
        subjectId: '',
        unit: '',
        questionCount: 10,
        totalMarks: 100,
        durationMinutes: '',
        difficulty: 'MEDIUM',
        questionTypes: [],
        sourceAnalysisId: '',
      })
      toast({ title: "Practice paper generated successfully" })
    },
    onError: (err: Error) => {
      setGeneratingPractice(false)
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
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

  // Note type options - Only Formula Sheet per requirements
  const noteTypes = [
    { type: "formulas", title: "Formula Sheet", icon: FileText, desc: "Equations & constants with symbols explained" },
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
        <TabsList className="flex w-full overflow-x-auto gap-1 pb-2" style={{ scrollbarWidth: 'none' }}>
          <TabsTrigger value="notes" className="whitespace-nowrap">Formula Sheet</TabsTrigger>
          <TabsTrigger value="flashcards" className="whitespace-nowrap">Flashcards</TabsTrigger>
          <TabsTrigger value="mindmaps" className="whitespace-nowrap">Mind Maps</TabsTrigger>
          <TabsTrigger value="diagrams" className="whitespace-nowrap">Diagrams</TabsTrigger>
          <TabsTrigger value="quizzes" className="whitespace-nowrap">Quizzes</TabsTrigger>
          <TabsTrigger value="research" className="whitespace-nowrap">Research Notebook</TabsTrigger>
          <TabsTrigger value="important-questions" className="whitespace-nowrap">Important Questions</TabsTrigger>
        </TabsList>

        {/* SMART NOTES TAB */}
        <TabsContent value="notes" className="mt-4 space-y-6">
          <div className="space-y-6">
            {/* Generation Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Formula Sheet
                </CardTitle>
                <CardDescription>
                  Select a document above to generate a formula sheet with equations, constants, and symbol explanations
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
                    description="Choose a processed document from the selector above to generate a formula sheet."
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
                    Generated Formula Sheets
                  </CardTitle>
                  <CardDescription>{notes.materials.length} formula sheets generated</CardDescription>
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
                title="No formula sheets generated yet"
                description="Click 'Generate' above to create your first formula sheet."
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
                                            <Badge key={cIdx} variant="outline" className="text-xs">
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
                                  <Badge key={tag} variant="secondary" className="text-xs">
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
            {/* Tab Navigation for IQ Analyser */}
            <Tabs value={iqActiveTab} onValueChange={setIqActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="papers">Question Papers ({questionPapers.length})</TabsTrigger>
                <TabsTrigger value="extract" disabled={!selectedIqPaper}>Extract Questions</TabsTrigger>
                <TabsTrigger value="analysis">Analyses ({questionAnalyses.length})</TabsTrigger>
                <TabsTrigger value="practice">Practice Papers</TabsTrigger>
              </TabsList>

              {/* PAPERS TAB */}
              <TabsContent value="papers" className="mt-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Question Papers</h2>
                    <p className="text-sm text-muted-foreground">Upload Question Banks (QB) and Previous Year Question Papers (PYQs)</p>
                  </div>
                  <Button onClick={() => setShowUploadPaper(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload Paper
                  </Button>
                </div>

                {showUploadPaper && (
                  <Card className="border-primary/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Upload Question Papers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const fd = new FormData()
                          fd.append('title', uploadPaperForm.title)
                          fd.append('paperType', uploadPaperForm.paperType)
                          if (uploadPaperForm.subjectId) fd.append('subjectId', uploadPaperForm.subjectId)
                          if (uploadPaperForm.semester) fd.append('semester', uploadPaperForm.semester)
                          if (uploadPaperForm.unit) fd.append('unit', uploadPaperForm.unit)
                          if (uploadPaperForm.academicYear) fd.append('academicYear', uploadPaperForm.academicYear)
                          if (uploadPaperForm.examinationYear) fd.append('examinationYear', uploadPaperForm.examinationYear)
                          if (uploadPaperForm.marks) fd.append('marks', uploadPaperForm.marks)
                          uploadPaperForm.files.forEach(file => fd.append('files', file))
                          // Also send selected existing paper IDs
                          selectedExistingPaperIds.forEach(id => fd.append('existingPaperIds', id))
                          uploadPaperMutation.mutate(fd)
                        }}
                        className="space-y-6"
                      >
                        {/* Upload New Files Section */}
                        <div className="space-y-4">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Upload New Files
                          </h4>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Title (optional for multiple files)</Label>
                              <Input
                                placeholder="e.g., Physics PYQ 2023 - Semester 1"
                                value={uploadPaperForm.title}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, title: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Paper Type</Label>
                              <Select value={uploadPaperForm.paperType} onValueChange={v => setUploadPaperForm(prev => ({ ...prev, paperType: v as 'QB' | 'PYQ' }))}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="QB">Question Bank (QB)</SelectItem>
                                  <SelectItem value="PYQ">Previous Year Question Paper (PYQ)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Subject</Label>
                              <Select value={uploadPaperForm.subjectId} onValueChange={v => setUploadPaperForm(prev => ({ ...prev, subjectId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select subject (optional)" /></SelectTrigger>
                                <SelectContent>
                                  {iqSubjects.map((subj: Subject) => (
                                    <SelectItem key={subj.id} value={subj.id}>{subj.code} - {subj.name} {subj.semester && `(${subj.semester})`}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Semester</Label>
                              <Input
                                placeholder="e.g., Semester 3"
                                value={uploadPaperForm.semester}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, semester: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit</Label>
                              <Input
                                placeholder="e.g., Unit 1: Mechanics"
                                value={uploadPaperForm.unit}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, unit: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Academic Year</Label>
                              <Input
                                placeholder="e.g., 2023-2024"
                                value={uploadPaperForm.academicYear}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, academicYear: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Examination Year</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 2023"
                                value={uploadPaperForm.examinationYear}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, examinationYear: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Marks</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 100"
                                value={uploadPaperForm.marks}
                                onChange={e => setUploadPaperForm(prev => ({ ...prev, marks: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Files (PDF, DOCX, TXT, MD) - Max 10 files, 50MB each</Label>
                              <div
                                className="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary/50"
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                                onDragLeave={e => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                                onDrop={e => {
                                  e.preventDefault()
                                  e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
                                  const files = Array.from(e.dataTransfer.files)
                                  setUploadPaperForm(prev => ({ ...prev, files: [...prev.files, ...files].slice(0, 10) }))
                                }}
                              >
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf,.docx,.doc,.txt,.md"
                                  multiple
                                  onChange={e => setUploadPaperForm(prev => ({ ...prev, files: [...prev.files, ...Array.from(e.target.files || [])].slice(0, 10) }))}
                                  className="hidden"
                                  id="iq-file-input"
                                />
                                <div className="flex flex-col items-center gap-4">
                                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                                    <Upload className="h-6 w-6" />
                                  </div>
                                  <div>
                                    <p className="font-medium">Drag & drop files here, or</p>
                                    <Button
                                      variant="outline"
                                      onClick={() => fileInputRef.current?.click()}
                                      className="mt-2"
                                    >
                                      <FilePlus className="mr-2 h-4 w-4" />
                                      Browse Files
                                    </Button>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Supported: PDF, DOCX, DOC, TXT, MD • Max 50MB each • Max 10 files
                                  </p>
                                </div>
                              </div>
                              {uploadPaperForm.files.length > 0 && (
                                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                                  <p className="text-xs font-medium text-muted-foreground">Selected files ({uploadPaperForm.files.length}/10)</p>
                                  {uploadPaperForm.files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{file.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive hover:text-destructive"
                                          onClick={() => setUploadPaperForm(prev => ({
                                            ...prev,
                                            files: prev.files.filter((_, i) => i !== idx)
                                          }))}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Select Existing Papers Section */}
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            Or Select Already-Uploaded Papers
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Choose from papers that already have questions extracted (status: READY)
                          </p>
                          {questionPapers.filter(p => p.status === 'READY' && p._count?.questions && p._count.questions > 0).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No papers with extracted questions available.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                              {questionPapers
                                .filter(p => p.status === 'READY' && p._count?.questions && p._count.questions > 0)
                                .map((paper: QuestionPaper) => (
                                  <label key={paper.id} className="flex items-center gap-3 p-2 hover:bg-accent/50 rounded cursor-pointer transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={selectedExistingPaperIds.includes(paper.id)}
                                      onChange={e => setSelectedExistingPaperIds(prev =>
                                        e.target.checked
                                          ? [...prev, paper.id]
                                          : prev.filter(id => id !== paper.id)
                                      )}
                                      className="h-4 w-4 rounded border-primary"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{paper.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {paper.paperType} • {paper._count?.questions || 0} questions • {paper.subject?.code || 'No subject'}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">{paper._count?.questions || 0} Qs</Badge>
                                  </label>
                                ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                          <Button type="submit" disabled={uploadPaperMutation.isPending || (uploadPaperForm.files.length === 0 && selectedExistingPaperIds.length === 0)}>
                            {uploadPaperMutation.isPending ? "Uploading..." : 
                              `Add ${uploadPaperForm.files.length + selectedExistingPaperIds.length} Paper${uploadPaperForm.files.length + selectedExistingPaperIds.length > 1 ? 's' : ''}`}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => {
                            setShowUploadPaper(false)
                            setUploadPaperForm({
                              title: '',
                              paperType: 'PYQ',
                              subjectId: '',
                              semester: '',
                              unit: '',
                              academicYear: '',
                              examinationYear: '',
                              marks: '',
                              files: [],
                            })
                            setSelectedExistingPaperIds([])
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {questionPapers.length === 0 && !showUploadPaper && (
                  <EmptyState
                    icon={FileText}
                    title="No question papers uploaded"
                    description="Upload Question Banks or Previous Year Question Papers to begin analysis."
                    action={
                      <Button onClick={() => setShowUploadPaper(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload First Paper
                      </Button>
                    }
                  />
                )}

                {questionPapers.length > 0 && (
                  <div className="space-y-4">
                    {questionPapers.map((paper: QuestionPaper) => (
                      <Card
                        key={paper.id}
                        className={cn(
                          "hover:shadow-md transition-shadow cursor-pointer",
                          selectedIqPaper?.id === paper.id && "border-primary ring-1 ring-primary"
                        )}
                        onClick={() => setSelectedIqPaper(paper)}
                      >
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Badge variant={paper.paperType === 'PYQ' ? 'secondary' : 'outline'} className="text-xs">
                                {paper.paperType}
                              </Badge>
                              {paper.title}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                              {paper.subject && <span>{paper.subject.code} - {paper.subject.name}</span>}
                              {paper.semester && <span>•</span>}
                              {paper.semester && <span>{paper.semester}</span>}
                              {paper.examinationYear && <span>•</span>}
                              {paper.examinationYear && <span>{paper.examinationYear}</span>}
                              {paper.unit && <span>•</span>}
                              {paper.unit && <span>{paper.unit}</span>}
                              <span>•</span>
                              <Badge variant={paper.status === 'READY' ? 'success' : 'warning'} className="text-xs">
                                {paper.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {paper.status === 'READY' && paper.questions && paper.questions.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {paper.questions.length} questions
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deletePaperMutation.mutate(paper.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{paper._count?.questions || 0} questions extracted</span>
                            {paper.marks && <span>• Max marks: {paper.marks}</span>}
                            <span>• {formatRelativeTime(paper.createdAt)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* EXTRACT QUESTIONS TAB */}
              <TabsContent value="extract" className="mt-4 space-y-6">
                {selectedIqPaper ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{selectedIqPaper.title}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedIqPaper.paperType} • {selectedIqPaper._count?.questions || 0} questions
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {selectedIqPaper.status !== 'READY' && (
                          <Button
                            onClick={() => extractQuestionsMutation.mutate({ paperId: selectedIqPaper.id })}
                            disabled={extractingPaper === selectedIqPaper.id}
                          >
                            {extractingPaper === selectedIqPaper.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Extracting...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Extract Questions with AI
                              </>
                            )}
                          </Button>
                        )}
                        {selectedIqPaper.status === 'READY' && (
                          <Button variant="outline" onClick={() => extractQuestionsMutation.mutate({ paperId: selectedIqPaper.id })}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Re-extract
                          </Button>
                        )}
                      </div>
                    </div>

                    {extractingPaper === selectedIqPaper.id && (
                      <LoadingState message="Extracting questions with AI..." subtitle="This may take a moment depending on document length" />
                    )}

                    {selectedIqPaper.status === 'READY' && selectedIqPaper.questions && selectedIqPaper.questions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Extracted Questions ({selectedIqPaper.questions.length})</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                                Extracted PYQ
                              </Badge>
                              <span>Source: {selectedIqPaper.fileName}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4 max-h-[600px] overflow-y-auto">
                            {selectedIqPaper.questions.map((q: ExtractedQuestion, idx: number) => (
                              <div key={q.id} className="p-4 border rounded-lg space-y-3 bg-card">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">
                                      <span className="text-primary mr-2">Q{q.questionNumber}.</span>
                                      {q.text}
                                    </p>
                                    {q.subQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0 && (
                                      <div className="ml-6 mt-2 space-y-1 text-sm text-muted-foreground">
                                        {q.subQuestions.map((sq: any, si: number) => (
                                          <p key={si}>{sq.label}) {sq.text} {sq.marks && `(${sq.marks} marks)`}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                                    {q.marks && <Badge variant="outline">{q.marks} marks</Badge>}
                                    {q.unit && <Badge variant="secondary">{q.unit}</Badge>}
                                    {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                                    {q.concept && <Badge variant="outline">{q.concept}</Badge>}
                                    {q.questionType && <Badge variant="secondary">{q.questionType}</Badge>}
                                    {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                                    {q.year && <Badge variant="outline">{q.year}</Badge>}
                                    {q.pageReference && <Badge variant="outline">p.{q.pageReference}</Badge>}
                                    {q.extractionConfidence < 0.8 && (
                                      <Badge variant="destructive" className="text-xs">Low confidence: {(q.extractionConfidence * 100).toFixed(0)}%</Badge>
                                    )}
                                    {q.flags && q.flags.length > 0 && (
                                      <Badge variant="destructive" className="text-xs">{q.flags.join(', ')}</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedIqPaper.status === 'READY' && (!selectedIqPaper.questions || selectedIqPaper.questions.length === 0) && (
                      <EmptyState
                        icon={ListMinus}
                        title="No questions extracted yet"
                        description="Click 'Extract Questions with AI' to analyze this paper."
                      />
                    )}

                    {selectedIqPaper.status !== 'READY' && (
                      <Card className="border-warning">
                        <CardContent className="p-6 text-center">
                          <AlertCircle className="mx-auto h-10 w-10 text-warning mb-2" />
                          <h4 className="font-medium">Paper not ready for extraction</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            The paper status is "{selectedIqPaper.status}". Text extraction from binary documents (PDF, DOCX) 
                            requires the document processing pipeline. Please ensure the document has been processed, 
                            or use text-based files (TXT, MD) for immediate extraction.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-12 pb-12 text-center">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Select a question paper from the "Question Papers" tab to extract questions.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ANALYSIS TAB */}
              <TabsContent value="analysis" className="mt-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Question Analyses</h2>
                    <p className="text-sm text-muted-foreground">Analyze patterns across multiple question papers</p>
                  </div>
                  <Button onClick={() => setShowCreateAnalysis(true)} disabled={questionPapers.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Analysis
                  </Button>
                </div>

                {showCreateAnalysis && (
                  <Card className="border-primary/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Create New Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          createAnalysisMutation.mutate(createAnalysisForm)
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label>Analysis Title</Label>
                          <Input
                            placeholder="e.g., Physics PYQ Analysis 2020-2024"
                            value={createAnalysisForm.title}
                            onChange={e => setCreateAnalysisForm(prev => ({ ...prev, title: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Select value={createAnalysisForm.subjectId} onValueChange={v => setCreateAnalysisForm(prev => ({ ...prev, subjectId: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select subject (optional)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">General / All Subjects</SelectItem>
                              {(allUserDocuments?.documents || []).map((doc: any) => (
                                <SelectItem key={doc.id} value={doc.id}>{doc.title} ({doc.documentType})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Select Papers to Analyze</Label>
                          <div className="space-y-2">
                            {questionPapers
                              .filter(p => p.status === 'READY' && p.questions && p.questions.length > 0)
                              .map((paper: QuestionPaper) => (
                                <label key={paper.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/40 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={createAnalysisForm.paperIds.includes(paper.id)}
                                    onChange={(e) =>
                                      setCreateAnalysisForm(prev => ({
                                        ...prev,
                                        paperIds: e.target.checked
                                          ? [...prev.paperIds, paper.id]
                                          : prev.paperIds.filter(id => id !== paper.id),
                                      }))
                                    }
                                    className="h-4 w-4 rounded border-primary"
                                  />
                                  <div>
                                    <p className="font-medium text-sm">{paper.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {paper.paperType} • {paper.questions?.length || 0} questions
                                      {paper.examinationYear && ` • ${paper.examinationYear}`}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            {questionPapers.filter(p => p.status === 'READY' && p.questions && p.questions.length > 0).length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                No papers with extracted questions available. Extract questions first.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                          <Button type="submit" disabled={creatingAnalysis || createAnalysisForm.paperIds.length === 0}>
                            {creatingAnalysis ? "Creating..." : "Create Analysis"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setShowCreateAnalysis(false)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {questionAnalyses.length === 0 && !showCreateAnalysis && (
                  <EmptyState
                    icon={Filter}
                    title="No analyses created yet"
                    description="Create an analysis to identify recurring patterns, important topics, and question priorities."
                    action={
                      <Button onClick={() => setShowCreateAnalysis(true)} disabled={questionPapers.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Analysis
                      </Button>
                    }
                  />
                )}

                {questionAnalyses.length > 0 && (
                  <div className="space-y-4">
                    {questionAnalyses.map((analysis: QuestionAnalysis) => (
                      <Card
                        key={analysis.id}
                        className={cn(
                          "hover:shadow-md transition-shadow cursor-pointer",
                          selectedIqAnalysis?.id === analysis.id && "border-primary ring-1 ring-primary"
                        )}
                        onClick={() => setSelectedIqAnalysis(analysis)}
                      >
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                          <div>
                            <CardTitle>{analysis.title}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                              {analysis.subject && <span>{analysis.subject.code} - {analysis.subject.name}</span>}
                              <span>•</span>
                              <span>{analysis.totalQuestions} questions</span>
                              <span>•</span>
                              <span>{analysis.paperIds.length} papers</span>
                              <span>•</span>
                              <Badge variant="outline">{analysis.exactRepeats} exact repeats</Badge>
                              <span>•</span>
                              <Badge variant="secondary">{analysis.semanticRepeats} semantic repeats</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteAnalysisMutation.mutate(analysis.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{formatRelativeTime(analysis.createdAt)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedIqAnalysis && (
                  <Card className="border-primary/30 animate-in slide-in-from-bottom-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{selectedIqAnalysis.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedIqAnalysis.totalQuestions} questions • {selectedIqAnalysis.paperIds.length} papers • {selectedIqAnalysis.exactRepeats} exact repeats
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGeneratePracticeForm(prev => ({
                              ...prev,
                              title: `${selectedIqAnalysis.title} - Practice`,
                              sourceAnalysisId: selectedIqAnalysis.id,
                              subjectId: selectedIqAnalysis.subjectId || '',
                            }))
                            setShowGeneratePractice(true)
                            setIqActiveTab("practice")
                          }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Practice Paper
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-primary">{selectedIqAnalysis.priorityItems?.filter((p: any) => p.priority === 'HIGH').length || 0}</div>
                            <div className="text-sm text-muted-foreground">High Priority Topics</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">{selectedIqAnalysis.priorityItems?.filter((p: any) => p.priority === 'MEDIUM').length || 0}</div>
                            <div className="text-sm text-muted-foreground">Medium Priority Topics</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-gray-600">{selectedIqAnalysis.priorityItems?.filter((p: any) => p.priority === 'LOW').length || 0}</div>
                            <div className="text-sm text-muted-foreground">Low Priority Topics</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-amber-600">{selectedIqAnalysis.analysisData?.totalQuestions || 0}</div>
                            <div className="text-sm text-muted-foreground">Total Questions Analyzed</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Priority Items */}
                      {selectedIqAnalysis.priorityItems && selectedIqAnalysis.priorityItems.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-semibold">Priority Topics & Questions</h4>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {selectedIqAnalysis.priorityItems.map((item: QuestionPriorityItem, idx: number) => (
                              <Card key={item.id} className={cn(
                                "overflow-hidden",
                                item.priority === 'HIGH' && "border-l-4 border-l-red-500",
                                item.priority === 'MEDIUM' && "border-l-4 border-l-amber-500",
                                item.priority === 'LOW' && "border-l-4 border-l-gray-400"
                              )}>
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant={item.priority === 'HIGH' ? 'destructive' : item.priority === 'MEDIUM' ? 'warning' : 'secondary'}>
                                          {item.priority}
                                        </Badge>
                                        <span className="font-medium text-sm">{item.concept || item.questionText?.slice(0, 80) || 'General'}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-2">{item.reason}</p>
                                      <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                        <Badge variant="outline">Freq: {item.frequency}</Badge>
                                        <Badge variant="outline">Papers: {item.papersCount}</Badge>
                                        <Badge variant="outline">Avg Marks: {item.avgMarks?.toFixed(1) || 'N/A'}</Badge>
                                        {item.firstYear && item.lastYear && (
                                          <Badge variant="outline">Years: {item.firstYear}-{item.lastYear}</Badge>
                                        )}
                                        {item.isExactRepeat && <Badge variant="destructive" className="text-xs">Exact Repeat</Badge>}
                                      </div>
                                      {item.units && item.units.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {item.units.map((u: string, ui: number) => (
                                            <Badge key={ui} variant="secondary" className="text-xs">{u}</Badge>
                                          ))}
                                        </div>
                                      )}
                                      {item.topics && item.topics.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {item.topics.map((t: string, ti: number) => (
                                            <Badge key={ti} variant="outline" className="text-xs">{t}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {item.questionText && (
                                      <div className="text-right text-sm text-muted-foreground max-w-xs">
                                        <p className="font-medium">{item.questionText.slice(0, 120)}…</p>
                                        <p className="text-xs mt-1">Click analysis card for full details</p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Distributions */}
                      {selectedIqAnalysis.analysisData && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {selectedIqAnalysis.analysisData.unitDistribution && Object.keys(selectedIqAnalysis.analysisData.unitDistribution).length > 0 && (
                            <Card>
                              <CardHeader><CardTitle>Unit Distribution</CardTitle></CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {Object.entries(selectedIqAnalysis.analysisData.unitDistribution as Record<string, number>)
                                    .sort(([,a], [,b]) => b - a)
                                    .map(([unit, count]) => (
                                      <div key={unit} className="flex items-center justify-between text-sm">
                                        <span>{unit}</span>
                                        <Badge variant="outline">{count} questions</Badge>
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          {selectedIqAnalysis.analysisData.topicDistribution && Object.keys(selectedIqAnalysis.analysisData.topicDistribution).length > 0 && (
                            <Card>
                              <CardHeader><CardTitle>Topic Distribution</CardTitle></CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {Object.entries(selectedIqAnalysis.analysisData.topicDistribution as Record<string, number>)
                                    .sort(([,a], [,b]) => b - a)
                                    .slice(0, 15)
                                    .map(([topic, count]) => (
                                      <div key={topic} className="flex items-center justify-between text-sm">
                                        <span className="truncate max-w-[200px]">{topic}</span>
                                        <Badge variant="outline">{count} questions</Badge>
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          {selectedIqAnalysis.analysisData.marksDistribution && Object.keys(selectedIqAnalysis.analysisData.marksDistribution).length > 0 && (
                            <Card>
                              <CardHeader><CardTitle>Marks Distribution</CardTitle></CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {Object.entries(selectedIqAnalysis.analysisData.marksDistribution as Record<string, number>)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([marks, count]) => (
                                      <div key={marks} className="flex items-center justify-between text-sm">
                                        <span>{marks} marks</span>
                                        <Badge variant="outline">{count} questions</Badge>
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          {selectedIqAnalysis.analysisData.yearDistribution && Object.keys(selectedIqAnalysis.analysisData.yearDistribution).length > 0 && (
                            <Card>
                              <CardHeader><CardTitle>Year Distribution</CardTitle></CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {Object.entries(selectedIqAnalysis.analysisData.yearDistribution as Record<string, number>)
                                    .sort(([a], [b]) => parseInt(b) - parseInt(a))
                                    .map(([year, count]) => (
                                      <div key={year} className="flex items-center justify-between text-sm">
                                        <span>{year}</span>
                                        <Badge variant="outline">{count} questions</Badge>
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Limitations */}
                      <Card className="border-destructive/20 bg-destructive/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-destructive">
                              <p className="font-medium mb-1">Analysis Limitations</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Exact repeats detected by text normalization; semantic similarity requires embeddings</li>
                                <li>Priority ranking based on frequency, recency, marks, and paper coverage - not a guarantee of future questions</li>
                                <li>Analysis limited to {selectedIqAnalysis.totalQuestions} questions from {selectedIqAnalysis.paperIds.length} papers</li>
                                <li>Questions with missing metadata (marks, year, unit) may affect accuracy</li>
                                <li>AI-generated practice papers are for practice only, not actual exam predictions</li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* PRACTICE PAPERS TAB */}
              <TabsContent value="practice" className="mt-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Generated Practice Papers</h2>
                    <p className="text-sm text-muted-foreground">AI-generated practice papers based on historical analysis</p>
                  </div>
                  <Button onClick={() => {
                    setGeneratePracticeForm(prev => ({ ...prev, sourceAnalysisId: selectedIqAnalysis?.id || '' }))
                    setShowGeneratePractice(true)
                  }} disabled={questionAnalyses.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Practice Paper
                  </Button>
                </div>

                {showGeneratePractice && (
                  <Card className="border-primary/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Generate Practice Paper
                      </CardTitle>
                      <CardDescription>
                        Create practice papers from analysis results. All questions are AI-generated and clearly labeled as practice material.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          generatePracticeMutation.mutate({
                            ...generatePracticeForm,
                            durationMinutes: generatePracticeForm.durationMinutes ? parseInt(generatePracticeForm.durationMinutes) : undefined,
                          })
                        }}
                        className="space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              placeholder="e.g., Physics Practice Paper - Mechanics"
                              value={generatePracticeForm.title}
                              onChange={e => setGeneratePracticeForm(prev => ({ ...prev, title: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Paper Type</Label>
                            <Select value={generatePracticeForm.paperType} onValueChange={v => setGeneratePracticeForm(prev => ({ ...prev, paperType: v as any }))}>
                              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRACTICE">Practice Questions</SelectItem>
                                <SelectItem value="MOCK">Mock Examination</SelectItem>
                                <SelectItem value="PREDICTED">Predicted Paper (Based on Patterns)</SelectItem>
                                <SelectItem value="UNIT_WISE">Unit-wise Practice</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Source Analysis</Label>
                            <Select value={generatePracticeForm.sourceAnalysisId} onValueChange={v => setGeneratePracticeForm(prev => ({ ...prev, sourceAnalysisId: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select analysis (optional)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">No specific analysis (general)</SelectItem>
                                {questionAnalyses.map((a: QuestionAnalysis) => (
                                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Select value={generatePracticeForm.subjectId} onValueChange={v => setGeneratePracticeForm(prev => ({ ...prev, subjectId: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select subject (optional)" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">General</SelectItem>
                                {(allUserDocuments?.documents || []).map((doc: any) => (
                                  <SelectItem key={doc.id} value={doc.id}>{doc.title} ({doc.documentType})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Unit (for unit-wise)</Label>
                            <Input
                              placeholder="e.g., Unit 1: Mechanics"
                              value={generatePracticeForm.unit}
                              onChange={e => setGeneratePracticeForm(prev => ({ ...prev, unit: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Question Count</Label>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              value={generatePracticeForm.questionCount}
                              onChange={e => setGeneratePracticeForm(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 10 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total Marks</Label>
                            <Input
                              type="number"
                              min="1"
                              value={generatePracticeForm.totalMarks}
                              onChange={e => setGeneratePracticeForm(prev => ({ ...prev, totalMarks: parseInt(e.target.value) || 100 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Duration (minutes, optional)</Label>
                            <Input
                              type="number"
                              placeholder="e.g., 180"
                              value={generatePracticeForm.durationMinutes}
                              onChange={e => setGeneratePracticeForm(prev => ({ ...prev, durationMinutes: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Target Difficulty</Label>
                            <Select value={generatePracticeForm.difficulty} onValueChange={v => setGeneratePracticeForm(prev => ({ ...prev, difficulty: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EASY">Easy</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="HARD">Hard</SelectItem>
                                <SelectItem value="MIXED">Mixed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Question Types (optional)</Label>
                            <div className="flex flex-wrap gap-2">
                              {['MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL', 'DERIVATION', 'DIAGRAM'].map(type => (
                                <label key={type} className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={generatePracticeForm.questionTypes.includes(type)}
                                    onChange={(e) =>
                                      setGeneratePracticeForm(prev => ({
                                        ...prev,
                                        questionTypes: e.target.checked
                                          ? [...prev.questionTypes, type]
                                          : prev.questionTypes.filter(t => t !== type),
                                      }))
                                    }
                                    className="h-4 w-4 rounded border-primary"
                                  />
                                  <span className="text-sm">{type}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                          <Button type="submit" disabled={generatingPractice}>
                            {generatingPractice ? "Generating..." : "Generate Practice Paper"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setShowGeneratePractice(false)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Note: In a full implementation, you'd fetch and display generated practice papers here */}
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                      Generated practice papers would appear here. 
                      <br />
                      The practice paper generation API creates papers saved to the database.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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