"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"
import {
  Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, ChevronRight, ChevronLeft, Settings, Search, FlaskConical, HelpCircle, Link, Trash2, Link2, ListMinus, Filter, Trophy, Archive, ChevronDown, Upload, CheckCircle2 as CheckCircleIcon, Loader2, X, Paperclip, Eye, Download as DownloadIcon, FilePlus, FileMinus, Settings2, BarChart3, ClipboardList, Lightbulb, Flag, Star, Layers, ArrowRight, ArrowLeft, MoreHorizontal, RefreshCw, AlertTriangle, Info,
} from "lucide-react"
import { EmptyState, LoadingState } from "@/components/ui/empty-state"

// Types
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

interface Subject {
  id: string
  name: string
  code: string
  semester: string | null
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
  source?: string
}

interface UploadedFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'extracting' | 'completed' | 'error'
  message: string
  paperId?: string
  extractedCount?: number
  progress?: number
}

interface AnalysisProgress {
  stage: string
  progress: number
  message: string
}

interface RepeatedQuestionGroup {
  id: string
  representativeQuestion: string
  count: number
  questionIds: string[]
  paperIds: string[]
  years: number[]
  marks: number[]
  similarityType: 'exact' | 'semantic'
  concept: string
}

interface FileMetadata {
  title?: string
  paperType?: 'QB' | 'PYQ'
  examinationYear?: string
  marks?: string
  unit?: string
}

