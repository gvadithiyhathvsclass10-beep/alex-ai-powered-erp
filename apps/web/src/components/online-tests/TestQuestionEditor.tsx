"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { 
  Plus, 
  Edit, 
  Trash2, 
  GripVertical, 
  ChevronUp, 
  ChevronDown,
  Save,
  X,
  Copy,
  CheckCircle2,
  FileText,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface TestQuestion {
  id: string
  testId: string
  questionNumber: number
  type: 'SINGLE_CORRECT' | 'MULTIPLE_SELECT' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'NUMERICAL'
  prompt: string
  options: string[] | null
  correctAnswer: any
  marks: number
  negativeMarks: number
  explanation: string | null
  unit: string | null
  topic: string | null
  difficulty: string | null
  order: number
  createdAt: string
  updatedAt: string
}

interface OnlineTest {
  id: string
  title: string
  testType: string
  questions: TestQuestion[]
}

interface TestQuestionEditorProps {
  test: OnlineTest
  onClose: () => void
}

export function TestQuestionEditor({ test, onClose }: TestQuestionEditorProps) {
  const queryClient = useQueryClient()
  const [questions, setQuestions] = React.useState<TestQuestion[]>(test.questions || [])
  const [editingQuestion, setEditingQuestion] = React.useState<TestQuestion | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [newQuestion, setNewQuestion] = React.useState<Partial<TestQuestion>>({
    type: 'SINGLE_CORRECT',
    prompt: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    marks: 1,
    negativeMarks: 0,
    explanation: '',
    unit: '',
    topic: '',
    difficulty: 'MEDIUM',
  })
  const [newOptions, setNewOptions] = React.useState<string[]>(['', '', '', ''])

  const createQuestionMutation = useMutation({
    mutationFn: async (data: Partial<TestQuestion>) => {
      const res = await fetch(`/api/online-tests/${test.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to create question')
      return payload
    },
    onSuccess: (data) => {
      setQuestions(prev => [...prev, data.question].sort((a, b) => a.order - b.order))
      setShowCreateDialog(false)
      resetNewQuestion()
      toast({ title: "Question added successfully" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<TestQuestion> }) => {
      const res = await fetch(`/api/online-tests/${test.id}/questions/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates),
      })
      if (!res.ok) throw new Error('Failed to update question')
      return res.json()
    },
    onSuccess: () => {
      setEditingQuestion(null)
      queryClient.invalidateQueries({ queryKey: ['online-tests', test.id] })
      toast({ title: "Question updated successfully" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/online-tests/${test.id}/questions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete question')
      return res.json()
    },
    onSuccess: () => {
      setQuestions(prev => prev.filter(q => q.id !== editingQuestion?.id))
      setEditingQuestion(null)
      toast({ title: "Question deleted" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const reorderQuestionsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(`/api/online-tests/${test.id}/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      })
      if (!res.ok) throw new Error('Failed to reorder questions')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-tests', test.id] })
      toast({ title: "Questions reordered" })
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const resetNewQuestion = () => {
    setNewQuestion({
      type: 'SINGLE_CORRECT',
      prompt: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0,
      explanation: '',
      unit: '',
      topic: '',
      difficulty: 'MEDIUM',
    })
    setNewOptions(['', '', '', ''])
  }

  const handleCreateQuestion = () => {
    const questionData = {
      ...newQuestion,
      options: newQuestion.type === 'SINGLE_CORRECT' || newQuestion.type === 'MULTIPLE_SELECT' 
        ? newOptions.filter(o => o.trim()) 
        : null,
      correctAnswer: newQuestion.type === 'MULTIPLE_SELECT' 
        ? (newQuestion.correctAnswer as number[]) 
        : newQuestion.correctAnswer,
      order: questions.length,
    }
    createQuestionMutation.mutate(questionData as any)
  }

  const handleUpdateQuestion = (updates: Partial<TestQuestion>) => {
    if (!editingQuestion) return
    updateQuestionMutation.mutate({ id: editingQuestion.id, updates })
  }

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === id)
    if (index === -1) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return
    
    const newQuestions = [...questions]
    const [moved] = newQuestions.splice(index, 1)
    newQuestions.splice(newIndex, 0, moved)
    setQuestions(newQuestions)
    
    // Update order numbers
    const updated = newQuestions.map((q, i) => ({ id: q.id, order: i }))
    reorderQuestionsMutation.mutate(updated.map(u => u.id))
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SINGLE_CORRECT': return 'Single Correct'
      case 'MULTIPLE_SELECT': return 'Multiple Select'
      case 'SHORT_ANSWER': return 'Short Answer'
      case 'LONG_ANSWER': return 'Long Answer'
      case 'NUMERICAL': return 'Numerical'
      default: return type
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SINGLE_CORRECT': return <Badge variant="default">Single Correct</Badge>
      case 'MULTIPLE_SELECT': return <Badge variant="secondary">Multiple Select</Badge>
      case 'SHORT_ANSWER': return <Badge variant="outline">Short Answer</Badge>
      case 'LONG_ANSWER': return <Badge variant="outline">Long Answer</Badge>
      case 'NUMERICAL': return <Badge variant="destructive">Numerical</Badge>
      default: return <Badge variant="secondary">{type}</Badge>
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">{test.title} - Questions</h2>
          <p className="text-sm text-muted-foreground">{questions.length} questions • {test.testType} test</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Done
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-auto p-4">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <h3 className="text-lg font-medium">No questions yet</h3>
            <p className="text-sm mt-1">Click "Add Question" to create your first question.</p>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Add First Question
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-20">Marks</TableHead>
                <TableHead className="w-20">Neg. Marks</TableHead>
                <TableHead className="w-28">Difficulty</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question, index) => (
                <TableRow key={question.id}>
                  <TableCell className="font-medium text-center">{index + 1}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(question.type)}
                      <span className="max-w-[300px] truncate text-sm">{question.prompt}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(question.type)}</TableCell>
                  <TableCell className="font-medium">{question.marks}</TableCell>
                  <TableCell>{question.negativeMarks > 0 ? question.negativeMarks : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={question.difficulty === 'HARD' ? 'destructive' : question.difficulty === 'EASY' ? 'success' : 'warning'} className="text-xs">
                      {question.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(question.id, 'up')} disabled={index === 0}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(question.id, 'down')} disabled={index === questions.length - 1}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingQuestion(questions[index])}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm('Delete this question?')) {
                          // Delete would need an API endpoint
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Empty state for no questions handled above */}
      </div>

      {/* Create Question Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Question</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateQuestion() }} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={newQuestion.type} onValueChange={v => setNewQuestion(prev => ({ ...prev, type: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_CORRECT">Single Correct (MCQ)</SelectItem>
                  <SelectItem value="MULTIPLE_SELECT">Multiple Select</SelectItem>
                  <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                  <SelectItem value="LONG_ANSWER">Long Answer / Essay</SelectItem>
                  <SelectItem value="NUMERICAL">Numerical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question Prompt</Label>
              <Textarea 
                placeholder="Enter the question text..." 
                value={newQuestion.prompt} 
                onChange={e => setNewQuestion(prev => ({ ...prev, prompt: e.target.value }))}
                rows={3}
                required
              />
            </div>

            {['SINGLE_CORRECT', 'MULTIPLE_SELECT'].includes(newQuestion.type) && (
              <div className="space-y-2">
                <Label>Options (minimum 2)</Label>
                <div className="space-y-2">
                  {newOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-center text-sm font-medium text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={e => {
                          const newOpts = [...newOptions]
                          newOpts[i] = e.target.value
                          setNewOptions(newOpts)
                        }}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewOptions(prev => [...prev, ''])} disabled={newOptions.length >= 6}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Option
                  </Button>
                  {newOptions.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNewOptions(prev => prev.slice(0, -1))}>
                      Remove Last
                    </Button>
                  )}
                </div>
              </div>
            )}

            {['SINGLE_CORRECT', 'MULTIPLE_SELECT'].includes(newQuestion.type) && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select value={String(newQuestion.correctAnswer)} onValueChange={v => setNewQuestion(prev => ({ ...prev, correctAnswer: newQuestion.type === 'MULTIPLE_SELECT' ? (prev.correctAnswer as number[]).includes(parseInt(v)) ? (prev.correctAnswer as number[]).filter(n => n !== parseInt(v)) : [...(prev.correctAnswer as number[]), parseInt(v)] : parseInt(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Select correct option(s)" /></SelectTrigger>
                  <SelectContent>
                    {newOptions.filter(o => o.trim()).map((opt, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String.fromCharCode(65 + i)}: {opt.slice(0, 50)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input type="number" min="1" value={newQuestion.marks} onChange={e => setNewQuestion(prev => ({ ...prev, marks: Number(e.target.value) }))} required />
              </div>
              <div className="space-y-2">
                <Label>Negative Marks</Label>
                <Input type="number" min="0" step="0.25" value={newQuestion.negativeMarks} onChange={e => setNewQuestion(prev => ({ ...prev, negativeMarks: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={newQuestion.difficulty} onValueChange={v => setNewQuestion(prev => ({ ...prev, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input placeholder="e.g., Unit 1: Mechanics" value={newQuestion.unit} onChange={e => setNewQuestion(prev => ({ ...prev, unit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input placeholder="e.g., Newton's Laws" value={newQuestion.topic} onChange={e => setNewQuestion(prev => ({ ...prev, topic: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Explanation (shown after submission)</Label>
              <Textarea placeholder="Explanation for the correct answer..." value={newQuestion.explanation} onChange={e => setNewQuestion(prev => ({ ...prev, explanation: e.target.value }))} rows={2} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetNewQuestion() }}>Cancel</Button>
              <Button type="submit" disabled={createQuestionMutation.isPending || !newQuestion.prompt.trim()}>
                {createQuestionMutation.isPending ? "Adding..." : "Add Question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={open => !open && setEditingQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateQuestion({ ...editingQuestion, ...newQuestion }) }} className="space-y-4 p-4">
              <div className="space-y-2">
                <Label>Question Prompt</Label>
                <Textarea 
                  value={editingQuestion.prompt} 
                  onChange={e => setEditingQuestion(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                  rows={3}
                  required
                />
              </div>

              {['SINGLE_CORRECT', 'MULTIPLE_SELECT'].includes(editingQuestion.type) && editingQuestion.options && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    {editingQuestion.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-center text-sm font-medium text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                        <Input
                          value={opt}
                          onChange={e => {
                            const newOpts = [...editingQuestion.options!]
                            newOpts[i] = e.target.value
                            setEditingQuestion(prev => prev ? { ...prev, options: newOpts } : null)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Marks</Label>
                  <Input type="number" min="1" value={editingQuestion.marks} onChange={e => setEditingQuestion(prev => prev ? { ...prev, marks: Number(e.target.value) } : null)} />
                </div>
                <div className="space-y-2">
                  <Label>Negative Marks</Label>
                  <Input type="number" min="0" step="0.25" value={editingQuestion.negativeMarks} onChange={e => setEditingQuestion(prev => prev ? { ...prev, negativeMarks: Number(e.target.value) } : null)} />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={editingQuestion.difficulty} onValueChange={v => setEditingQuestion(prev => prev ? { ...prev, difficulty: v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HARD">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={editingQuestion.unit} onChange={e => setEditingQuestion(prev => prev ? { ...prev, unit: e.target.value } : null)} />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input value={editingQuestion.topic} onChange={e => setEditingQuestion(prev => prev ? { ...prev, topic: e.target.value } : null)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Explanation</Label>
                <Textarea value={editingQuestion.explanation} onChange={e => setEditingQuestion(prev => prev ? { ...prev, explanation: e.target.value } : null)} rows={2} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingQuestion(null)}>Cancel</Button>
                <Button type="submit" disabled={updateQuestionMutation.isPending}>
                  {updateQuestionMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'SINGLE_CORRECT': return <Badge variant="default">Single Correct</Badge>
    case 'MULTIPLE_SELECT': return <Badge variant="secondary">Multiple Select</Badge>
    case 'SHORT_ANSWER': return <Badge variant="outline">Short Answer</Badge>
    case 'LONG_ANSWER': return <Badge variant="outline">Long Answer</Badge>
    case 'NUMERICAL': return <Badge variant="destructive">Numerical</Badge>
    default: return <Badge variant="secondary">{type}</Badge>
  }
}

function resetNewQuestion() {
  // This function is called from the parent component
}