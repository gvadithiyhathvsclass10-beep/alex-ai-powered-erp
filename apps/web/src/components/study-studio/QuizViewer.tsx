"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw,
  Timer,
  Award,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation?: string
}

export interface QuizData {
  id: string
  title: string
  difficulty: string
  questions: QuizQuestion[]
  sourceDocId?: string
  subjectId?: string
  createdAt: string
}

export interface QuizAttempt {
  questionId: string
  selectedAnswer: number | null
  isCorrect: boolean
  timeSpent: number
}

interface QuizViewerProps {
  quiz: QuizData
  onSubmit?: (attempt: QuizAttempt[]) => void
  onExportPdf?: () => void
  className?: string
}

interface QuestionCardProps {
  question: QuizQuestion
  index: number
  total: number
  selectedAnswer: number | null
  onSelectAnswer: (answer: number) => void
  showExplanation: boolean
  isCorrect?: boolean
  isReviewMode?: boolean
  correctAnswer?: number
}

function QuestionCard({ 
  question, 
  index, 
  total, 
  selectedAnswer, 
  onSelectAnswer, 
  showExplanation, 
  isCorrect,
  isReviewMode = false,
  correctAnswer
}: QuestionCardProps) {
  const optionLabels = ["A", "B", "C", "D", "E", "F"]
  
  return (
    <Card className={cn("animate-in slide-in-from-right-2", isReviewMode && "border-primary/20")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              Question {index + 1} of {total}
            </Badge>
            {isReviewMode && (
              <Badge variant={isCorrect ? "success" : "destructive"} className="gap-1">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Correct
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    Incorrect
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-medium leading-relaxed">{question.prompt}</p>
        
        <RadioGroup 
          value={selectedAnswer?.toString() || ""} 
          onValueChange={(v) => onSelectAnswer(parseInt(v))}
          disabled={isReviewMode}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, optIndex) => (
              <RadioGroupItem 
                key={optIndex} 
                value={optIndex.toString()} 
                className={cn(
                  "relative p-4 text-left border rounded-lg transition-all duration-200",
                  "hover:bg-accent hover:border-primary/50",
                  "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                  selectedAnswer === optIndex && "bg-primary/10 border-primary",
                  isReviewMode && optIndex === question.answer && "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700",
                  isReviewMode && selectedAnswer !== null && selectedAnswer !== question.answer && optIndex === selectedAnswer && "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-medium text-muted-foreground bg-background">
                    {optionLabels[optIndex] || String.fromCharCode(65 + optIndex)}
                  </div>
                  <span className="flex-1 text-sm">{option}</span>
                </div>
                
                {/* Review mode indicators */}
                {isReviewMode && (
                  <>
                    {optIndex === question.answer && (
                      <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />
                    )}
                    {selectedAnswer !== null && selectedAnswer !== question.answer && optIndex === selectedAnswer && (
                      <XCircle className="absolute right-3 top-3 h-5 w-5 text-red-500" />
                    )}
                  </>
                )}
              </RadioGroupItem>
            ))}
          </div>
        </RadioGroup>
        
        {showExplanation && question.explanation && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800 animate-in fade-in">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Explanation</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">{question.explanation}</p>
              </div>
            </div>
          </div>
        )}
        
        {isReviewMode && !isCorrect && question.explanation && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Why this is incorrect</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{question.explanation}</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                  The correct answer is: <strong>{question.options[question.answer]}</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function QuizViewer({ quiz, onSubmit, onExportPdf, className }: QuizViewerProps) {
  const [currentQuestion, setCurrentQuestion] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, number>>({})
  const [submitted, setSubmitted] = React.useState(false)
  const [reviewMode, setReviewMode] = React.useState(false)
  const [timeSpent, setTimeSpent] = React.useState<Record<string, number>>({})
  const [startTime] = React.useState(Date.now())
  const [showResults, setShowResults] = React.useState(false)
  
  const question = quiz.questions[currentQuestion]
  const selectedAnswer = answers[question?.id || ""]
  const answeredCount = Object.keys(answers).length
  const correctCount = quiz.questions.filter(q => answers[q.id] === q.answer).length
  
  // Track time spent per question
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!submitted && !reviewMode) {
        setTimeSpent(prev => ({
          ...prev,
          [question.id]: (prev[question.id] || 0) + 1
        }))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [currentQuestion, question.id, submitted, reviewMode])
  
  const handleAnswerSelect = (answer: number) => {
    if (!submitted && !reviewMode) {
      setAnswers(prev => ({ ...prev, [question.id]: answer }))
    }
  }
  
  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    }
  }
  
  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
    }
  }
  
  const handleSubmitQuiz = () => {
    if (answeredCount < quiz.questions.length) {
      if (!window.confirm(`You've answered ${answeredCount} of ${quiz.questions.length} questions. Submit anyway?`)) {
        return
      }
    }
    setSubmitted(true)
    setShowResults(true)
    
    // Prepare attempt data
    const attempts: QuizAttempt[] = quiz.questions.map(q => ({
      questionId: q.id,
      selectedAnswer: answers[q.id] ?? null,
      isCorrect: answers[q.id] === q.answer,
      timeSpent: timeSpent[q.id] || 0
    }))
    
    onSubmit?.(attempts)
  }
  
  const handleReview = () => {
    setReviewMode(true)
    setShowResults(false)
    setCurrentQuestion(0)
  }
  
  const handleRetry = () => {
    setAnswers({})
    setSubmitted(false)
    setReviewMode(false)
    setShowResults(false)
    setCurrentQuestion(0)
    setTimeSpent({})
  }
  
  const handleExportPdf = async () => {
    if (onExportPdf) {
      onExportPdf()
    } else {
      window.print()
    }
  }
  
  // Calculate score
  const score = (correctCount / quiz.questions.length) * 100
  const totalTime = Object.values(timeSpent).reduce((a, b) => a + b, 0)
  
  // Results view
  if (showResults && !reviewMode) {
    return (
      <Card className={cn("animate-in fade-in", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Quiz Complete
              </CardTitle>
              <p className="text-muted-foreground">{quiz.title}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{Math.round(score)}%</p>
              <p className="text-sm text-muted-foreground">{correctCount} of {quiz.questions.length} correct</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score breakdown */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{quiz.questions.length - correctCount}</div>
                <div className="text-sm text-muted-foreground">Incorrect</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{Math.floor(totalTime / 60)}:{String(totalTime % 60).padStart(2, '0')}</div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Per-question breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium">Question Review</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {quiz.questions.map((q, i) => {
                const userAnswer = answers[q.id]
                const isCorrect = userAnswer === q.answer
                return (
                  <div 
                    key={q.id} 
                    className={cn(
                      "p-3 rounded-lg border text-sm flex items-center gap-3",
                      isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    )}
                  >
                    <Badge variant={isCorrect ? "success" : "destructive"} className="flex-shrink-0">
                      {isCorrect ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-12">Q{i + 1}</span>
                    <span className="flex-1 truncate text-sm">{q.prompt}</span>
                    {userAnswer !== null && userAnswer !== q.answer && (
                      <span className="text-xs text-muted-foreground">
                        Your answer: {q.options[userAnswer]?.slice(0, 30)}…
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button onClick={handleReview} variant="outline">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Review Answers
            </Button>
            <Button onClick={handleRetry} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Quiz
            </Button>
            {onExportPdf && (
              <Button onClick={handleExportPdf} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Question view
  if (!question) {
    return (
      <Card className={cn(className)}>
        <CardContent className="flex flex-col items-center justify-center h-[400px] text-center">
          <Award className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No Questions Available</h3>
          <p className="text-muted-foreground mt-2">This quiz has no questions.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">{quiz.difficulty}</Badge>
            <Badge variant="secondary">{quiz.questions.length} questions</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>{Math.floor(timeSpent[question.id] / 60)}:{String(timeSpent[question.id] % 60).padStart(2, '0')}</span>
            <Separator orientation="vertical" className="h-4 mx-2" />
            <span>Q{currentQuestion + 1} of {quiz.questions.length}</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3">
          <Progress value={(answeredCount / quiz.questions.length) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {answeredCount} of {quiz.questions.length} answered
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-2">
          <QuestionCard
            question={question}
            index={currentQuestion}
            total={quiz.questions.length}
            selectedAnswer={selectedAnswer}
            onSelectAnswer={handleAnswerSelect}
            showExplanation={submitted || reviewMode}
            isCorrect={reviewMode ? selectedAnswer === question.answer : undefined}
            isReviewMode={reviewMode}
            correctAnswer={reviewMode ? question.answer : undefined}
          />
        </ScrollArea>
        
        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t mt-auto">
          <Button 
            variant="outline" 
            onClick={handlePrevious} 
            disabled={currentQuestion === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {answeredCount}/{quiz.questions.length} answered
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {currentQuestion < quiz.questions.length - 1 ? (
              <Button onClick={handleNext} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmitQuiz} 
                variant="default"
                className="btn-primary-gradient gap-1"
                disabled={answeredCount === 0}
              >
                Submit Quiz
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Quick navigation */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Quick Navigation</p>
          <div className="flex flex-wrap gap-1">
            {quiz.questions.map((q, i) => (
              <Button
                key={q.id}
                variant={currentQuestion === i ? "default" : answers[q.id] ? "secondary" : "outline"}
                size="icon"
                className={cn("h-7 w-7 rounded", 
                  reviewMode && answers[q.id] === q.answer && "bg-green-100 text-green-700 border-green-300",
                  reviewMode && answers[q.id] !== null && answers[q.id] !== q.answer && "bg-red-100 text-red-700 border-red-300"
                )}
                onClick={() => setCurrentQuestion(i)}
                disabled={reviewMode}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}