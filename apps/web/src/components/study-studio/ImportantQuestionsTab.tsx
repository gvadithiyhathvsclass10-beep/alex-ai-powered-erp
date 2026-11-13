"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"
import {
  Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle, AlertCircle, RotateCcw, ChevronRight, ChevronLeft, Settings, Search, FlaskConical, HelpCircle, Link, Trash2, Link2, ListMinus, Filter, Trophy, Archive, Trophy as TrophyIcon, ChevronDown, Upload, CheckCircle2 as CheckCircleIcon, Loader2, X, Paperclip, Eye, Download as DownloadIcon,
} from "lucide-react"
import { RAGChat } from "@/components/rag/rag-chat"
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
  questions?: any[]
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
}

interface UploadedFile {
  file: File
  id: string
}

interface ProcessingStatus {
  fileName: string
  state: 'pending' | 'processing' | 'completed' | 'error'
  message: string
}

interface GenerationProgress {
  stage: string
  progress: number
  message: string
}

export function ImportantQuestionsTab({
  questionPapers,
  questionAnalyses,
  iqSubjects,
  allUserDocuments,
}: {
  questionPapers: QuestionPaper[]
  questionAnalyses: QuestionAnalysis[]
  iqSubjects: Subject[]
  allUserDocuments: any[]
}) {
  const queryClient = useQueryClient()
  
  // Step state
  const [iqStep, setIqStep] = React.useState(1)
  
  // Step 1: Subject
  const [iqSubjectId, setIqSubjectId] = React.useState("")
  const [iqSemester, setIqSemester] = React.useState("")
  const [iqAcademicYear, setIqAcademicYear] = React.useState("")
  
  // Step 2: Upload
  const [iqUploadedFiles, setIqUploadedFiles] = React.useState<UploadedFile[]>([])
  const [iqDragActive, setIqDragActive] = React.useState(false)
  const [iqPaperType, setIqPaperType] = React.useState<'QB' | 'PYQ'>('PYQ')
  const [iqExaminationYear, setIqExaminationYear] = React.useState("")
  const [iqTotalMarks, setIqTotalMarks] = React.useState("")
  const [iqAdditionalInstructions, setIqAdditionalInstructions] = React.useState("")
  const [iqUploadingFiles, setIqUploadingFiles] = React.useState(false)
  const [iqProcessingStatus, setIqProcessingStatus] = React.useState<ProcessingStatus[]>([])
  const [iqReadyPapers, setIqReadyPapers] = React.useState<QuestionPaper[]>([])
  const iqFileInputRef = React.useRef<HTMLInputElement>(null)
  
  // Step 3: Generate
  const [iqAnalysisTitle, setIqAnalysisTitle] = React.useState("")
  const [iqEnableWebResearch, setIqEnableWebResearch] = React.useState(true)
  const [iqGeneratingAnalysis, setIqGeneratingAnalysis] = React.useState(false)
  const [iqGenerationProgress, setIqGenerationProgress] = React.useState<GenerationProgress | null>(null)
  const [iqGenerationError, setIqGenerationError] = React.useState<string | null>(null)
  const [iqAnalyses, setIqAnalyses] = React.useState<QuestionAnalysis[]>(questionAnalyses)
  const [iqSelectedAnalysis, setIqSelectedAnalysis] = React.useState<QuestionAnalysis | null>(null)
  
  // Step 4: PDF
  const [iqDownloadingPDF, setIqDownloadingPDF] = React.useState(false)

  // Sync with prop changes
  React.useEffect(() => {
    setIqAnalyses(questionAnalyses)
  }, [questionAnalyses])

  // Subject selection logic
  const handleIqStep1Next = () => {
    if (!iqSubjectId) {
      toast({ title: "Please select a subject", description: "You must select an existing subject to continue", variant: 'destructive' })
      return
    }
    setIqStep(2)
  }

  // File handling
  const handleIqFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    addIqFiles(files)
  }

  const handleIqFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIqDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    addIqFiles(files)
  }

  const addIqFiles = (files: File[]) => {
    const validFiles = files.filter(f => 
      ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'].includes(f.type)
    )
    const newFiles = validFiles.map(f => ({ file: f, id: `${Date.now()}-${Math.random()}` }))
    setIqUploadedFiles(prev => [...prev, ...newFiles])
  }

  const removeIqFile = (idx: number) => {
    setIqUploadedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleIqUploadFiles = async () => {
    if (iqUploadedFiles.length === 0) return
    
    setIqUploadingFiles(true)
    setIqProcessingStatus(iqUploadedFiles.map(f => ({
      fileName: f.file.name,
      state: 'pending',
      message: 'Queued for upload'
    })))
    
    try {
      const formData = new FormData()
      iqUploadedFiles.forEach(({ file }) => {
        formData.append('files', file)
      })
      // Use first file's name as title base
      const firstFile = iqUploadedFiles[0].file
      formData.append('title', `${firstFile.name.replace(/\.[^/.]+$/, "")}`)
      formData.append('paperType', iqPaperType)
      if (iqSubjectId) formData.append('subjectId', iqSubjectId)
      if (iqSemester) formData.append('semester', iqSemester)
      if (iqAcademicYear) formData.append('academicYear', iqAcademicYear)
      if (iqExaminationYear) formData.append('examinationYear', iqExaminationYear)
      if (iqTotalMarks) formData.append('marks', iqTotalMarks)
      if (iqAdditionalInstructions) formData.append('additionalInstructions', iqAdditionalInstructions)
      
      // Update all to processing
      setIqProcessingStatus(prev => prev.map(s => ({ ...s, state: 'processing', message: 'Uploading...' })))
      
      const res = await fetch('/api/important-questions/papers', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      
      const data = await res.json()
      const papers = data.papers || []
      
      // Update all to completed
      setIqProcessingStatus(prev => prev.map(s => ({ ...s, state: 'completed', message: 'Uploaded successfully' })))
      
      setIqReadyPapers(papers)
      
      toast({ title: `${papers.length} paper(s) uploaded`, description: "Starting question extraction..." })
      
      // Automatically extract questions from all uploaded papers
      await handleAutoExtractQuestions(papers)
      
    } catch (err) {
      setIqProcessingStatus(prev => prev.map(s => 
        ({ ...s, state: 'error', message: err instanceof Error ? err.message : 'Upload failed' })
      ))
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setIqUploadingFiles(false)
    }
  }

  const handleAutoExtractQuestions = async (papers: QuestionPaper[]) => {
    const extractedPapers: QuestionPaper[] = []
    
    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i]
      
      setIqProcessingStatus(prev => prev.map((s, idx) => 
        idx === i ? { ...s, state: 'processing', message: 'Extracting questions...' } : s
      ))
      
      try {
        const res = await fetch(`/api/important-questions/papers/${paper.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'extract' }),
        })
        
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Extraction failed')
        }
        
        const data = await res.json()
        const extractedPaper = { ...paper, questions: data.questions, _count: { questions: data.extractedCount } }
        extractedPapers.push(extractedPaper)
        
        setIqProcessingStatus(prev => prev.map((s, idx) => 
          idx === i ? { ...s, state: 'completed', message: `Extracted ${data.extractedCount} questions` } : s
        ))
      } catch (err) {
        setIqProcessingStatus(prev => prev.map((s, idx) => 
          idx === i ? { ...s, state: 'error', message: err instanceof Error ? err.message : 'Extraction failed' } : s
        ))
      }
    }
    
    if (extractedPapers.length > 0) {
      setIqReadyPapers(extractedPapers)
      toast({ title: "Extraction complete", description: "All papers processed. Ready for analysis." })
    }
  }

  const handleIqStep2Next = () => {
    if (iqReadyPapers.length > 0) {
      setIqStep(3)
      if (!iqAnalysisTitle) {
        const subject = iqSubjects.find(s => s.id === iqSubjectId)
        setIqAnalysisTitle(`${subject?.name || 'Subject'} Important Questions ${new Date().getFullYear()}`)
      }
    }
  }

  // Step 3: Generate Analysis
  const handleIqGenerateAnalysis = async () => {
    if (iqReadyPapers.length === 0) return
    
    setIqGeneratingAnalysis(true)
    setIqGenerationError(null)
    setIqGenerationProgress({ stage: 'Analyzing...', progress: 50, message: 'AI is analyzing all question papers' })
    
    try {
      const paperIds = iqReadyPapers.map(p => p.id)
      const subject = iqSubjects.find(s => s.id === iqSubjectId)
      
      const res = await fetch('/api/important-questions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds,
          subjectId: iqSubjectId || undefined,
          title: iqAnalysisTitle,
          enableWebResearch: iqEnableWebResearch,
          subjectName: subject?.name,
          semester: iqSemester || undefined,
          academicYear: iqAcademicYear || undefined,
          additionalInstructions: iqAdditionalInstructions || undefined,
        }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Analysis failed')
      }
      
      setIqGenerationProgress({ stage: 'Finalizing...', progress: 90, message: 'Generating report' })
      
      const data = await res.json()
      const newAnalysis = data.analysis
      
      setIqAnalyses(prev => [newAnalysis, ...prev])
      setIqSelectedAnalysis(newAnalysis)
      setIqStep(4)
      
      toast({ title: "Analysis complete", description: "Important questions report generated successfully" })
    } catch (err) {
      setIqGenerationError(err instanceof Error ? err.message : 'Analysis failed')
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setIqGeneratingAnalysis(false)
      setIqGenerationProgress(null)
    }
  }

  const handleIqSelectAnalysis = (analysis: QuestionAnalysis) => {
    setIqSelectedAnalysis(analysis)
    setIqStep(4)
  }

  const deleteIqAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/important-questions/analyses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setIqAnalyses(prev => prev.filter(a => a.id !== id))
      if (iqSelectedAnalysis?.id === id) setIqSelectedAnalysis(null)
      toast({ title: "Analysis deleted" })
    } catch {
      toast({ title: "Error", description: "Failed to delete analysis", variant: 'destructive' })
    }
  }

  // Step 4: PDF Download
  const handleIqDownloadPDF = async () => {
    if (!iqSelectedAnalysis) return
    
    setIqDownloadingPDF(true)
    try {
      const res = await fetch(`/api/important-questions/export-pdf/${iqSelectedAnalysis.id}`)
      if (!res.ok) throw new Error('PDF generation failed')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `important-questions-${iqSelectedAnalysis.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({ title: "PDF downloaded", description: "Report saved to your downloads" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to download PDF", variant: 'destructive' })
    } finally {
      setIqDownloadingPDF(false)
    }
  }

  // Render steps
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Badge variant={iqStep >= 1 ? 'default' : 'outline'}>1. Subject</Badge>
        <ChevronRight className="h-3 w-3" />
        <Badge variant={iqStep >= 2 ? 'default' : 'outline'}>2. Upload Papers</Badge>
        <ChevronRight className="h-3 w-3" />
        <Badge variant={iqStep >= 3 ? 'default' : 'outline'}>3. Process & Analyze</Badge>
        <ChevronRight className="h-3 w-3" />
        <Badge variant={iqStep >= 4 ? 'default' : 'outline'}>4. Report & PDF</Badge>
      </div>

      {/* STEP 1: SELECT SUBJECT */}
      {iqStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Step 1: Select Subject
            </CardTitle>
            <CardDescription>
              Choose an existing subject or create a new one for your question paper analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={iqSubjectId} onValueChange={setIqSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Select an existing subject" /></SelectTrigger>
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
              <div className="space-y-2">
                <Label>Semester (optional)</Label>
                <Input placeholder="e.g., Semester 3" value={iqSemester} onChange={e => setIqSemester(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Academic Year (optional)</Label>
                <Input placeholder="e.g., 2023-2024" value={iqAcademicYear} onChange={e => setIqAcademicYear(e.target.value)} />
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleIqStep1Next} 
                disabled={!iqSubjectId}
              >
                Next: Upload Papers <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: UPLOAD PAPERS */}
      {iqStep === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Step 2: Upload Question Papers
                  </CardTitle>
                  <CardDescription>
                    Drag and drop multiple PDF, DOCX, or TXT files. You can upload both Question Banks and Previous Year Papers.
                  </CardDescription>
                </div>
                <Badge variant={iqUploadedFiles.length > 0 ? 'default' : 'outline'}>
                  {iqUploadedFiles.length} file(s) ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                  iqDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIqDragActive(true); }}
                onDragLeave={() => setIqDragActive(false)}
                onDrop={handleIqFileDrop}
                onClick={() => iqFileInputRef.current?.click()}
              >
                <input
                  ref={iqFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleIqFileSelect}
                  className="hidden"
                  id="iq-file-upload"
                />
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Drag & drop question papers here, or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports: PDF, DOCX, TXT, MD • Max 50MB per file</p>
              </div>

              {/* Uploaded Files List */}
              {iqUploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Files Ready for Upload ({iqUploadedFiles.length})</h4>
                  {iqUploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{file.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.file.size / 1024 / 1024).toFixed(2)} MB • {file.file.type}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeIqFile(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Paper Type & Common Metadata */}
              <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Paper Type (applies to all)</Label>
                  <Select value={iqPaperType} onValueChange={v => setIqPaperType(v as 'QB' | 'PYQ')}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QB">Question Bank (QB)</SelectItem>
                      <SelectItem value="PYQ">Previous Year Question Paper (PYQ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Examination Year (for PYQ)</Label>
                  <Input type="number" placeholder="e.g., 2023" value={iqExaminationYear} onChange={e => setIqExaminationYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" placeholder="e.g., 100" value={iqTotalMarks} onChange={e => setIqTotalMarks(e.target.value)} />
                </div>
              </div>

              {/* Additional Instructions (Optional) */}
              <div className="pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <span>Additional Instructions (Optional)</span>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Label>
                <Textarea
                  placeholder="e.g., Focus primarily on questions that repeatedly appear in previous examinations. Give more importance to 10-mark and 15-mark questions. Prioritize Unit 3 and Unit 4. Identify questions that are likely to appear in the next examination."
                  value={iqAdditionalInstructions}
                  onChange={e => setIqAdditionalInstructions(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Guide the AI analysis with specific instructions. Examples: focus on repeated questions, prioritize high-mark questions, target specific units, etc.
                </p>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setIqStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleIqUploadFiles} 
                  disabled={iqUploadingFiles || iqUploadedFiles.length === 0}
                >
                  {iqUploadingFiles ? 'Uploading...' : 'Upload & Process Papers'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Processing Status */}
          {iqProcessingStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {iqProcessingStatus.map((status, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        status.state === 'completed' ? 'bg-green-100 text-green-600' :
                        status.state === 'processing' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                        status.state === 'error' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {status.state === 'completed' ? <CheckCircleIcon className="h-4 w-4" /> :
                        status.state === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        status.state === 'error' ? <AlertCircle className="h-4 w-4" /> :
                        <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{status.fileName}</p>
                        <p className="text-xs text-muted-foreground">{status.message}</p>
                      </div>
                      
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleIqStep2Next} 
              disabled={iqReadyPapers.length === 0}
            >
              Next: Generate Report <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: GENERATE ANALYSIS */}
      {iqStep === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Step 3: Generate Important Questions Report
              </CardTitle>
              <CardDescription>
                Analyze all uploaded papers together with optional web research for comprehensive coverage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Papers Summary */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-3">Papers to Analyze ({iqReadyPapers.length})</h4>
                <div className="space-y-2">
                  {iqReadyPapers.map((paper: QuestionPaper) => (
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
                  <Input placeholder="e.g., Physics Important Questions 2020-2024" value={iqAnalysisTitle} onChange={e => setIqAnalysisTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Enable Web Research</Label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="iq-web-research" checked={iqEnableWebResearch} onChange={e => setIqEnableWebResearch(e.target.checked)} />
                    <Label htmlFor="iq-web-research" className="text-sm cursor-pointer">
                      Search online syllabi, textbooks, and academic sources for additional concepts
                    </Label>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setIqStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleIqGenerateAnalysis} 
                  disabled={iqGeneratingAnalysis || iqReadyPapers.length === 0}
                  className="btn-primary-gradient"
                >
                  {iqGeneratingAnalysis ? (
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
              {iqGeneratingAnalysis && iqGenerationProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{iqGenerationProgress.stage}</span>
                    <span className="text-sm text-muted-foreground">{iqGenerationProgress.progress}%</span>
                  </div>
                  <Progress value={iqGenerationProgress.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{iqGenerationProgress.message}</p>
                </div>
              )}

              {/* Generation Error */}
              {iqGenerationError && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Analysis Failed</p>
                        <p className="text-sm text-destructive">{iqGenerationError}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Previous Analyses */}
          {iqAnalyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Analyses ({iqAnalyses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {iqAnalyses.map((analysis: QuestionAnalysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/40 cursor-pointer"
                      onClick={() => handleIqSelectAnalysis(analysis)}>
                    <div>
                      <p className="font-medium">{analysis.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {analysis.totalQuestions} questions • {analysis.paperIds.length} papers • 
                        {analysis.exactRepeats} exact repeats • {analysis.priorityItems?.filter((p: any) => p.priority === 'HIGH').length || 0} high priority
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteIqAnalysis(analysis.id) }}>
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

      {/* STEP 4: REPORT & PDF */}
      {iqStep === 4 && iqSelectedAnalysis && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrophyIcon className="h-5 w-5" />
                    Step 4: Important Questions Report
                  </CardTitle>
                  <CardDescription>{iqSelectedAnalysis.title}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleIqDownloadPDF} 
                    disabled={iqDownloadingPDF}
                    className="btn-primary-gradient"
                  >
                    {iqDownloadingPDF ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="mr-2 h-4 w-4" />
                        Download PDF Report
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIqStep(3)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Executive Summary */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{iqSelectedAnalysis.totalQuestions}</div>
                      <div className="text-sm text-muted-foreground">Questions Analyzed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{iqSelectedAnalysis.priorityItems?.filter((p: any) => p.priority === 'HIGH').length || 0}</div>
                      <div className="text-sm text-muted-foreground">High Priority Topics</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">{iqSelectedAnalysis.exactRepeats}</div>
                      <div className="text-sm text-muted-foreground">Exact Repeats</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{iqSelectedAnalysis.paperIds.length}</div>
                      <div className="text-sm text-muted-foreground">Papers Analyzed</div>
                    </CardContent>
                  </Card>
                </div>

                {/* High Priority Questions */}
                {iqSelectedAnalysis.priorityItems?.filter((p: any) => p.priority === 'HIGH').length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge variant="destructive">HIGH PRIORITY</Badge>
                      Topics with Strong Historical Evidence
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {iqSelectedAnalysis.priorityItems
                        .filter((p: any) => p.priority === 'HIGH')
                        .map((item: any, idx: number) => (
                          <Card key={item.id} className="border-l-4 border-l-red-500">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="destructive">HIGH</Badge>
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
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medium Priority */}
                    {iqSelectedAnalysis.priorityItems?.filter((p: any) => p.priority === 'MEDIUM').length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Badge variant="warning">MEDIUM PRIORITY</Badge>
                          Topics with Moderate Historical Evidence
                        </h4>
                        <div className="space-y-2">
                          {iqSelectedAnalysis.priorityItems
                            .filter((p: any) => p.priority === 'MEDIUM')
                            .slice(0, 10)
                            .map((item: any) => (
                              <Card key={item.id} className="border-l-4 border-l-amber-500">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{item.concept || item.questionText?.slice(0, 80)}</p>
                                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Badge variant="outline">Freq: {item.frequency}</Badge>
                                      <Badge variant="outline">Papers: {item.papersCount}</Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Distributions */}
                    {iqSelectedAnalysis.analysisData && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {iqSelectedAnalysis.analysisData.unitDistribution && Object.keys(iqSelectedAnalysis.analysisData.unitDistribution).length > 0 && (
                          <Card>
                            <CardHeader><CardTitle>Unit Distribution</CardTitle></CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {Object.entries(iqSelectedAnalysis.analysisData.unitDistribution as Record<string, number>)
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
                        {iqSelectedAnalysis.analysisData.topicDistribution && Object.keys(iqSelectedAnalysis.analysisData.topicDistribution).length > 0 && (
                          <Card>
                            <CardHeader><CardTitle>Top Topics</CardTitle></CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {Object.entries(iqSelectedAnalysis.analysisData.topicDistribution as Record<string, number>)
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
                      </div>
                    )}

                    {/* Web Research Results */}
                    {iqSelectedAnalysis.analysisData?.webResearch && (
                      <Card className="border-primary/30 bg-primary/5">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            Additional Subject Research (Web-Based)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {iqSelectedAnalysis.analysisData.webResearch.importantConcepts.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Fundamental Concepts from Web Research</h5>
                              <div className="flex flex-wrap gap-2">
                                {iqSelectedAnalysis.analysisData.webResearch.importantConcepts.map((c: string, i: number) => (
                                  <Badge key={i} variant="secondary">{c}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {iqSelectedAnalysis.analysisData.webResearch.missingTopics.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2 text-destructive">Potentially Missing Topics</h5>
                              <div className="flex flex-wrap gap-2">
                                {iqSelectedAnalysis.analysisData.webResearch.missingTopics.map((t: string, i: number) => (
                                  <Badge key={i} variant="destructive">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {iqSelectedAnalysis.analysisData.webResearch.sources.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Sources Referenced</h5>
                              <div className="space-y-1">
                                {iqSelectedAnalysis.analysisData.webResearch.sources.map((s: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.title}</a>
                                    <span className="text-muted-foreground">{s.type} • {Math.round(s.relevance * 100)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Limitations */}
                    <Card className="border-destructive/20 bg-destructive/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-destructive">
                            <p className="font-medium mb-1">Important Limitations</p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>Analysis based on {iqSelectedAnalysis.totalQuestions} questions from {iqSelectedAnalysis.paperIds.length} papers</li>
                              <li>Priority ranking uses frequency, recency, marks, and paper coverage - not a guarantee of future questions</li>
                              <li>Exact repeats detected by text normalization; semantic similarity via embeddings when available</li>
                              <li>Web research supplements but does not replace official syllabus</li>
                              <li>AI-predicted questions are for practice only, not actual exam predictions</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>

                {/* ALEX Chat for this analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Ask ALEX About This Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RAGChat
                      subjectId={iqSubjectId || iqSelectedAnalysis.subjectId}
                      documentIds={iqSelectedAnalysis.paperIds}
                      initialMessages={[
                        {
                          id: 'welcome',
                          role: 'assistant',
                          content: `I've analyzed your important questions report for "${iqSelectedAnalysis.title}". I can explain why certain questions are prioritized, generate additional practice questions, or clarify concepts from the web research. What would you like to know?`,
                          createdAt: new Date().toISOString(),
                        }
                      ]}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
        </div>
  )
}