export function ImportantQuestionsNewTab({
  questionPapers,
  questionAnalyses,
  iqSubjects,
}: {
  questionPapers: QuestionPaper[]
  questionAnalyses: QuestionAnalysis[]
  iqSubjects: Subject[]
}) {
  const queryClient = useQueryClient()

  // View state: 'upload' | 'analyze' | 'results'
  const [view, setView] = React.useState<'upload' | 'analyze' | 'results'>('upload')

  // Upload state
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  const [paperType, setPaperType] = React.useState<'QB' | 'PYQ' | 'MIXED'>('MIXED')
  const [examinationYear, setExaminationYear] = React.useState("")
  const [totalMarks, setTotalMarks] = React.useState("")
  const [additionalInstructions, setAdditionalInstructions] = React.useState("")
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const [readyPapers, setReadyPapers] = React.useState<QuestionPaper[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Per-file metadata overrides
  const [fileMetadata, setFileMetadata] = React.useState<Record<string, FileMetadata>>({})

  // Analysis state
  const [analysisTitle, setAnalysisTitle] = React.useState("")
  const [enableWebResearch, setEnableWebResearch] = React.useState(true)
  const [generatingAnalysis, setGeneratingAnalysis] = React.useState(false)
  const [generationProgress, setGenerationProgress] = React.useState<AnalysisProgress | null>(null)
  const [generationError, setGenerationError] = React.useState<string | null>(null)
  const [analyses, setAnalyses] = React.useState<QuestionAnalysis[]>(questionAnalyses)
  const [selectedAnalysis, setSelectedAnalysis] = React.useState<QuestionAnalysis | null>(null)

  // PDF state
  const [downloadingPDF, setDownloadingPDF] = React.useState(false)

  // Subject selection
  const [subjectId, setSubjectId] = React.useState("")
  const [semester, setSemester] = React.useState("")
  const [academicYear, setAcademicYear] = React.useState("")
  const [unit, setUnit] = React.useState("")

  // Sync with prop changes
  React.useEffect(() => {
    setAnalyses(questionAnalyses)
  }, [questionAnalyses])

  // Subject selection
  const handleSubjectSelect = (id: string) => {
    setSubjectId(id)
    const subject = iqSubjects.find(s => s.id === id)
    if (subject?.semester) setSemester(subject.semester)
  }

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    addFiles(files)
    if (e.target) e.target.value = ''
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const addFiles = (files: File[]) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'text/markdown']
    const validFiles = files.filter(f => validTypes.includes(f.type))
    const invalidFiles = files.filter(f => !validTypes.includes(f.type))

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `${invalidFiles.length} file(s) were skipped. Only PDF, DOCX, DOC, TXT, and MD files are supported.`,
        variant: 'destructive'
      })
    }

    const newFiles = validFiles.map(f => ({
      file: f,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending' as const,
      message: 'Ready to upload'
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAllFiles = () => {
    setUploadedFiles([])
    setReadyPapers([])
    setFileMetadata({})
  }

  const updateFileMetadata = (fileId: string, metadata: Partial<FileMetadata>) => {
    setFileMetadata(prev => ({
      ...prev,
      [fileId]: { ...prev[fileId], ...metadata }
    }))
  }

  const getFileMetadata = (fileId: string): FileMetadata => {
    return fileMetadata[fileId] || {}
  }

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) return
    if (!subjectId) {
      toast({ title: "Please select a subject first", variant: 'destructive' })
      return
    }

    setUploadingFiles(true)

    try {
      const pendingFiles = uploadedFiles.filter(f => f.status === 'pending' || f.status === 'error')

      for (let i = 0; i < pendingFiles.length; i++) {
        const fileItem = pendingFiles[i]
        const metadata = getFileMetadata(fileItem.id)

        setUploadedFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: 'uploading', message: 'Uploading...' } : f
        ))

        const singleFormData = new FormData()
        singleFormData.append('files', fileItem.file)
        singleFormData.append('title', metadata.title || fileItem.file.name.replace(/\.[^/.]+$/, ""))
        singleFormData.append('paperType', metadata.paperType || paperType)
        singleFormData.append('subjectId', subjectId)
        if (semester) singleFormData.append('semester', semester)
        if (academicYear) singleFormData.append('academicYear', academicYear)
        if (metadata.examinationYear) singleFormData.append('examinationYear', metadata.examinationYear)
        else if (examinationYear) singleFormData.append('examinationYear', examinationYear)
        if (metadata.marks) singleFormData.append('marks', metadata.marks)
        else if (totalMarks) singleFormData.append('marks', totalMarks)
        if (metadata.unit) singleFormData.append('unit', metadata.unit)
        else if (unit) singleFormData.append('unit', unit)
        if (additionalInstructions) singleFormData.append('additionalInstructions', additionalInstructions)

        try {
          const res = await fetch('/api/study-studio/important-questions/upload', {
            method: 'POST',
            body: singleFormData,
          })

          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Upload failed')
          }

          const data = await res.json()
          const paper = data.papers?.[0] || data.results?.find((r: any) => r.uploadStatus === 'success')

          if (paper) {
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileItem.id
                ? { ...f, status: 'completed', message: 'Uploaded successfully', paperId: paper.id }
                : f
            ))
          } else {
            throw new Error('No paper returned from server')
          }
        } catch (err) {
          setUploadedFiles(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, status: 'error', message: err instanceof Error ? err.message : 'Upload failed' }
              : f
          ))
        }
      }

      // Refresh papers list
      queryClient.invalidateQueries({ queryKey: ["question-papers"] })

      // Get uploaded papers with questions
      const papersRes = await fetch('/api/study-studio/important-questions/papers')
      if (papersRes.ok) {
        const papersData = await papersRes.json()
        const uploadedPaperIds = uploadedFiles.filter(f => f.status === 'completed').map(f => f.paperId).filter(Boolean)
        const newReadyPapers = papersData.papers.filter((p: QuestionPaper) => uploadedPaperIds.includes(p.id))
        setReadyPapers(prev => [...prev, ...newReadyPapers])

        if (newReadyPapers.length > 0) {
          toast({ title: `${newReadyPapers.length} paper(s) uploaded`, description: "Ready for question extraction" })
        }
      }

    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleExtractQuestions = async (paperId: string, fileIndex: number) => {
    setUploadedFiles(prev => prev.map((f, i) =>
      i === fileIndex ? { ...f, status: 'extracting', message: 'Extracting questions...', progress: 0 } : f
    ))

    try {
      const res = await fetch(`/api/study-studio/important-questions/papers/${paperId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract' }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Extraction failed')
      }

      const data = await res.json()

      setUploadedFiles(prev => prev.map((f, i) =>
        i === fileIndex
          ? { ...f, status: 'completed', message: `Extracted ${data.extractedCount} questions`, extractedCount: data.extractedCount, progress: 100 }
          : f
      ))

      // Refresh papers
      queryClient.invalidateQueries({ queryKey: ["question-papers"] })

      // Update ready papers with question count
      const papersRes = await fetch('/api/study-studio/important-questions/papers')
      if (papersRes.ok) {
        const papersData = await papersRes.json()
        const updatedPaper = papersData.papers.find((p: QuestionPaper) => p.id === paperId)
        if (updatedPaper) {
          setReadyPapers(prev => prev.map(p => p.id === paperId ? updatedPaper : p))
        }
      }

      toast({ title: "Extraction complete", description: `Found ${data.extractedCount} questions` })
    } catch (err) {
      setUploadedFiles(prev => prev.map((f, i) =>
        i === fileIndex
          ? { ...f, status: 'error', message: err instanceof Error ? err.message : 'Extraction failed' }
          : f
      ))
      toast({ title: "Extraction failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  const handleExtractAll = async () => {
    const pendingExtractions = readyPapers.filter(p => !p._count?.questions || p._count.questions === 0)
    if (pendingExtractions.length === 0) return

    for (let i = 0; i < pendingExtractions.length; i++) {
      const paper = pendingExtractions[i]
      const fileIdx = uploadedFiles.findIndex(f => f.paperId === paper.id)
      if (fileIdx >= 0) {
        await handleExtractQuestions(paper.id, fileIdx)
      }
    }
  }

  const handleRetryUpload = async (fileIndex: number) => {
    const fileItem = uploadedFiles[fileIndex]
    if (fileItem.status !== 'error') return

    setUploadedFiles(prev => prev.map((f, i) =>
      i === fileIndex ? { ...f, status: 'pending', message: 'Retrying...' } : f
    ))

    await handleUploadFiles()
  }

  const handleProceedToAnalyze = () => {
    const papersWithQuestions = readyPapers.filter(p => p._count?.questions && p._count.questions > 0)
    if (papersWithQuestions.length > 0) {
      setView('analyze')
      if (!analysisTitle) {
        const subject = iqSubjects.find(s => s.id === subjectId)
        setAnalysisTitle(`${subject?.name || 'Subject'} Important Questions ${new Date().getFullYear()}`)
      }
    } else {
      toast({ title: "No papers with questions", description: "Please extract questions from uploaded papers first", variant: 'destructive' })
    }
  }

  // Analysis generation
  const handleGenerateAnalysis = async () => {
    if (readyPapers.length === 0) return

    const papersWithQuestions = readyPapers.filter(p => p._count?.questions && p._count.questions > 0)
    if (papersWithQuestions.length === 0) {
      toast({ title: "No questions to analyze", description: "Please extract questions from papers first", variant: 'destructive' })
      return
    }

    setGeneratingAnalysis(true)
    setGenerationError(null)
    setGenerationProgress({ stage: 'Analyzing papers...', progress: 10, message: 'Starting AI analysis' })

    try {
      const paperIds = papersWithQuestions.map(p => p.id)
      const subject = iqSubjects.find(s => s.id === subjectId)

      const res = await fetch('/api/study-studio/important-questions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds,
          subjectId: subjectId || undefined,
          title: analysisTitle,
          enableWebResearch: enableWebResearch,
          subjectName: subject?.name,
          semester: semester || undefined,
          academicYear: academicYear || undefined,
          additionalInstructions: additionalInstructions || undefined,
        }),
      })

      setGenerationProgress({ stage: 'Processing results...', progress: 80, message: 'Finalizing analysis' })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }

      const data = await res.json()
      const newAnalysis = data.analysis

      setAnalyses(prev => [newAnalysis, ...prev])
      setSelectedAnalysis(newAnalysis)
      setView('results')

      toast({ title: "Analysis complete", description: "Important questions report generated successfully" })
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Analysis failed')
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setGeneratingAnalysis(false)
      setGenerationProgress(null)
    }
  }

  const handleSelectAnalysis = (analysis: QuestionAnalysis) => {
    setSelectedAnalysis(analysis)
    setView('results')
  }

  const deleteAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/study-studio/important-questions/analyses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setAnalyses(prev => prev.filter(a => a.id !== id))
      if (selectedAnalysis?.id === id) setSelectedAnalysis(null)
      toast({ title: "Analysis deleted" })
    } catch {
      toast({ title: "Error", description: "Failed to delete analysis", variant: 'destructive' })
    }
  }

  // PDF Download
  const handleDownloadPDF = async () => {
    if (!selectedAnalysis) return

    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/study-studio/important-questions/analyses/${selectedAnalysis.id}/export`)
      if (!res.ok) throw new Error('PDF generation failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `important-questions-${selectedAnalysis.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({ title: "PDF downloaded", description: "Report saved to your downloads" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to download PDF", variant: 'destructive' })
    } finally {
      setDownloadingPDF(false)
    }
  }

  // Helper functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return FileText
    if (mimeType.includes('word') || mimeType.includes('document')) return FileText
    if (mimeType === 'text/plain') return FileText
    if (mimeType === 'text/markdown') return FileText
    return FileText
  }

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-600'
      case 'uploading':
      case 'extracting': return 'bg-blue-100 text-blue-600'
      case 'error': return 'bg-red-100 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-4 w-4" />
      case 'uploading':
      case 'extracting': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const canProceedToAnalyze = readyPapers.some(p => p._count?.questions && p._count.questions > 0)

  // Derived data for results view
  const analysisData = selectedAnalysis?.analysisData || {}
  const repeatedGroups = (analysisData.repeatedQuestionGroups as RepeatedQuestionGroup[] | undefined) || []
  const priorityItems = selectedAnalysis?.priorityItems || []
  const highPriority = priorityItems.filter(p => p.priority === 'HIGH')
  const mediumPriority = priorityItems.filter(p => p.priority === 'MEDIUM')
  const lowPriority = priorityItems.filter(p => p.priority === 'LOW')

  // Render
  return (
    <div className="space-y-6">
      {/* View indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Badge variant={view === 'upload' ? 'default' : 'outline'}>1. Upload Papers</Badge>
        <ChevronRight className="h-3 w-3" />
        <Badge variant={view === 'analyze' ? 'default' : 'outline'}>2. Configure Analysis</Badge>
        <ChevronRight className="h-3 w-3" />
        <Badge variant={view === 'results' ? 'default' : 'outline'}>3. Results & Export</Badge>
      </div>

      {/* STEP 1: UPLOAD PAPERS */}
      {view === 'upload' && (
        <div className="space-y-6">
          {/* Subject Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Select Subject
              </CardTitle>
              <CardDescription>
                Choose the subject for your question paper analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Subject <span className="text-red-500">*</span></Label>
                <Select value={subjectId} onValueChange={handleSubjectSelect}>
                  <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
                  <SelectContent>
                    {iqSubjects.map((subj: Subject) => (
                      <SelectItem key={subj.id} value={subj.id}>
                        {subj.code} - {subj.name} {subj.semester && `(${subj.semester})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {iqSubjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subjects found. Please contact your lecturer to create subjects.</p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Input placeholder="e.g., Semester 3" value={semester} onChange={e => setSemester(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input placeholder="e.g., 2023-2024" value={academicYear} onChange={e => setAcademicYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Input placeholder="e.g., Unit 1" value={unit} onChange={e => setUnit(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setView('analyze')}
                  disabled={!subjectId}
                >
                  Next: Upload Papers <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: UPLOAD & CONFIGURE ANALYSIS */}
      {view === 'analyze' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Question Papers
                  </CardTitle>
                  <CardDescription>
                    Drag & drop or browse to upload multiple question banks and previous year papers
                  </CardDescription>
                </div>
                <Badge variant={paperType === 'MIXED' ? 'default' : 'outline'} className="text-sm">
                  Default: {paperType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drop Zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleFileDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="iq-file-input"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">Drag & drop files here, or</p>
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
                    Supported: PDF, DOCX, DOC, TXT, MD • Max 50MB each • Multiple files allowed
                  </p>
                </div>
              </div>

              {/* Global Settings */}
              <div className="grid gap-4 md:grid-cols-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Default Paper Type</Label>
                  <Select value={paperType} onValueChange={v => setPaperType(v as 'QB' | 'PYQ' | 'MIXED')}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIXED">Mixed (per-file)</SelectItem>
                      <SelectItem value="QB">Question Bank (QB)</SelectItem>
                      <SelectItem value="PYQ">Previous Year (PYQ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Exam Year (PYQ)</Label>
                  <Input type="number" placeholder="e.g., 2023" value={examinationYear} onChange={e => setExaminationYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Default Total Marks</Label>
                  <Input type="number" placeholder="e.g., 100" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Default Unit</Label>
                  <Input placeholder="e.g., Unit 1" value={unit} onChange={e => setUnit(e.target.value)} />
                </div>
              </div>

              {/* Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Files Ready ({uploadedFiles.length})</h4>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={clearAllFiles} disabled={uploadingFiles}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All
                      </Button>
                      <Button
                        onClick={handleUploadFiles}
                        disabled={uploadingFiles || uploadedFiles.every(f => f.status === 'completed' || f.status === 'uploading')}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {uploadingFiles ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload All
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {uploadedFiles.map((fileItem, idx) => (
                        <Card key={fileItem.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", getStatusColor(fileItem.status))}>
                                {getStatusIcon(fileItem.status)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <div>
                                      <p className="font-medium text-sm truncate">{fileItem.file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatFileSize(fileItem.file.size)} • {fileItem.file.type || 'Unknown'}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive flex-shrink-0"
                                    onClick={() => removeFile(idx)}
                                    disabled={fileItem.status === 'uploading' || fileItem.status === 'extracting'}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Status & Progress */}
                                <div className="mt-2 flex items-center gap-3">
                                  <Badge variant={fileItem.status === 'completed' ? 'default' : fileItem.status === 'error' ? 'destructive' : 'outline'}>
                                    {fileItem.status === 'completed' ? 'Uploaded' : fileItem.status === 'uploading' ? 'Uploading...' : fileItem.status === 'extracting' ? 'Extracting...' : fileItem.status === 'error' ? 'Failed' : 'Pending'}
                                  </Badge>
                                  {fileItem.progress !== undefined && fileItem.progress > 0 && fileItem.progress < 100 && (
                                    <div className="flex-1 max-w-xs">
                                      <Progress value={fileItem.progress} className="h-1.5" />
                                    </div>
                                  )}
                                  {fileItem.extractedCount !== undefined && (
                                    <Badge variant="secondary">{fileItem.extractedCount} questions</Badge>
                                  )}
                                </div>

                                {/* Status Message */}
                                <p className="mt-1 text-xs text-muted-foreground">{fileItem.message}</p>

                                {/* Per-file metadata override */}
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  <div className="grid gap-2 md:grid-cols-4">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Title</Label>
                                      <Input
                                        size="sm"
                                        placeholder="Auto from filename"
                                        value={getFileMetadata(fileItem.id).title || ''}
                                        onChange={e => updateFileMetadata(fileItem.id, { title: e.target.value })}
                                        disabled={fileItem.status === 'uploading' || fileItem.status === 'extracting'}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Type</Label>
                                      <Select
                                        value={getFileMetadata(fileItem.id).paperType || paperType}
                                        onValueChange={v => updateFileMetadata(fileItem.id, { paperType: v as 'QB' | 'PYQ' })}
                                        disabled={fileItem.status === 'uploading' || fileItem.status === 'extracting'}
                                      >
                                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="QB">QB</SelectItem>
                                          <SelectItem value="PYQ">PYQ</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Exam Year</Label>
                                      <Input
                                        size="sm"
                                        type="number"
                                        placeholder="2023"
                                        value={getFileMetadata(fileItem.id).examinationYear || ''}
                                        onChange={e => updateFileMetadata(fileItem.id, { examinationYear: e.target.value })}
                                        disabled={fileItem.status === 'uploading' || fileItem.status === 'extracting'}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Marks</Label>
                                      <Input
                                        size="sm"
                                        type="number"
                                        placeholder="100"
                                        value={getFileMetadata(fileItem.id).marks || ''}
                                        onChange={e => updateFileMetadata(fileItem.id, { marks: e.target.value })}
                                        disabled={fileItem.status === 'uploading' || fileItem.status === 'extracting'}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Action buttons for completed/error files */}
                                {(fileItem.status === 'completed' || fileItem.status === 'error') && fileItem.paperId && (
                                  <div className="mt-3 pt-3 border-t flex items-center gap-2">
                                    {fileItem.status === 'completed' && !fileItem.extractedCount && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleExtractQuestions(fileItem.paperId!, idx)}
                                        disabled={uploadingFiles}
                                      >
                                        <Brain className="mr-2 h-4 w-4" />
                                        Extract Questions
                                      </Button>
                                    )}
                                    {fileItem.status === 'error' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRetryUpload(idx)}
                                      >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Retry
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Uploaded Papers with Questions */}
              {readyPapers.length > 0 && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-5 w-5" />
                      Papers Ready for Analysis ({readyPapers.filter(p => p._count?.questions).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {readyPapers.map((paper: QuestionPaper) => (
                        <div key={paper.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">{paper.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {paper.paperType} • {paper._count?.questions || 0} questions extracted
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(paper._count?.questions || 0) === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const idx = uploadedFiles.findIndex(f => f.paperId === paper.id)
                                  if (idx >= 0) handleExtractQuestions(paper.id, idx)
                                }}
                              >
                                <Brain className="mr-2 h-4 w-4" />
                                Extract
                              </Button>
                            )}
                            {paper._count?.questions && (
                              <Badge variant="outline" className="text-xs">
                                {paper._count.questions} questions
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(readyPapers.some(p => (p._count?.questions || 0) === 0)) && (
                      <Button
                        className="mt-4 w-full"
                        variant="outline"
                        onClick={handleExtractAll}
                        disabled={uploadingFiles}
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        Extract Questions from All Papers
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Additional Instructions */}
              <div className="pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <span>Additional Instructions (Optional)</span>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Label>
                <Textarea
                  placeholder="Guide the AI analysis with specific instructions. Examples:
• Find the most repeated questions across papers
• Identify important questions for the upcoming examination
• Prioritize 10-mark and 15-mark questions
• Focus on Unit 3 and Unit 4
• Identify questions repeated across multiple years
• Identify important concepts even if they haven't appeared frequently
• Generate a study priority list
• Tell me what I should study first
• Identify questions that changed wording but test the same concept"
                  value={additionalInstructions}
                  onChange={e => setAdditionalInstructions(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These instructions will directly influence the AI analysis and priority ranking.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleProceedToAnalyze}
                  disabled={!canProceedToAnalyze}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Proceed to Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Previous Analyses */}
          {analyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Analyses ({analyses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyses.map((analysis: QuestionAnalysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/40 cursor-pointer"
                      onClick={() => handleSelectAnalysis(analysis)}>
                    <div>
                      <p className="font-medium">{analysis.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {analysis.totalQuestions} questions • {analysis.paperIds.length} papers •
                        {analysis.exactRepeats} exact repeats • {analysis.priorityItems?.filter((p: any) => p.priority === 'HIGH').length || 0} high priority
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteAnalysis(analysis.id) }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* STEP 3: ANALYSIS CONFIGURATION & GENERATION */}
      {view === 'analyze' && readyPapers.length > 0 && canProceedToAnalyze && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Configure Analysis
              </CardTitle>
              <CardDescription>
                Review your papers and configure the AI analysis settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Papers Summary */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-3">Papers to Analyze ({readyPapers.filter(p => p._count?.questions).length})</h4>
                <div className="space-y-2">
                  {readyPapers.filter(p => p._count?.questions).map((paper: QuestionPaper) => (
                    <div key={paper.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{paper.title}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{paper.paperType}</Badge>
                        <Badge variant="outline" className="text-xs">{paper._count?.questions || 0} questions</Badge>
                        {paper.examinationYear && <Badge variant="secondary" className="text-xs">{paper.examinationYear}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analysis Options */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Analysis Title</Label>
                  <Input placeholder="e.g., Physics Important Questions 2020-2024" value={analysisTitle} onChange={e => setAnalysisTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Enable Web Research</Label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="iq-web-research" checked={enableWebResearch} onChange={e => setEnableWebResearch(e.target.checked)} />
                    <Label htmlFor="iq-web-research" className="text-sm cursor-pointer">
                      Search online syllabi, textbooks, and academic sources for additional concepts
                    </Label>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setView('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleGenerateAnalysis}
                  disabled={generatingAnalysis || !canProceedToAnalyze}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {generatingAnalysis ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Papers...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Important Questions Report
                    </>
                  )}
                </Button>
              </div>

              {/* Generation Progress */}
              {generatingAnalysis && generationProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{generationProgress.stage}</span>
                    <span className="text-sm text-muted-foreground">{generationProgress.progress}%</span>
                  </div>
                  <Progress value={generationProgress.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{generationProgress.message}</p>
                </div>
              )}

              {/* Generation Error */}
              {generationError && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Analysis Failed</p>
                        <p className="text-sm text-destructive">{generationError}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 4: RESULTS & PDF */}
      {view === 'results' && selectedAnalysis ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Important Questions Report
                  </CardTitle>
                  <CardDescription>{selectedAnalysis.title}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadPDF}
                    disabled={downloadingPDF}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {downloadingPDF ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedAnalysis(null); setView('upload'); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    New Analysis
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{selectedAnalysis.totalQuestions}</p>
                  <p className="text-sm text-muted-foreground">Total Questions</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{selectedAnalysis.exactRepeats}</p>
                  <p className="text-sm text-muted-foreground">Exact Repeats</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-orange-500">{selectedAnalysis.semanticRepeats}</p>
                  <p className="text-sm text-muted-foreground">Semantic Similarities</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-500">{highPriority.length}</p>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                </div>
              </div>

              {/* Tabs for different result views */}
              <Tabs defaultValue="high-priority" className="w-full">
                <TabsList className="flex w-full overflow-x-auto gap-1 pb-2" style={{ scrollbarWidth: 'none' }}>
                  <TabsTrigger value="high-priority" className="whitespace-nowrap">
                    <Flag className="mr-2 h-4 w-4" /> High Priority ({highPriority.length})
                  </TabsTrigger>
                  <TabsTrigger value="medium-priority" className="whitespace-nowrap">
                    <Star className="mr-2 h-4 w-4" /> Medium Priority ({mediumPriority.length})
                  </TabsTrigger>
                  <TabsTrigger value="low-priority" className="whitespace-nowrap">
                    <Layers className="mr-2 h-4 w-4" /> Low Priority ({lowPriority.length})
                  </TabsTrigger>
                  <TabsTrigger value="repeated" className="whitespace-nowrap">
                    <Copy className="mr-2 h-4 w-4" /> Repeated Questions
                  </TabsTrigger>
                  <TabsTrigger value="unit-wise" className="whitespace-nowrap">
                    <BookOpen className="mr-2 h-4 w-4" /> Unit-wise
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="whitespace-nowrap">
                    <Lightbulb className="mr-2 h-4 w-4" /> Study Plan
                  </TabsTrigger>
                </TabsList>

                {/* HIGH PRIORITY */}
                <TabsContent value="high-priority" className="mt-4 space-y-4">
                  {highPriority.length === 0 ? (
                    <EmptyState
                      icon={Flag}
                      title="No high-priority questions"
                      description="The analysis did not identify any high-priority questions based on the current papers."
                    />
                  ) : (
                    <div className="space-y-4">
                      {highPriority.map((item, index) => (
                        <Card key={item.id} className="border-red-200 bg-red-50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <Flag className="h-4 w-4 text-red-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm text-red-700">HIGH PRIORITY #{index + 1}</span>
                                  {item.isExactRepeat && (
                                    <Badge variant="destructive" className="text-xs">EXACT REPEAT</Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-medium">{item.questionText || item.concept}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {item.frequency > 1 && <Badge variant="outline">Frequency: {item.frequency}</Badge>}
                                  {item.papersCount > 1 && <Badge variant="outline">Papers: {item.papersCount}</Badge>}
                                  {item.avgMarks && item.avgMarks > 0 && <Badge variant="outline">Avg Marks: {item.avgMarks.toFixed(1)}</Badge>}
                                  {item.lastYear && <Badge variant="outline">Last seen: {item.lastYear}</Badge>}
                                  {item.units.length && <Badge variant="outline">Units: {item.units.slice(0, 2).join(', ')}</Badge>}
                                  {item.topics.length && <Badge variant="outline">Topics: {item.topics.slice(0, 2).join(', ')}</Badge>}
                                  {item.source === 'ai_enhanced' && <Badge variant="secondary">AI Enhanced</Badge>}
                                  {item.source === 'web_research' && <Badge variant="secondary">Web Research</Badge>}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground italic">Reason: {item.reason}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* MEDIUM PRIORITY */}
                <TabsContent value="medium-priority" className="mt-4 space-y-4">
                  {mediumPriority.length === 0 ? (
                    <EmptyState
                      icon={Star}
                      title="No medium-priority questions"
                      description="The analysis did not identify any medium-priority questions."
                    />
                  ) : (
                    <div className="space-y-3">
                      {mediumPriority.map((item, index) => (
                        <Card key={item.id} className="border-orange-200 bg-orange-50">
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                                <Star className="h-3 w-3 text-orange-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm text-orange-700">MEDIUM PRIORITY #{index + 1}</span>
                                  {item.isExactRepeat && (
                                    <Badge variant="destructive" className="text-xs">EXACT REPEAT</Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-sm">{item.questionText || item.concept}</p>
                                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {item.frequency > 1 && <Badge variant="outline">Freq: {item.frequency}</Badge>}
                                  {item.papersCount > 1 && <Badge variant="outline">Papers: {item.papersCount}</Badge>}
                                  {item.avgMarks && item.avgMarks > 0 && <Badge variant="outline">Avg: {item.avgMarks.toFixed(1)}</Badge>}
                                  {item.units.length && <Badge variant="outline">{item.units[0]}</Badge>}
                                  {item.source === 'ai_enhanced' && <Badge variant="secondary">AI Enhanced</Badge>}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground italic">{item.reason}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* LOW PRIORITY */}
                <TabsContent value="low-priority" className="mt-4 space-y-3">
                  {lowPriority.length === 0 ? (
                    <EmptyState
                      icon={Layers}
                      title="No low-priority questions"
                      description="All identified questions have at least medium priority."
                    />
                  ) : (
                    <div className="space-y-2">
                      {lowPriority.map((item, index) => (
                        <Card key={item.id} className="border-gray-200 bg-gray-50">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                                <p className="text-sm text-gray-700">{item.questionText || item.concept}</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                {item.frequency > 1 && <Badge variant="outline">Freq: {item.frequency}</Badge>}
                                {item.units.length && <Badge variant="outline">{item.units[0]}</Badge>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* REPEATED QUESTIONS */}
                <TabsContent value="repeated" className="mt-4 space-y-4">
                  {(repeatedGroups.length === 0 && selectedAnalysis.exactRepeats === 0 && selectedAnalysis.semanticRepeats === 0) ? (
                    <EmptyState
                      icon={Copy}
                      title="No repeated questions found"
                      description="The analyzed papers don't contain identical or semantically similar questions."
                    />
                  ) : (
                    <div className="space-y-6">
                      {/* Exact Repeats */}
                      {repeatedGroups.filter(g => g.similarityType === 'exact').length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">Exact Repeats</Badge>
                            <span className="text-sm text-muted-foreground">({repeatedGroups.filter(g => g.similarityType === 'exact').length} groups)</span>
                          </h4>
                          {repeatedGroups.filter(g => g.similarityType === 'exact').map((group, index) => (
                            <Card key={group.id} className="border-red-100">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Group #{index + 1} • {group.count} occurrences</span>
                                  <Badge variant="destructive" className="text-xs">{group.paperIds.length} papers</Badge>
                                </div>
                                <p className="text-sm mb-2">{group.representativeQuestion}</p>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {group.years.length > 0 && <Badge variant="outline">Years: {group.years.sort((a,b)=>a-b).join(', ')}</Badge>}
                                  {group.marks.length > 0 && <Badge variant="outline">Marks: {group.marks.join(', ')}</Badge>}
                                  <Badge variant="outline">{group.concept}</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Semantic Repeats */}
                      {repeatedGroups.filter(g => g.similarityType === 'semantic').length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="font-medium flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Semantic Similarities</Badge>
                            <span className="text-sm text-muted-foreground">({repeatedGroups.filter(g => g.similarityType === 'semantic').length} groups)</span>
                          </h4>
                          {repeatedGroups.filter(g => g.similarityType === 'semantic').map((group, index) => (
                            <Card key={group.id} className="border-orange-100">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Group #{index + 1} • {group.count} similar questions</span>
                                  <Badge variant="secondary" className="text-xs">{group.paperIds.length} papers</Badge>
                                </div>
                                <p className="text-sm mb-2">{group.representativeQuestion}</p>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {group.years.length > 0 && <Badge variant="outline">Years: {group.years.sort((a,b)=>a-b).join(', ')}</Badge>}
                                  {group.marks.length > 0 && <Badge variant="outline">Marks: {group.marks.join(', ')}</Badge>}
                                  <Badge variant="outline">{group.concept}</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* UNIT-WISE */}
                <TabsContent value="unit-wise" className="mt-4 space-y-4">
                  {analysisData.unitDistribution && Object.keys(analysisData.unitDistribution).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(analysisData.unitDistribution)
                        .sort(([,a], [,b]) => b - a)
                        .map(([unit, count]) => {
                          const items = priorityItems.filter(p => p.units.includes(unit))
                          const highCount = items.filter(p => p.priority === 'HIGH').length
                          return (
                            <Card key={unit}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-lg text-primary">{unit}</h4>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{count} questions</Badge>
                                    {highCount > 0 && <Badge variant="destructive">{highCount} high priority</Badge>}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {items.slice(0, 8).map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      <Badge variant={
                                        item.priority === 'HIGH' ? 'destructive' :
                                        item.priority === 'MEDIUM' ? 'secondary' : 'outline'
                                      } className="text-xs">
                                        {item.priority}
                                      </Badge>
                                      <span className="flex-1 truncate">{item.questionText || item.concept}</span>
                                      <span className="text-xs text-muted-foreground">Freq: {item.frequency}</span>
                                    </div>
                                  ))}
                                  {items.length > 8 && (
                                    <p className="text-xs text-muted-foreground">... and {items.length - 8} more questions</p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={BookOpen}
                      title="No unit distribution data"
                      description="The analyzed papers don't have unit information for the extracted questions."
                    />
                  )}
                </TabsContent>

                {/* RECOMMENDATIONS */}
                <TabsContent value="recommendations" className="mt-4 space-y-6">
                  <div className="space-y-6">
                    {/* Focus Areas */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Focus Areas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {highPriority.slice(0, 5).map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                              <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-medium">{idx + 1}</span>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.concept}</p>
                                <p className="text-xs text-muted-foreground">{item.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Unit Strategy */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          Unit-Wise Strategy
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(analysisData.unitDistribution || {})
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([unit, count]) => (
                              <div key={unit} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                <span className="font-medium">{unit}</span>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Badge variant="outline">{count} questions</Badge>
                                  <span>Allocate proportional study time</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Question Type Practice */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" />
                          Question Type Practice
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(analysisData.questionTypeDistribution || {}).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <span className="font-medium capitalize">{type.replace('_', ' ')}</span>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{count} questions</Badge>
                                <span>Practice {type.toLowerCase().replace('_', ' ')} format</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Important Notes */}
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Important Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-destructive">
                          <li>• This analysis is based on historical question papers and web research only.</li>
                          <li>• Predicted questions are for preparation guidance and do not guarantee examination content.</li>
                          <li>• Always refer to the official syllabus and recent course materials.</li>
                          <li>• Balance preparation across all syllabus topics, not just high-priority ones.</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : view === 'results' && !selectedAnalysis ? (
        <div className="space-y-6">
          <EmptyState
            icon={Trophy}
            title="No analysis selected"
            description="Select an analysis from the previous step or create a new one."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            icon={Trophy}
            title="No analysis selected"
            description="Select an analysis from the previous step or create a new one."
          />
        </div>
      )}
    </div>
  )
}