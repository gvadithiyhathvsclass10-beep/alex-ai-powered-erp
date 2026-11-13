"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"
import {
  Plus, FileText, Sparkles, Brain, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, Settings, Search, HelpCircle, Link, Trash2, ListMinus, Filter, Trophy, Archive, ChevronDown, Upload, CheckCircle2 as CheckCircleIcon, Loader2, X, Paperclip, Eye, Download as DownloadIcon, FilePlus, FileMinus, Settings2, BarChart3, ClipboardList, Lightbulb, Flag, Star, Layers, ArrowRight, ArrowLeft, MoreHorizontal, RefreshCw, AlertTriangle, Info, Send, FileQuestion, BookOpen,
} from "lucide-react"
import { EmptyState, LoadingState } from "@/components/ui/empty-state"
import { Separator } from "@/components/ui/separator"

// Error Boundary for the workspace
class WorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ImportantQuestionsWorkspace] Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error | null; resetErrorBoundary: () => void }) {
  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error?.message || 'An unexpected error occurred in the Important Questions workspace.'}
            </p>
            <Button variant="outline" className="mt-4" onClick={resetErrorBoundary}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Types matching V2 API
interface SourceDocument {
  id: string
  fileName: string
  mimeType: string
  academicYear?: string | null
  examYear?: number | null
  pageCount?: number | null
  paperType?: 'QB' | 'PYQ'
  marks?: number | null
  unit?: string | null
  semester?: string | null
}

interface QuestionOccurrence {
  id: string
  sourceDocumentId: string
  sourceFileName: string
  page?: number | null
  questionNumber?: string | null
  text: string
  normalizedText: string
  marks?: number | null
  unit?: string | null
  topic?: string | null
  concept?: string | null
  questionType?: string | null
  difficulty?: string | null
  academicYear?: string | null
  examYear?: number | null
  subQuestions?: Array<{ label: string; text: string; marks?: number }>
  extractionConfidence?: number
  flags?: string[]
}

interface RepeatGroup {
  id: string
  kind: 'EXACT' | 'SEMANTIC' | 'CONCEPT'
  canonicalQuestion: string
  occurrenceIds: string[]
  frequency: number
  confidence: number
  explanation: string
}

type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

interface RankedQuestion {
  id: string
  question: string
  priority: Priority
  score: number
  rationale: string[]
  marks?: number | null
  unit?: string | null
  topic?: string | null
  concept?: string | null
  occurrences: QuestionOccurrence[]
  repeatGroupIds: string[]
  source?: 'historical' | 'web_research' | 'fundamental' | 'ai_enhanced'
}

interface UnitCoverage {
  unit: string
  questionCount: number
  totalMarks: number
  topics: string[]
}

interface AnalysisResult {
  id: string
  title: string
  createdAt: string
  documents: SourceDocument[]
  questions: QuestionOccurrence[]
  repeatGroups: RepeatGroup[]
  rankedQuestions: RankedQuestion[]
  unitCoverage: UnitCoverage[]
  topicFrequency: Array<{ topic: string; count: number }>
  studyOrder: Array<{ rank: number; topic: string; reason: string; questionIds: string[] }>
  summary: {
    papersAnalyzed: number
    totalQuestions: number
    exactRepeatGroups: number
    semanticRepeatGroups: number
    conceptGroups: number
  }
  limitations: string[]
}

interface UploadedFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
  message: string
  documentId?: string
  progress?: number
}

interface AnalysisProgress {
  stage: string
  progress: number
  message: string
}

interface Subject {
  id: string
  name: string
  code: string
  semester: string | null
}

interface SavedAnalysis {
  id: string
  title: string
  createdAt: string
  summary: AnalysisResult['summary']
}

