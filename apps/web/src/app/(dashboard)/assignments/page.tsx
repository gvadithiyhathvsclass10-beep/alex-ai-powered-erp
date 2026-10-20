"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { DocumentUpload } from "@/components/documents/document-upload"
import { Plus, CheckCircle, XCircle, AlertCircle, Calendar, Download, FileText, Clock, Upload } from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Assignment {
  id: string
  subjectId: string
  title: string
  description: string | null
  instructions: string | null
  maxMarks: number
  weight: number
  assignedDate: string
  dueDate: string
  allowedFormats: string[]
  allowResubmission: boolean
  maxSubmissions: number
  isPublished: boolean
  subject: { id: string; name: string; code: string }
  _count: { submissions: number }
}

interface Submission {
  id: string
  assignmentId: string
  userId: string
  status: string
  submissionNumber: number
  content: string | null
  submittedAt: string | null
  gradedAt: string | null
  marksObtained: number | null
  feedback: string | null
  user: { id: string; firstName: string; lastName: string }
  attachments: { id: string; fileName: string; storagePath: string }[]
}

export default function AssignmentsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("my-assignments")
  const [selectedAssignment, setSelectedAssignment] = React.useState<string | null>(null)

  const { data: assignments } = useQuery({
    queryKey: ['assignments', 'my'],
    queryFn: async () => {
      const res = await fetch('/api/assignments/my')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: submissions } = useQuery({
    queryKey: ['assignment-submissions', selectedAssignment],
    queryFn: async () => {
      if (!selectedAssignment) return { submissions: [] }
      const res = await fetch(`/api/assignments/${selectedAssignment}/submissions`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedAssignment,
  })

  const submitAssignment = useMutation({
    mutationFn: async (data: { assignmentId: string; content: string; files: File[] }) => {
      const formData = new FormData()
      formData.append('assignmentId', data.assignmentId)
      formData.append('content', data.content)
      data.files.forEach(f => formData.append('files', f))
      
      const res = await fetch('/api/assignments/submit', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to submit')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', selectedAssignment] })
      toast({ title: "Assignment submitted" })
    },
    onError: () => toast({ title: "Error", description: "Failed to submit assignment", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground mt-1">Manage your coursework and submissions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="my-assignments">My Assignments</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="my-assignments" className="mt-4">
          <div className="space-y-4">
            {assignments?.assignments?.map((assignment: Assignment) => {
              const isOverdue = new Date(assignment.dueDate) < new Date()
              const isSubmitted = assignment._count.submissions > 0
              
              return (
                <Card key={assignment.id} className={isOverdue && !isSubmitted ? 'border-red-200' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{assignment.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{assignment.subject.code} - {assignment.subject.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isOverdue && !isSubmitted ? 'destructive' : isSubmitted ? 'success' : 'warning'}>
                        {isOverdue && !isSubmitted ? 'Overdue' : isSubmitted ? 'Submitted' : 'Pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assignment.description && <p className="text-sm text-muted-foreground">{assignment.description}</p>}
                      {assignment.instructions && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm">Instructions:</p>
                          <p className="text-sm text-muted-foreground mt-1">{assignment.instructions}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Max: {assignment.maxMarks} marks</span>
                        <span>•</span>
                        <span>Weight: {assignment.weight}x</span>
                        <span>•</span>
                        <span>Due: {formatDate(assignment.dueDate)}</span>
                        {isOverdue && !isSubmitted && <span className="text-red-500">OVERDUE</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => setSelectedAssignment(assignment.id)} disabled={isSubmitted}>
                          {isSubmitted ? 'View Submission' : 'Submit Assignment'}
                        </Button>
                        <Button variant="outline" onClick={() => {}}>View Details</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {selectedAssignment ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Submissions for {assignments?.assignments?.find((a: Assignment) => a.id === selectedAssignment)?.title}</h2>
              </div>
              <Card>
                <CardContent className="pt-0">
                  {submissions?.submissions?.length === 0 ? (
                    <div className="p-8 text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No submissions yet</p>
                      <div className="mt-4 space-y-4">
                        <Textarea placeholder="Your submission content..." rows={6} className="max-w-md mx-auto" />
                        <DocumentUpload />
                        <Button onClick={() => {}}>
                          <Upload className="mr-2 h-4 w-4" />
                          Submit Assignment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissions?.submissions?.map((submission: Submission) => (
                        <div key={submission.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant={
                              submission.status === 'SUBMITTED' ? 'default' :
                              submission.status === 'LATE' ? 'warning' :
                              submission.status === 'EVALUATED' ? 'success' : 'outline'
                            }>
                              {submission.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Attempt {submission.submissionNumber} · {formatRelativeTime(submission.submittedAt!)}
                            </span>
                          </div>
                          {submission.content && (
                            <div className="prose mb-4">{submission.content}</div>
                          )}
                          {submission.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {submission.attachments.map((att) => (
                                <Badge key={att.id} variant="outline">{att.fileName}</Badge>
                              ))}
                            </div>
                          )}
                          {submission.marksObtained !== null && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="font-medium">Grade: {submission.marksObtained} / {assignments?.assignments?.find((a: Assignment) => a.id === selectedAssignment)?.maxMarks || 100}</p>
                              {submission.feedback && <p className="text-sm text-muted-foreground mt-1">{submission.feedback}</p>}
                            </div>
                          )}
                          {submission.status !== 'EVALUATED' && assignments?.assignments?.find((a: Assignment) => a.id === selectedAssignment)?.allowResubmission && (
                            <Button variant="outline" onClick={() => {}}>Resubmit</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Select an assignment to view your submissions</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}