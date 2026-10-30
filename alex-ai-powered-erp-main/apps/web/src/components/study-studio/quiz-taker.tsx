"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Check, X, Loader2, Flag, AlertCircle, CheckCircle, Clock, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { MarkdownRenderer } from "@/components/ui/markdown"

interface QuizTakerProps {
  quiz: {
    id: string
    title: string
    description: string | null
    subjectId: string | null
    sourceDocId: string | null
    topic: string | null
    difficulty: string
    questions: Array<{
      id: string
      prompt: string
      options: string[]
      answer: number
      explanation?: string
    }>
    timeLimit: number | null
    isPublished: boolean
    createdAt: string
  }
  onClose: () => void
  onComplete: () => void
}

export function QuizTaker({ quiz, onClose, onComplete }: QuizTakerProps) {
  const { toast } = useToast()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, number>>({})
  const [showResults, setShowResults] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(quiz.timeLimit ? quiz.timeLimit * 60 : null)
  const [startTime] = React.useState(Date.now())

  const currentQuestion = quiz.questions[currentIndex]
  const progress = quiz.questions.length > 0 ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0
  const answeredCount = Object.keys(answers).length

  // Timer effect
  React.useEffect(() => {
    if (!quiz.timeLimit || showResults || timeRemaining === null || timeRemaining <= 0) return
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [quiz.timeLimit, showResults, timeRemaining])

  // Auto-submit when time runs out
  React.useEffect(() => {
    if (timeRemaining === 0 && !showResults) {
      handleSubmit()
    }
  }, [timeRemaining, showResults])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }))
  }

  const handleNext = () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (answeredCount < quiz.questions.length) {
      if (!confirm(`You have ${quiz.questions.length - answeredCount} unanswered questions. Submit anyway?`)) {
        return
      }
    }
    
    setIsSubmitting(true)
    
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      
      if (!res.ok) throw new Error('Failed to submit quiz')
      
      const result = await res.json()
      setShowResults(true)
      toast({ title: "Quiz submitted!", description: `Score: ${result.score}/${result.maxScore}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit quiz", variant: "destructive" })
      setIsSubmitting(false)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setAnswers({})
    setShowResults(false)
    setTimeRemaining(quiz.timeLimit ? quiz.timeLimit * 60 : null)
  }

  if (showResults) {
    let score = 0
    quiz.questions.forEach(q => {
      if (answers[q.id] === q.answer) score++
    })
    const percentage = Math.round((score / quiz.questions.length) * 100)
    
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center">
          <div className={cn("text-5xl font-bold mb-2", percentage >= 70 ? "text-green-600" : percentage >= 50 ? "text-yellow-600" : "text-red-600")}>
            {percentage}%
          </div>
          <CardTitle>Quiz Complete</CardTitle>
          <p className="text-sm text-muted-foreground">
            You scored {score} out of {quiz.questions.length}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[question.id]
              const isCorrect = userAnswer === question.answer
              const userSelected = userAnswer !== undefined ? question.options[userAnswer] : 'Not answered'
              
              return (
                <Card key={question.id} className={cn(isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center", isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                        {isCorrect ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium mb-2">{index + 1}. {question.prompt}</p>
                        <div className="space-y-1 ml-8 text-sm">
                          {question.options.map((opt, optIdx) => (
                            <div key={optIdx} className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded",
                              optIdx === question.answer && "bg-green-100 text-green-800 font-medium",
                              optIdx === userAnswer && !isCorrect && "bg-red-100 text-red-800",
                              optIdx !== question.answer && optIdx !== userAnswer && "text-muted-foreground"
                            )}>
                              {optIdx === question.answer && <Check className="h-3.5 w-3.5" />}
                              {optIdx === userAnswer && !isCorrect && <AlertCircle className="h-3.5 w-3.5" />}
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <p className="mt-2 text-sm text-muted-foreground italic">{question.explanation}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
          <div className="flex gap-2 justify-center mt-6">
            <Button onClick={handleRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Quiz
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!currentQuestion) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          <p className="text-muted-foreground">No questions in this quiz</p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            <X className="mr-2 h-4 w-4" />
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header with timer and progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold">{quiz.title}</h3>
            <p className="text-sm text-muted-foreground">
              {quiz.questions.length} questions · {quiz.difficulty} difficulty
            </p>
          </div>
        </div>
        
        {quiz.timeLimit && (
          <div className={cn("flex items-center gap-2 px-3 py-1 rounded-lg font-mono text-sm", timeRemaining !== null && timeRemaining < 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
            <Clock className="h-4 w-4" />
            <span>{formatTime(timeRemaining || 0)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={progress} className="h-2" />
        </div>
        <span className="text-sm text-muted-foreground w-24 text-right">
          {currentIndex + 1} / {quiz.questions.length}
        </span>
      </div>

      {/* Question Card */}
      <Card className="shadow-xl">
        <CardContent className="p-6">
          <div className="mb-4">
            <span className={cn("text-xs font-medium px-2 py-1 rounded", 
              quiz.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
              quiz.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {quiz.difficulty}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">Question {currentIndex + 1}</span>
          </div>
          
          <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
            <MarkdownRenderer content={currentQuestion.prompt} />
          </div>

          <RadioGroup
            value={answers[currentQuestion.id]?.toString() || ''}
            onValueChange={(value) => handleAnswer(currentQuestion.id, parseInt(value))}
            className="space-y-3"
          >
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="relative">
                <RadioGroupItem value={index.toString()} className="peer" />
                <Label 
                  htmlFor={`quiz-${currentQuestion.id}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all",
                    "peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:shadow-sm",
                    "hover:border-primary/50"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    "peer-checked:border-primary peer-checked:bg-primary",
                    "border-muted-foreground/30"
                  )}>
                    {answers[currentQuestion.id] === index && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <MarkdownRenderer content={option} />
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{quiz.questions.length} answered
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {currentIndex < quiz.questions.length - 1 ? (
            <Button size="sm" onClick={handleNext}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              size="sm" 
              onClick={handleSubmit} 
              disabled={isSubmitting || answeredCount === 0}
            >
              {isSubmitting ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting... </> 
              ) : (
                <> <Flag className="mr-2 h-4 w-4" /> Submit Quiz </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}