"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Timer,
  Award,
  AlertCircle,
  CheckCircle,
  Flag,
  Save,
  LayoutDashboard,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { IntegrityMonitor } from "./IntegrityMonitor"

export interface TestQuestion {
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

export interface OnlineTest {
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
  subject: { id: string; name: string; code: string } | null
  _count: { questions: number; attempts: number }
  questions: TestQuestion[]
}

interface TestAttemptData {
  attempt: {
    id: string
    status: string
    timeRemaining: number
    obtainedMarks: number | null
  }
  test: {
    id: string
    title: string
    durationMinutes: number
    totalMarks: number
    testType: string
    negativeMarking: number
    maxAttempts: number
    isProctored: boolean
    isPublished: boolean
    subject: { id: string; name: string; code: string } | null
    _count: { questions: number; attempts: number }
    questions: TestQuestion[]
  }
  isNewAttempt: boolean
}

interface TestPlayerProps {
  test: OnlineTest
  onComplete: () => void
  onExit: () => void
}



function LoadingState() {
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Loading test...</span>
      </div>
    </div>
  )
}

function SubmittedState({ isAutoSubmitted, onComplete }: { isAutoSubmitted: boolean; onComplete: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {false ? "Test Auto-Submitted" : "Test Submitted Successfully"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {false 
                ? "Your test was automatically submitted. Your answers have been saved."
                : "Your test has been submitted and is being processed."}
            </p>
            <Button onClick={() => {}} className="w-full" size="lg">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function TestPlayer({ test, onComplete, onExit }: TestPlayerProps) {
  const queryClient = useQueryClient()
  const [attemptData, setAttemptData] = React.useState<TestAttemptData | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, any>>({})
  const [timeRemaining, setTimeRemaining] = React.useState<number>(test.durationMinutes * 60)
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [isAutoSubmitted, setIsAutoSubmitted] = React.useState(false)
  const [warningsCount, setWarningsCount] = React.useState(0)
  const [showExitConfirm, setShowExitConfirm] = React.useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [showWarningModal, setShowWarningModal] = React.useState<{type: string, count: number} | null>(null)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const question = test.questions[currentQuestionIndex]
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== null && answers[k] !== '' && (Array.isArray(answers[k]) ? answers[k].length > 0 : true)).length
  const progress = (answeredCount / test.questions.length) * 100

  // Initialize attempt on mount
  React.useEffect(() => {
    const initAttempt = async () => {
      const res = await fetch(`/api/online-tests/${test.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start test')
      setAttemptData(data)
      setTimeRemaining(data.attempt.timeRemaining)
    }
    initAttempt()
  }, [test.id])

  // Timer countdown
  React.useEffect(() => {
    if (isSubmitted || isAutoSubmitted || !attemptData) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoSubmit('TIME_EXPIRED')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isSubmitted, isAutoSubmitted, attemptData])

  // Auto-save answers every 10 seconds
  React.useEffect(() => {
    if (isSubmitted || isAutoSubmitted || !attemptData) return

    const interval = setInterval(() => {
      saveAnswer(question.id, answers[question.id])
    }, 10000)

    return () => clearInterval(interval)
  }, [question.id, answers, attemptData])

  // Integrity monitoring - listen for warnings
  React.useEffect(() => {
    const handleWarning = (event: CustomEvent) => {
      const { warningType, warningsCount: count, autoSubmitted } = event.detail
      setWarningsCount(count)
      setShowWarningModal({ type: warningType, count })
      
      if (autoSubmitted) {
        setIsAutoSubmitted(true)
        handleAutoSubmit('INTEGRITY_VIOLATION')
      }
    }

    window.addEventListener('integrity-warning', handleWarning as EventListener)
    return () => window.removeEventListener('integrity-warning', handleWarning as EventListener)
  }, [])

  // Handle fullscreen change
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [isFullscreen])

  // Request fullscreen on mount for proctored tests
  React.useEffect(() => {
    if (test.isProctored && !isFullscreen) {
      const elem = document.documentElement
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {})
        setIsFullscreen(true)
      }
    }
  }, [test.isProctored, isFullscreen])

  const saveAnswer = async (questionId: string, answer: any) => {
    if (!attemptData || isSaving) return
    
    setIsSaving(true)
    try {
      await fetch(`/api/online-tests/${test.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save-answer', 
          questionId, 
          answer,
          timeSpent: 10,
        }),
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save answer:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    saveAnswer(questionId, answer)
  }

  const handleNext = () => {
    if (currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = () => {
    setShowSubmitConfirm(true)
  }

  const confirmSubmit = async () => {
    setIsSubmitted(true)
    setShowSubmitConfirm(false)

    try {
      const res = await fetch(`/api/online-tests/${test.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')

      toast({ title: "Test submitted successfully!" })
      onComplete()
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to submit", variant: "destructive" })
      setIsSubmitted(false)
    }
  }

  const handleAutoSubmit = async (reason: string) => {
    setIsAutoSubmitted(true)
    setIsSubmitted(true)

    try {
      await saveAnswer(test.questions[currentQuestionIndex].id, test.questions[currentQuestionIndex].id)

      const res = await fetch(`/api/online-tests/${test.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', autoSubmit: true, reason }),
      })
      const data = await res.json()
      
      toast({ 
        title: reason === 'TIME_EXPIRED' ? "Time's up!" : "Test auto-submitted", 
        description: reason === 'TIME_EXPIRED' 
          ? "Your test has been automatically submitted as time ran out."
          : "Your test has been automatically submitted due to integrity policy violations.",
        variant: "destructive"
      })
      onComplete()
    } catch (error) {
      toast({ title: "Error", description: "Failed to auto-submit", variant: "destructive" })
    }
  }

  const handleExit = () => {
    setShowExitConfirm(true)
  }

  const confirmExit = () => {
    setShowExitConfirm(false)
    onExit()
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTimeColor = () => {
    if (timeRemaining <= 60) return 'text-destructive animate-pulse'
    if (timeRemaining <= 300) return 'text-amber-600'
    return 'text-primary'
  }

  if (!attemptData) {
    return <LoadingState />
  }

  const isFinished = isSubmitted || isAutoSubmitted

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex h-full items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center">
              <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Test Submitted Successfully
              </h3>
              <p className="text-muted-foreground mb-6">
                Your test has been submitted and is being processed.
              </p>
              <Button onClick={onComplete} className="w-full" size="lg">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Loading state handled by early return */}

      {/* Submitted state */}
      {isFinished && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex h-full items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardContent className="py-12 text-center">
                <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Test Submitted Successfully
                </h3>
                <p className="text-muted-foreground mb-6">
                  Your test has been submitted and is being processed.
                </p>
                <Button onClick={onComplete} className="w-full" size="lg">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Return to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main test player UI */}
      {!isFinished && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowExitConfirm(true)}
                className="h-10 w-10"
                aria-label="Exit test"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">{test.title}</h2>
                <p className="text-sm text-muted-foreground">{test.questions.length} questions • {test.durationMinutes} min • {test.totalMarks} marks</p>
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-semibold text-primary">
                <Timer className="h-5 w-5" />
                <span>{formatTime(timeRemaining)}</span>
              </div>

              {/* Warnings */}
              {warningsCount > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>Warnings: {warningsCount}/5</span>
                </div>
              )}

              {/* Fullscreen toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (isFullscreen) {
                          document.exitFullscreen()
                        } else {
                          document.documentElement.requestFullscreen()
                        }
                        setIsFullscreen(!isFullscreen)
                      }}
                      className="h-10 w-10"
                      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                      {false ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Progress Bar */}
            <div className="px-4 py-2 border-b bg-background/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
                <span>{answeredCount}/{test.questions.length} answered</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>

            {/* Question Navigation */}
            <div className="px-4 py-2 border-b bg-background/50 overflow-x-auto">
              <div className="flex gap-1 min-w-max" role="tablist" aria-label="Question navigation">
                {test.questions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => {}}
                    className="flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                    role="tab"
                    aria-selected={false}
                    aria-label={`Question ${q.questionNumber}`}
                  >
                    {q.questionNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Question Panel */}
              <div className="flex-1 p-4 overflow-y-auto">
                {question && (
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            Question {question.questionNumber} of {test.questions.length}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{question.marks} marks</Badge>
                          {question.negativeMarks > 0 && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <XCircle className="h-3 w-3" />
                              -{question.negativeMarks}
                            </Badge>
                          )}
                          {question.difficulty && (
                            <Badge variant="outline" className="text-xs">{question.difficulty}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <ScrollArea className="flex-1 pr-2">
                        <div className="space-y-4">
                          <p className="text-lg font-medium leading-relaxed">{question.prompt}</p>

                          {/* Question Type Specific Input */}
                          {question.type === 'SINGLE_CORRECT' && question.options && (
                            <RadioGroup 
                              value="" 
                              onValueChange={() => {}}
                            >
                              <div className="grid gap-3 sm:grid-cols-2">
                                {question.options.map((option, optIndex) => (
                                  <RadioGroupItem 
                                    key={optIndex} 
                                    value={optIndex.toString()} 
                                    className="relative p-4 text-left border rounded-lg transition-all duration-200 hover:bg-accent hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-medium text-muted-foreground bg-background">
                                        {String.fromCharCode(65 + optIndex)}
                                      </div>
                                      <span className="flex-1 text-sm">{option}</span>
                                    </div>
                                  </RadioGroupItem>
                                ))}
                              </div>
                            </RadioGroup>
                          )}

                          {question.type === 'MULTIPLE_SELECT' && question.options && (
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">Select all that apply:</p>
                              {question.options.map((option, optIndex) => (
                                <Button
                                  key={optIndex}
                                  variant="outline"
                                  className="w-full justify-start gap-3 text-left p-4"
                                  onClick={() => {}}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-medium">
                                      {String.fromCharCode(65 + optIndex)}
                                    </div>
                                    <span className="flex-1 text-sm">{option}</span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}

                          {(question.type === 'SHORT_ANSWER' || question.type === 'LONG_ANSWER') && (
                            <Textarea
                              placeholder={question.type === 'SHORT_ANSWER' ? "Enter your short answer..." : "Enter your detailed answer..."}
                              value=""
                              onChange={() => {}}
                              rows={question.type === 'LONG_ANSWER' ? 8 : 4}
                              className="font-mono text-sm"
                            />
                          )}

                          {question.type === 'NUMERICAL' && (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Enter numerical answer"
                                value=""
                                onChange={() => {}}
                                className="flex-1 w-48 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <span className="text-sm text-muted-foreground">Use decimal notation if needed</span>
                            </div>
                          )}

                          {/* Auto-save indicator */}
                          <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
                            <span>Auto-saved: Not saved yet</span>
                          </div>
                        </div>
                      </ScrollArea>

                      {/* Navigation */}
                      <div className="flex items-center justify-between pt-4 border-t mt-auto">
                        <Button 
                          variant="outline" 
                          onClick={() => {}}
                          disabled
                          className="gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            0/{test.questions.length} answered
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button onClick={() => {}} className="gap-1">
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Integrity Monitor - only for proctored tests */}
                {test.isProctored && (
                  <IntegrityMonitor
                    testId={test.id}
                    attemptId=""
                    warningsCount={0}
                    onWarning={() => {}}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Warning Modal */}
          <AlertDialog open={false} onOpenChange={() => {}}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Integrity Warning #0</AlertDialogTitle>
                <AlertDialogDescription>
                  {getWarningMessage('TAB_SWITCH')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => {}}>Acknowledge</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Exit Confirmation */}
          <AlertDialog open={false} onOpenChange={() => {}}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Exit Test?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your progress will be saved automatically. You can resume this test later from the "In Progress" tab.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Test</AlertDialogCancel>
                <AlertDialogAction onClick={() => {}} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Exit Test</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Submit Confirmation */}
          <AlertDialog open={false} onOpenChange={() => {}}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit Test?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have answered 0 of {test.questions.length} questions. 
                  Once submitted, you cannot change your answers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Test</AlertDialogCancel>
                <AlertDialogAction onClick={() => {}}>Submit Test</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}



function getWarningMessage(type: string): string {
  switch (type) {
    case 'TAB_SWITCH':
      return 'You switched browser tabs. This is not allowed during a proctored test.'
    case 'WINDOW_BLUR':
      return 'You clicked outside the test window. Please keep focus on the test.'
    case 'FULLSCREEN_EXIT':
      return 'You exited fullscreen mode. Fullscreen is required for this proctored test.'
    case 'COPY_ATTEMPT':
      return 'Copy operations are not allowed during the test.'
    case 'PASTE_ATTEMPT':
      return 'Paste operations are not allowed during the test.'
    case 'RIGHT_CLICK':
      return 'Right-click is disabled during the test.'
    default:
      return 'An integrity violation was detected.'
  }
}

function formatRelativeTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  return `${diffHours}h ago`
}

function toast(props: { title: string; description?: string; variant?: 'default' | 'destructive' }) {
  console.log(`[Toast] ${props.title}: ${props.description}`)
}