export function ImportantQuestionsWorkspace({
  initialDocuments = [],
  initialAnalyses = [],
  iqSubjects = [],
}: {
  initialDocuments?: SourceDocument[]
  initialAnalyses?: SavedAnalysis[]
  iqSubjects?: Subject[]
}) {
  const queryClient = useQueryClient()

  // View state: 'workspace' | 'results'
  const [view, setView] = React.useState<'workspace' | 'results'>('workspace')

  // Upload state
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  const [additionalInstructions, setAdditionalInstructions] = React.useState("")
  const [uploadingFiles, setUploadingFiles] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Analysis state
  const [analysisTitle, setAnalysisTitle] = React.useState("")
  const [generatingAnalysis, setGeneratingAnalysis] = React.useState(false)
  const [generationProgress, setGenerationProgress] = React.useState<AnalysisProgress | null>(null)
  const [generationError, setGenerationError] = React.useState<string | null>(null)
  const [analyses, setAnalyses] = React.useState<SavedAnalysis[]>(initialAnalyses)
  const [selectedAnalysis, setSelectedAnalysis] = React.useState<AnalysisResult | null>(null)

  // PDF state
  const [downloadingPDF, setDownloadingPDF] = React.useState(false)

  // Sync with prop changes
  React.useEffect(() => {
    setAnalyses(initialAnalyses)
  }, [initialAnalyses])

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
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'application/rtf',
      'application/vnd.oasis.opendocument.text'
    ]
    const validFiles = files.filter(f => validTypes.includes(f.type))
    const invalidFiles = files.filter(f => !validTypes.includes(f.type))

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `${invalidFiles.length} file(s) were skipped. Only PDF, DOCX, DOC, TXT, MD, RTF, ODT files are supported.`,
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
  }

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) return

    setUploadingFiles(true)

    try {
      const pendingFiles = uploadedFiles.filter(f => f.status === 'pending' || f.status === 'error')

      const formData = new FormData()
      pendingFiles.forEach(f => {
        formData.append('files', f.file)
      })

      const res = await fetch('/api/study-studio/important-questions-v2/documents', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || 'Upload failed')
      }

      // Update file statuses
      const uploadedDocs = data.documents || []
      let successCount = 0
      let failCount = 0

      uploadedDocs.forEach((doc: { id: string; fileName: string; status: string; error?: string }, index: number) => {
        if (index < pendingFiles.length) {
          const fileItem = pendingFiles[index]
          if (doc.status === 'uploaded') {
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileItem.id ? { ...f, status: 'completed', message: 'Uploaded successfully', documentId: doc.id } : f
            ))
            successCount++
          } else {
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileItem.id ? { ...f, status: 'error', message: doc.error || 'Upload failed' } : f
            ))
            failCount++
          }
        }
      })

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ["question-papers-v2"] })

      if (successCount > 0) {
        toast({ title: `${successCount} file(s) uploaded successfully` })
      }
      if (failCount > 0) {
        toast({ title: `${failCount} file(s) failed to upload`, variant: 'destructive' })
      }

    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleGenerateAnalysis = async () => {
    const completedFiles = uploadedFiles.filter(f => f.status === 'completed' && f.documentId)
    if (completedFiles.length === 0) {
      toast({ title: "No files to analyze", description: "Please upload at least one file first", variant: 'destructive' })
      return
    }

    setGeneratingAnalysis(true)
    setGenerationError(null)
    setGenerationProgress({ stage: 'Uploading files...', progress: 10, message: 'Starting analysis' })

    try {
      const documentIds = completedFiles.map(f => f.documentId!).filter(Boolean)
      const subject = iqSubjects.find(s => s.id === "") // No subject required

      const res = await fetch('/api/study-studio/important-questions-v2/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds,
          instructions: additionalInstructions || undefined,
          title: analysisTitle || undefined,
        }),
      })

      setGenerationProgress({ stage: 'Analyzing questions...', progress: 50, message: 'Running AI analysis' })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Analysis failed')
      }

      const data = await res.json()
      const newAnalysis = data.analysis as AnalysisResult

      setGenerationProgress({ stage: 'Finalizing...', progress: 90, message: 'Saving results' })

      // Refresh analyses list
      queryClient.invalidateQueries({ queryKey: ["question-analyses-v2"] })

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

  const handleSelectAnalysis = async (analysis: SavedAnalysis) => {
    try {
      const res = await fetch(`/api/study-studio/important-questions-v2/analyses/${analysis.id}`)
      if (!res.ok) throw new Error('Failed to fetch analysis')
      const data = await res.json()
      setSelectedAnalysis(data.analysis)
      setView('results')
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Failed to load analysis', variant: 'destructive' })
    }
  }

  const deleteAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/study-studio/important-questions-v2/analyses/${id}`, { method: 'DELETE' })
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
      const res = await fetch(`/api/study-studio/important-questions-v2/analyses/${selectedAnalysis.id}/export`)
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

  // Reset error boundary
  const resetErrorBoundary = React.useCallback(() => {
    // Force re-render by updating a key or state
    setSelectedAnalysis(null)
    setView('workspace')
  }, [])

  // Helper functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-600'
      case 'uploading': return 'bg-blue-100 text-blue-600'
      case 'error': return 'bg-red-100 text-red-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-4 w-4" />
      case 'uploading': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const hasCompletedFiles = uploadedFiles.some(f => f.status === 'completed')
  const canGenerate = hasCompletedFiles && !generatingAnalysis

  // Safe accessors for selectedAnalysis
  const safeAnalysis = selectedAnalysis ?? {
    id: '',
    title: '',
    createdAt: new Date().toISOString(),
    documents: [],
    questions: [],
    repeatGroups: [],
    rankedQuestions: [],
    unitCoverage: [],
    topicFrequency: [],
    studyOrder: [],
    summary: {
      papersAnalyzed: 0,
      totalQuestions: 0,
      exactRepeatGroups: 0,
      semanticRepeatGroups: 0,
      conceptGroups: 0,
    },
    limitations: [],
  }

  // Derived data for results view
  const highPriority = safeAnalysis.rankedQuestions.filter(q => q.priority === 'HIGH')
  const mediumPriority = safeAnalysis.rankedQuestions.filter(q => q.priority === 'MEDIUM')
  const lowPriority = safeAnalysis.rankedQuestions.filter(q => q.priority === 'LOW')
  const repeatGroups = safeAnalysis.repeatGroups

  // Render
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Important Questions</h1>
            <p className="text-muted-foreground mt-1">Upload question papers and get AI-powered priority analysis</p>
          </div>
        </div>
      </div>

      {/* WORKSPACE VIEW */}
      {view === 'workspace' && (
        <div className="space-y-6">
          {/* Upload Area */}
          <Card className="border-dashed border-2 transition-colors"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
            style={{ borderColor: dragActive ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
          >
            <CardContent className="pt-8 pb-8">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.rtf,.odt"
                onChange={handleFileSelect}
                className="hidden"
                id="iq-file-input"
              />
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                  <Upload className="h-10 w-10" />
                </div>
                <div className="text-center">
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
                  Supported: PDF, DOCX, DOC, TXT, MD, RTF, ODT • Max 25MB each • Multiple files allowed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Uploaded Files ({uploadedFiles.length})
                </CardTitle>
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
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-80">
                  <div className="space-y-3">
                    {uploadedFiles.map((fileItem, idx) => (
                      <div key={fileItem.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                        <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0", getStatusColor(fileItem.status))}>
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
                              disabled={fileItem.status === 'uploading'}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-2 flex items-center gap-3">
                            <Badge variant={fileItem.status === 'completed' ? 'default' : fileItem.status === 'error' ? 'destructive' : 'outline'}>
                              {fileItem.status === 'completed' ? 'Ready' : fileItem.status === 'uploading' ? 'Uploading...' : fileItem.status === 'error' ? 'Failed' : 'Pending'}
                            </Badge>
                            {fileItem.progress !== undefined && fileItem.progress > 0 && fileItem.progress < 100 && (
                              <div className="flex-1 max-w-xs">
                                <Progress value={fileItem.progress} className="h-1.5" />
                              </div>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">{fileItem.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Previous Analyses */}
          {analyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Analyses ({analyses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyses.map((analysis: SavedAnalysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/40 cursor-pointer"
                      onClick={() => handleSelectAnalysis(analysis)}>
                    <div>
                      <p className="font-medium">{analysis.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {analysis.summary.totalQuestions} questions • {analysis.summary.papersAnalyzed} papers •
                        {analysis.summary.exactRepeatGroups} exact • {analysis.summary.semanticRepeatGroups} semantic
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

          {/* Instructions Composer */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="flex items-center gap-2">
                    <span>Optional Instructions</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Label>
                </div>
                <Textarea
                  placeholder="Guide the AI analysis with specific instructions. Examples:
• Focus on Unit 3 and Unit 4
• Prioritize frequently repeated questions
• Give more importance to 10-mark questions
• Generate around 30 questions
• Include questions from every unit
• Focus on important theory questions rather than numerical problems"
                  value={additionalInstructions}
                  onChange={e => setAdditionalInstructions(e.target.value)}
                  rows={3}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  These instructions will directly influence the AI analysis and priority ranking. Leave empty for default analysis.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleGenerateAnalysis}
                  disabled={!canGenerate}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  size="lg"
                >
                  {generatingAnalysis ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Important Questions
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generation Progress */}
          {generatingAnalysis && generationProgress && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{generationProgress.stage}</span>
                    <span className="text-sm text-muted-foreground">{generationProgress.progress}%</span>
                  </div>
                  <Progress value={generationProgress.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{generationProgress.message}</p>
                </div>
              </CardContent>
            </Card>
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
        </div>
      )}

      {/* RESULTS VIEW */}
      {view === 'results' && selectedAnalysis && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          {/* Results Header */}
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
                  <Button variant="outline" onClick={() => { setSelectedAnalysis(null); setView('workspace'); }}>
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
                  <p className="text-2xl font-bold text-primary">{selectedAnalysis.summary.totalQuestions}</p>
                  <p className="text-sm text-muted-foreground">Total Questions</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{selectedAnalysis.summary.exactRepeatGroups}</p>
                  <p className="text-sm text-muted-foreground">Exact Repeats</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-orange-500">{selectedAnalysis.summary.semanticRepeatGroups}</p>
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
                    <Copy className="mr-2 h-4 w-4" /> Repeated Questions ({repeatGroups.length})
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
                                  {item.occurrences.some(o => repeatGroups.find(g => g.kind === 'EXACT' && g.occurrenceIds.includes(o.id))) && (
                                    <Badge variant="destructive" className="text-xs">EXACT REPEAT</Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-medium">{item.question}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {item.occurrences.length > 1 && <Badge variant="outline">Occurrences: {item.occurrences.length}</Badge>}
                                  {new Set(item.occurrences.map(o => o.sourceDocumentId)).size > 1 && <Badge variant="outline">Papers: {new Set(item.occurrences.map(o => o.sourceDocumentId)).size}</Badge>}
                                  {item.marks && item.marks > 0 && <Badge variant="outline">Marks: {item.marks}</Badge>}
                                  {item.unit && <Badge variant="outline">Unit: {item.unit}</Badge>}
                                  {item.topic && <Badge variant="outline">Topic: {item.topic}</Badge>}
                                  {item.concept && <Badge variant="outline">Concept: {item.concept}</Badge>}
                                  {item.source === 'ai_enhanced' && <Badge variant="secondary">AI Enhanced</Badge>}
                                  {item.source === 'web_research' && <Badge variant="secondary">Web Research</Badge>}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground italic">Reason: {item.rationale.join('; ')}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* MEDIUM PRIORITY */}
                <TabsContent value="medium-priority" className="mt-4 space-y-3">
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
                                  {item.occurrences.some(o => repeatGroups.find(g => g.kind === 'EXACT' && g.occurrenceIds.includes(o.id))) && (
                                    <Badge variant="destructive" className="text-xs">EXACT REPEAT</Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-sm">{item.question}</p>
                                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {item.occurrences.length > 1 && <Badge variant="outline">Freq: {item.occurrences.length}</Badge>}
                                  {new Set(item.occurrences.map(o => o.sourceDocumentId)).size > 1 && <Badge variant="outline">Papers: {new Set(item.occurrences.map(o => o.sourceDocumentId)).size}</Badge>}
                                  {item.marks && item.marks > 0 && <Badge variant="outline">Avg: {item.marks}</Badge>}
                                  {item.unit && <Badge variant="outline">{item.unit}</Badge>}
                                  {item.source === 'ai_enhanced' && <Badge variant="secondary">AI Enhanced</Badge>}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground italic">{item.rationale.join('; ')}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* LOW PRIORITY */}
                <TabsContent value="low-priority" className="mt-4 space-y-2">
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
                                <p className="text-sm text-gray-700">{item.question}</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                {item.occurrences.length > 1 && <Badge variant="outline">Freq: {item.occurrences.length}</Badge>}
                                {item.unit && <Badge variant="outline">{item.unit}</Badge>}
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
                  {(repeatGroups.length === 0) ? (
                    <EmptyState
                      icon={Copy}
                      title="No repeated questions found"
                      description="The analyzed papers don't contain identical or semantically similar questions."
                    />
                  ) : (
                    <div className="space-y-6">
                      {/* Exact Repeats */}
                      {repeatGroups.filter(g => g.kind === 'EXACT').length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">Exact Repeats</Badge>
                            <span className="text-sm text-muted-foreground">({repeatGroups.filter(g => g.kind === 'EXACT').length} groups)</span>
                          </h4>
                          {repeatGroups.filter(g => g.kind === 'EXACT').map((group, index) => (
                            <Card key={group.id} className="border-red-100">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Group #{index + 1} • {group.frequency} occurrences</span>
                                  <Badge variant="destructive" className="text-xs">{group.occurrenceIds.length} occurrences</Badge>
                                </div>
                                <p className="text-sm mb-2">{group.canonicalQuestion}</p>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {group.occurrenceIds.slice(0, 5).map((oid, i) => {
                                    const occ = selectedAnalysis.questions.find(q => q.id === oid)
                                    return occ ? <Badge key={oid} variant="outline">{occ.sourceFileName}{occ.page ? ` p.${occ.page}` : ''}</Badge> : null
                                  })}
                                  {group.occurrenceIds.length > 5 && <Badge variant="outline">+{group.occurrenceIds.length - 5} more</Badge>}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Semantic Repeats */}
                      {repeatGroups.filter(g => g.kind === 'SEMANTIC').length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Semantic Similarities</Badge>
                            <span className="text-sm text-muted-foreground">({repeatGroups.filter(g => g.kind === 'SEMANTIC').length} groups)</span>
                          </h4>
                          {repeatGroups.filter(g => g.kind === 'SEMANTIC').map((group, index) => (
                            <Card key={group.id} className="border-orange-100">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Group #{index + 1} • {group.frequency} similar questions</span>
                                  <Badge variant="secondary" className="text-xs">{Math.round(group.confidence * 100)}% confidence</Badge>
                                </div>
                                <p className="text-sm mb-2">{group.canonicalQuestion}</p>
                                <p className="text-xs text-muted-foreground mb-2">{group.explanation}</p>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {group.occurrenceIds.slice(0, 5).map((oid, i) => {
                                    const occ = selectedAnalysis.questions.find(q => q.id === oid)
                                    return occ ? <Badge key={oid} variant="outline">{occ.sourceFileName}{occ.page ? ` p.${occ.page}` : ''}</Badge> : null
                                  })}
                                  {group.occurrenceIds.length > 5 && <Badge variant="outline">+{group.occurrenceIds.length - 5} more</Badge>}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Concept Groups */}
                      {repeatGroups.filter(g => g.kind === 'CONCEPT').length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Concept Groups</Badge>
                            <span className="text-sm text-muted-foreground">({repeatGroups.filter(g => g.kind === 'CONCEPT').length} groups)</span>
                          </h4>
                          {repeatGroups.filter(g => g.kind === 'CONCEPT').map((group, index) => (
                            <Card key={group.id} className="border-blue-100">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">Concept: {group.canonicalQuestion}</span>
                                  <Badge variant="outline" className="text-xs">{group.frequency} questions</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{group.explanation}</p>
                                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                  {group.occurrenceIds.slice(0, 5).map((oid, i) => {
                                    const occ = selectedAnalysis.questions.find(q => q.id === oid)
                                    return occ ? <Badge key={oid} variant="outline">{occ.sourceFileName}{occ.page ? ` p.${occ.page}` : ''}</Badge> : null
                                  })}
                                  {group.occurrenceIds.length > 5 && <Badge variant="outline">+{group.occurrenceIds.length - 5} more</Badge>}
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
                  {selectedAnalysis.unitCoverage.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No unit data available"
                      description="Unit information could not be extracted from the uploaded documents."
                    />
                  ) : (
                    <div className="space-y-4">
                      {selectedAnalysis.unitCoverage.map((unit) => (
                        <Card key={unit.unit} className="border-primary/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{unit.unit}</span>
                              <Badge variant="outline">{unit.questionCount} questions</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">Total marks: {unit.totalMarks}</p>
                            {unit.topics.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {unit.topics.map((topic) => (
                                  <Badge key={topic} variant="secondary" className="text-xs">{topic}</Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* STUDY PLAN / RECOMMENDATIONS */}
                <TabsContent value="recommendations" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          Study Recommendations
                        </h4>
                        <ul className="mt-3 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                          <li>Start with <strong>{highPriority.length} high-priority questions</strong> - these have the strongest evidence of recurrence and importance.</li>
                          <li>Review <strong>{mediumPriority.length} medium-priority questions</strong> for comprehensive coverage.</li>
                          {lowPriority.length > 0 && (
                            <li>Use <strong>{lowPriority.length} low-priority questions</strong> for additional practice if time permits.</li>
                          )}
                          {selectedAnalysis.summary.exactRepeatGroups > 0 && (
                            <li>Pay special attention to <strong>{selectedAnalysis.summary.exactRepeatGroups} exactly repeated questions</strong> across papers - these are historically the most likely to reappear.</li>
                          )}
                          {selectedAnalysis.summary.semanticRepeatGroups > 0 && (
                            <li>Study the <strong>{selectedAnalysis.summary.semanticRepeatGroups} semantically similar question groups</strong> together to understand variations on the same concepts.</li>
                          )}
                          {selectedAnalysis.unitCoverage.length > 0 && (
                            <li>Ensure coverage across all <strong>{selectedAnalysis.unitCoverage.length} identified units/topics</strong> for balanced preparation.</li>
                          )}
                          <li>Practice writing full answers for high-mark questions ({selectedAnalysis.rankedQuestions.filter(q => (q.marks ?? 0) >= 10).length} questions are 10+ marks).</li>
                          <li>Create flashcards from the repeated question groups for quick revision.</li>
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Topic Frequency */}
                    {safeAnalysis.topicFrequency.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Topic Frequency</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedAnalysis.topicFrequency.slice(0, 15).map((item) => (
                              <div key={item.topic} className="flex items-center justify-between text-sm">
                                <span className="truncate max-w-[300px]">{item.topic}</span>
                                <Badge variant="outline">{item.count} questions</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Study Order */}
                    {safeAnalysis.studyOrder.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Suggested Study Order</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedAnalysis.studyOrder.slice(0, 10).map((item) => (
                              <div key={item.topic} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{item.rank}</span>
                                  <span className="font-medium">{item.topic}</span>
                                </div>
                                <p className="text-xs text-muted-foreground max-w-[300px]">{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Limitations */}
                    {safeAnalysis.limitations.length > 0 && (
                      <Card className="border-destructive/20 bg-destructive/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-destructive">
                              <p className="font-medium mb-1">Analysis Limitations</p>
                              <ul className="list-disc list-inside space-y-1">
                                {selectedAnalysis.limitations.map((limitation, i) => (
                                  <li key={i}>{limitation}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Source Documents */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Source Documents</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {safeAnalysis.documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                              <span className="font-medium">{doc.fileName}</span>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {doc.paperType && <Badge variant="outline" className="text-xs">{doc.paperType}</Badge>}
                                {doc.examYear && <Badge variant="secondary" className="text-xs">{doc.examYear}</Badge>}
                                {doc.marks && <Badge variant="outline" className="text-xs">{doc.marks} marks</Badge>}
                                {doc.pageCount && <Badge variant="outline" className="text-xs">{doc.pageCount} pages</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}