"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Play, 
  Clock, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  RefreshCw,
  ListChecks,
  FileText,
  Settings,
  History,
} from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { TestPlayer } from "@/components/online-tests/TestPlayer"
import type { TestQuestion } from "@/components/online-tests/TestPlayer"

interface OnlineTest {
  id: string
  subjectId: string
  title: string
  description: string | null
  instructions: string | null
  durationMinutes: number
  totalMarks: number
  passingMarks: number | null
  testType: string
  negativeMarking: number
  maxAttempts: number
  startTime: string | null
  endTime: string | null
  isPublished: boolean
  isProctored: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  subject: { id: string; name: string; code: string }
  _count: { questions: number; attempts: number }
  userAttempts?: Array<{
    id: string
    status: string
    attemptNumber: number
    obtainedMarks: number | null
    submittedAt: string | null
  }>
  canAttempt: boolean
  questions: TestQuestion[]
}

export default function OnlineTestsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("available")
  const [selectedTest, setSelectedTest] = React.useState<OnlineTest | null>(null)
  const [showTestPlayer, setShowTestPlayer] = React.useState(false)
  const [playerTestId, setPlayerTestId] = React.useState<string | null>(null)

  const { data: testsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['online-tests'],
    queryFn: async () => {
      const res = await fetch('/api/online-tests')
      if (!res.ok) throw new Error('Failed to fetch tests')
      return res.json()
    },
  })

  const tests: OnlineTest[] = testsData?.tests || []

  const availableTests = tests.filter(t => t.canAttempt && t.isPublished)
  const inProgressTests = tests.filter(t => 
    t.userAttempts?.some(a => a.status === 'IN_PROGRESS')
  )
  const completedTests = tests.filter(t => 
    t.userAttempts?.some(a => ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'].includes(a.status))
  )

  const startTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/online-tests/${testId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start test')
      return data
    },
    onSuccess: (data) => {
      setPlayerTestId(data.test.id)
      setShowTestPlayer(true)
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleStartTest = (test: OnlineTest) => {
    startTestMutation.mutate(test.id)
  }

  const handleTestComplete = () => {
    setShowTestPlayer(false)
    setPlayerTestId(null)
    queryClient.invalidateQueries({ queryKey: ['online-tests'] })
    setActiveTab("completed")
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Online Tests</h1>
          <p className="text-muted-foreground mt-1">Take assessments and track your performance</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Online Tests</h1>
          <p className="text-muted-foreground mt-1">Take assessments and track your performance</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 p-4">
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Failed to load tests</h3>
                <p className="text-muted-foreground mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showTestPlayer && playerTestId) {
    const test = tests.find(t => t.id === playerTestId)
    return (
      <TestPlayer
        test={test!}
        onComplete={handleTestComplete}
        onExit={() => {
          setShowTestPlayer(false)
          setPlayerTestId(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Online Tests</h1>
          <p className="text-muted-foreground mt-1">Take assessments and track your performance</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="available">
            Available ({availableTests.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressTests.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          {availableTests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Award className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No available tests</h3>
                <p className="text-muted-foreground mt-2">Check back later for new assessments.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {availableTests.map((test: OnlineTest) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="truncate">{test.title}</CardTitle>
                        <Badge variant="outline" className="text-xs">{test.testType}</Badge>
                        {test.isProctored && (
                          <Badge variant="secondary" className="text-xs">
                            <Settings className="mr-1 h-3 w-3" />
                            Proctored
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {test.subject.code} - {test.subject.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                        <span>{test.durationMinutes} min</span>
                        <span>{test.totalMarks} marks</span>
                        <span>{test._count.questions} questions</span>
                        <span>Max {test.maxAttempts} attempt{test.maxAttempts > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {test.description && (
                      <p className="text-sm text-muted-foreground">{test.description}</p>
                    )}
                    {test.instructions && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm mb-1">Instructions:</p>
                        <p className="text-sm text-muted-foreground">{test.instructions}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {test.negativeMarking > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Negative marking: {test.negativeMarking} marks
                          </Badge>
                        )}
                        {test.passingMarks && (
                          <Badge variant="outline" className="gap-1">
                            <Award className="h-3 w-3" />
                            Passing: {test.passingMarks}/{test.totalMarks}
                          </Badge>
                        )}
                      </div>
                      <Button 
                        onClick={() => handleStartTest(test)}
                        disabled={startTestMutation.isPending}
                        className="gap-2"
                      >
                        {startTestMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Start Test
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="mt-4">
          {inProgressTests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No tests in progress</h3>
                <p className="text-muted-foreground mt-2">Start a test from the Available tab to see it here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {inProgressTests.map((test: OnlineTest) => {
                const inProgressAttempt = test.userAttempts?.find(a => a.status === 'IN_PROGRESS')
                return (
                  <Card key={test.id} className="border-amber-200">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="truncate">{test.title}</CardTitle>
                          <Badge variant="default" className="text-xs">In Progress</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {test.subject.code} - {test.subject.name}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-amber-800">
                            Attempt #{inProgressAttempt?.attemptNumber} in progress
                          </span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Your answers are being saved automatically. You can resume this test anytime.
                        </p>
                      </div>
                      <Button 
                        onClick={() => handleStartTest(test)}
                        className="w-full gap-2"
                        variant="default"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Resume Test
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedTests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No completed tests yet</h3>
                <p className="text-muted-foreground mt-2">Completed tests will appear here after submission.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedTests.map((test: OnlineTest) => {
                const completedAttempts = test.userAttempts?.filter(a => 
                  ['SUBMITTED', 'AUTO_SUBMITTED', 'GRADED'].includes(a.status)
                ) || []
                const latestAttempt = completedAttempts.sort((a, b) => 
                  new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
                )[0]
                const isGraded = latestAttempt?.status === 'GRADED'
                const isAutoSubmitted = latestAttempt?.status === 'AUTO_SUBMITTED'
                
                return (
                  <Card key={test.id} className={isAutoSubmitted ? 'border-destructive/50' : ''}>
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="truncate">{test.title}</CardTitle>
                          {isAutoSubmitted && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <XCircle className="h-3 w-3" />
                              Auto-submitted (5 warnings)
                            </Badge>
                          )}
                          {isGraded && (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Graded
                            </Badge>
                          )}
                          {!isGraded && !isAutoSubmitted && (
                            <Badge variant="secondary" className="text-xs">Submitted</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {test.subject.code} - {test.subject.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 text-right">
                        <div className="flex flex-col items-end gap-1 text-sm">
                          {isGraded && latestAttempt?.obtainedMarks !== null && (
                            <span className="font-semibold text-lg text-primary">
                              {latestAttempt.obtainedMarks}/{test.totalMarks}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {formatRelativeTime(latestAttempt?.submittedAt || test.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{test._count.questions} questions</span>
                          <span>•</span>
                          <span>{test.durationMinutes} min</span>
                          <span>•</span>
                          <span>Attempt #{latestAttempt?.attemptNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isGraded && latestAttempt?.obtainedMarks !== null && (
                            <Badge variant="outline" className="gap-1">
                              <Award className="h-3 w-3" />
                              {((latestAttempt.obtainedMarks / test.totalMarks) * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      {test.instructions && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium text-sm mb-1">Instructions:</p>
                          <p className="text-sm text-muted-foreground">{test.instructions}</p>
                        </div>
                      )}
                      {(test.maxAttempts > (completedAttempts?.length || 0) || !isGraded) && (
                        <Button 
                          onClick={() => handleStartTest(test)}
                          variant="outline"
                          className="gap-2"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {isGraded ? 'Retake Test' : 'Attempt Again'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}