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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Play, 
  Settings, 
  Download, 
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Users,
  BarChart2,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Shield,
  X,
} from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { TestQuestionEditor } from "@/components/online-tests/TestQuestionEditor"
import type { OnlineTest, TestQuestion } from "@/components/online-tests/TestPlayer"

interface AttemptSummary {
  id: string
  testId: string
  userId: string
  attemptNumber: number
  status: string
  startedAt: string
  submittedAt: string | null
  timeRemaining: number | null
  totalMarks: number
  obtainedMarks: number | null
  autoSubmitted: boolean
  autoSubmitReason: string | null
  integrityWarnings: number
  user: { id: string; firstName: string; lastName: string; email: string; studentId: string | null }
}

export default function LecturerTestsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("tests")
  const [selectedTest, setSelectedTest] = React.useState<OnlineTest | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [showQuestionsEditor, setShowQuestionsEditor] = React.useState(false)
  const [showAttemptsDialog, setShowAttemptsDialog] = React.useState(false)
  const [viewingAttempt, setViewingAttempt] = React.useState<AttemptSummary | null>(null)

  // Teacher Create Test dialog state
  const [newTest, setNewTest] = React.useState({
    subjectId: "",
    title: "",
    description: "",
    instructions: "",
    durationMinutes: 60,
    totalMarks: 100,
    passingMarks: "",
    testType: "MCQ",
    negativeMarking: 0,
    maxAttempts: 1,
    startTime: "",
    endTime: "",
    isProctored: false,
    shuffleQuestions: false,
    shuffleOptions: false,
  })

  const { data: testsData, isLoading, isError, refetch: refetchTests } = useQuery({
    queryKey: ['online-tests', 'lecturer'],
    queryFn: async () => {
      const res = await fetch('/api/online-tests')
      if (!res.ok) throw new Error('Failed to fetch tests')
      return res.json()
    },
  })

  const tests: OnlineTest[] = testsData?.tests || []

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects', 'my'],
    queryFn: async () => {
      const res = await fetch('/api/subjects/my')
      if (!res.ok) return { subjects: [] }
      return res.json()
    },
  })

  const createTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/online-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: newTest.subjectId,
          title: newTest.title,
          description: newTest.description || null,
          instructions: newTest.instructions || null,
          durationMinutes: Number(newTest.durationMinutes),
          totalMarks: Number(newTest.totalMarks),
          passingMarks: newTest.passingMarks ? Number(newTest.passingMarks) : null,
          testType: newTest.testType,
          negativeMarking: Number(newTest.negativeMarking),
          maxAttempts: Number(newTest.maxAttempts),
          startTime: newTest.startTime ? new Date(newTest.startTime).toISOString() : null,
          endTime: newTest.endTime ? new Date(newTest.endTime).toISOString() : null,
          isProctored: newTest.isProctored,
          shuffleQuestions: newTest.shuffleQuestions,
          shuffleOptions: newTest.shuffleOptions,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Failed to create test")
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-tests', 'lecturer'] })
      setShowCreateDialog(false)
      toast({ title: "Test created successfully" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const updateTestMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<OnlineTest> }) => {
      const res = await fetch(`/api/online-tests/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to update test')
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-tests', 'lecturer'] })
      if (selectedTest) setSelectedTest(prev => prev ? { ...prev, ...selectedTest } : null)
      toast({ title: "Test updated successfully" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const deleteTestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/online-tests/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error("Failed to delete test")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-tests', 'lecturer'] })
      if (selectedTest?.id === selectedTest?.id) setSelectedTest(null)
      toast({ title: "Test deleted" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const publishTestMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const res = await fetch(`/api/online-tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      })
      if (!res.ok) throw new Error("Failed to update test")
      return { success: true, isPublished }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['online-tests', 'lecturer'] })
      toast({ title: `Test ${data.isPublished ? 'published' : 'unpublished'}` })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage online assessments</p>
        </div>
        <Card>
          <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading tests...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage online assessments</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="py-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load tests</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchTests()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const publishedTests = tests.filter(t => t.isPublished)
  const draftTests = tests.filter(t => !t.isPublished)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage online assessments</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Test</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTestMutation.mutate() }} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={newTest.subjectId} onValueChange={v => setNewTest(prev => ({ ...prev, subjectId: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjectsData?.subjects?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Test Title</Label>
                <Input placeholder="e.g., Midterm Exam - Physics" value={newTest.title} onChange={e => setNewTest(prev => ({ ...prev, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Test description..." value={newTest.description} onChange={e => setNewTest(prev => ({ ...prev, description: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea placeholder="Instructions for students..." value={newTest.instructions} onChange={e => setNewTest(prev => ({ ...prev, instructions: e.target.value }))} rows={3} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input type="number" min="1" value={newTest.durationMinutes} onChange={e => setNewTest(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" min="1" value={newTest.totalMarks} onChange={e => setNewTest(prev => ({ ...prev, totalMarks: Number(e.target.value) }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Passing Marks (optional)</Label>
                  <Input type="number" min="0" value={newTest.passingMarks} onChange={e => setNewTest(prev => ({ ...prev, passingMarks: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Test Type</Label>
                  <Select value={newTest.testType} onValueChange={v => setNewTest(prev => ({ ...prev, testType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">Multiple Choice</SelectItem>
                      <SelectItem value="WRITTEN">Written/Descriptive</SelectItem>
                      <SelectItem value="MIXED">Mixed Format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Negative Marking</Label>
                  <Input type="number" min="0" step="0.25" value={newTest.negativeMarking} onChange={e => setNewTest(prev => ({ ...prev, negativeMarking: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input type="number" min="1" max="10" value={newTest.maxAttempts} onChange={e => setNewTest(prev => ({ ...prev, maxAttempts: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time (optional)</Label>
                  <Input type="datetime-local" value={newTest.startTime} onChange={e => setNewTest(prev => ({ ...prev, startTime: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>End Time (optional)</Label>
                  <Input type="datetime-local" value={newTest.endTime} onChange={e => setNewTest(prev => ({ ...prev, endTime: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={newTest.isProctored} onChange={e => setNewTest(prev => ({ ...prev, isProctored: e.target.checked }))} className="h-4 w-4 rounded border-primary" />
                  <span>Enable Proctoring (5-warning auto-submit)</span>
                </Label>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={newTest.shuffleQuestions} onChange={e => setNewTest(prev => ({ ...prev, shuffleQuestions: e.target.checked }))} className="h-4 w-4 rounded border-primary" />
                  <span>Shuffle Questions</span>
                </Label>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={newTest.shuffleOptions} onChange={e => setNewTest(prev => ({ ...prev, shuffleOptions: e.target.checked }))} className="h-4 w-4 rounded border-primary" />
                  <span>Shuffle Options</span>
                </Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createTestMutation.isPending}>
                  {createTestMutation.isPending ? "Creating..." : "Create Test"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tests">Tests ({tests.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-4">
          <div className="space-y-8">
            {/* Published Tests */}
            {publishedTests.length > 0 && (
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Published Tests ({publishedTests.length})</h2>
                  <Badge variant="success" className="text-sm">Live</Badge>
                </div>
                <div className="space-y-4">
                  {publishedTests.map((test: OnlineTest) => (
                    <TestCard 
                      key={test.id} 
                      test={test} 
                      onSelect={() => setSelectedTest(test)}
                      onEdit={() => { setSelectedTest(test); setShowQuestionsEditor(true) }}
                      onAttempts={() => { setSelectedTest(test); setShowAttemptsDialog(true) }}
                      onDelete={() => deleteTestMutation.mutate(test.id)}
                      onTogglePublish={() => publishTestMutation.mutate({ id: test.id, isPublished: false })}
                      isPublished={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Draft Tests */}
            {draftTests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Draft Tests ({draftTests.length})</h2>
                  <Badge variant="secondary" className="text-sm">Draft</Badge>
                </div>
                <div className="space-y-4">
                  {draftTests.map((test: OnlineTest) => (
                    <TestCard 
                      key={test.id} 
                      test={test} 
                      onSelect={() => setSelectedTest(test)}
                      onEdit={() => { setSelectedTest(test); setShowQuestionsEditor(true) }}
                      onAttempts={() => { setSelectedTest(test); setShowAttemptsDialog(true) }}
                      onDelete={() => deleteTestMutation.mutate(test.id)}
                      onTogglePublish={() => publishTestMutation.mutate({ id: test.id, isPublished: true })}
                      isPublished={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {tests.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No tests created yet</h3>
                  <p className="text-muted-foreground mt-2">Click "Create Test" to build your first online assessment.</p>
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Test
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{tests.length}</div>
                <p className="text-sm text-muted-foreground">{publishedTests.length} published, {draftTests.length} drafts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
                <HelpCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {tests.reduce((sum, t) => sum + t._count.questions, 0)}
                </div>
                <p className="text-sm text-muted-foreground">Across all tests</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {tests.reduce((sum, t) => sum + t._count.attempts, 0)}
                </div>
                <p className="text-sm text-muted-foreground">Student submissions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Proctored Tests</CardTitle>
                <Shield className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {tests.filter(t => t.isProctored).length}
                </div>
                <p className="text-sm text-muted-foreground">With integrity monitoring</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Test Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test: OnlineTest) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">{test.title}</TableCell>
                      <TableCell>{test.subject.code} - {test.subject.name}</TableCell>
                      <TableCell><Badge variant="outline">{test.testType}</Badge></TableCell>
                      <TableCell>{test._count.questions}</TableCell>
                      <TableCell>{test.durationMinutes} min</TableCell>
                      <TableCell>{test._count.attempts}</TableCell>
                      <TableCell>
                        <Badge variant={test.isPublished ? 'success' : 'secondary'}>
                          {test.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Questions Editor Dialog */}
      <Dialog open={showQuestionsEditor && !!selectedTest} onOpenChange={(open) => { if (!open) { setShowQuestionsEditor(false); setSelectedTest(null) }} }>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          {selectedTest && (
            <TestQuestionEditor 
              test={selectedTest} 
              onClose={() => { setShowQuestionsEditor(false); setSelectedTest(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Attempts Dialog */}
      <Dialog open={showAttemptsDialog && !!selectedTest} onOpenChange={(open) => { if (!open) { setShowAttemptsDialog(false); setSelectedTest(null) }} }>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {selectedTest && (
            <TestAttemptsViewer 
              test={selectedTest} 
              onClose={() => { setShowAttemptsDialog(false); setSelectedTest(null) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TestCard({ test, onSelect, onEdit, onAttempts, onDelete, onTogglePublish, isPublished }: { 
  test: OnlineTest; 
  onSelect: () => void; 
  onEdit: () => void; 
  onAttempts: () => void; 
  onDelete: () => void; 
  onTogglePublish: () => void; 
  isPublished: boolean 
}) {
  return (
    <Card className="hover:shadow-md transition-shadow" onClick={onSelect}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="truncate">{test.title}</CardTitle>
            <Badge variant={isPublished ? 'success' : 'secondary'} className="text-xs">
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
            <Badge variant="outline" className="text-xs">{test.testType}</Badge>
            {test.isProctored && <Badge variant="secondary" className="text-xs">Proctored</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {test.subject.code} - {test.subject.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
            <span>{test.durationMinutes} min</span>
            <span>{test.totalMarks} marks</span>
            <span>{test._count.questions} questions</span>
            <span>{test._count.attempts} attempts</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {test.negativeMarking > 0 && (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3" />
                Negative: {test.negativeMarking}
              </Badge>
            )}
            {test.passingMarks && (
              <Badge variant="outline" className="gap-1">
                <Award className="h-3 w-3" />
                Passing: {test.passingMarks}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              Max {test.maxAttempts} attempt{test.maxAttempts > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit() }}>
              <Edit className="mr-2 h-4 w-4" />
              Questions
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onAttempts() }}>
              <Users className="mr-2 h-4 w-4" />
              Attempts
            </Button>
            <Button 
              variant={isPublished ? 'outline' : 'default'} 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onTogglePublish() }}
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-destructive hover:text-destructive" 
              onClick={(e) => { e.stopPropagation(); if (confirm('Delete this test?')) onDelete() }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TestAttemptsViewer({ test, onClose }: { test: OnlineTest; onClose: () => void }) {
  const [attempts, setAttempts] = React.useState<AttemptSummary[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await fetch(`/api/online-tests/${test.id}/attempts`)
        if (res.ok) {
          const data = await res.json()
          setAttempts(data.attempts || [])
        }
      } catch (error) {
        console.error('Failed to fetch attempts:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAttempts()
  }, [test.id])

  const getStatusBadge = (status: string, autoSubmitted: boolean) => {
    if (autoSubmitted) return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Auto-submitted</Badge>
    switch (status) {
      case 'SUBMITTED': return <Badge variant="default">Submitted</Badge>
      case 'GRADED': return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Graded</Badge>
      case 'AUTO_SUBMITTED': return <Badge variant="destructive">Auto-submitted</Badge>
      case 'IN_PROGRESS': return <Badge variant="warning">In Progress</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">{test.title} - Attempts</h2>
          <p className="text-sm text-muted-foreground">{attempts.length} total attempts</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="mr-2 h-4 w-4" />
          Close
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No attempts yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt: AttemptSummary) => (
                <TableRow key={attempt.id}>
                  <TableCell className="font-medium">{attempt.user.firstName} {attempt.user.lastName}</TableCell>
                  <TableCell>{attempt.user.studentId || 'N/A'}</TableCell>
                  <TableCell>#{attempt.attemptNumber}</TableCell>
                  <TableCell>{getStatusBadge(attempt.status, attempt.autoSubmitted)}</TableCell>
                  <TableCell>{formatRelativeTime(attempt.startedAt)}</TableCell>
                  <TableCell>{attempt.submittedAt ? formatRelativeTime(attempt.submittedAt) : '-'}</TableCell>
                  <TableCell>{attempt.timeRemaining ? `${Math.floor(attempt.timeRemaining / 60)}:${String(attempt.timeRemaining % 60).padStart(2, '0')}` : '-'}</TableCell>
                  <TableCell>
                    {attempt.obtainedMarks !== null 
                      ? `${attempt.obtainedMarks}/${attempt.totalMarks} (${((attempt.obtainedMarks / attempt.totalMarks) * 100).toFixed(1)}%)`
                      : 'Pending'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={attempt.integrityWarnings > 0 ? 'destructive' : 'secondary'}>
                      {attempt.integrityWarnings} warning{attempt.integrityWarnings !== 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}