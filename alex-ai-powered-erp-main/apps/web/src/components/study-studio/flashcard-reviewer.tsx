"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Shuffle, RotateCcw, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { MarkdownRenderer } from "@/components/ui/markdown"

interface FlashcardReviewerProps {
  deckId: string
  cards: Array<{
    id: string
    front: string
    back: string
    difficulty: number
    interval: number
    repetitions: number
    easeFactor: number
    nextReview: string
    lastReviewed: string | null
  }>
  onClose: () => void
}

interface ReviewRating {
  1: 'Again'
  2: 'Hard'
  3: 'Good'
  4: 'Easy'
}

export function FlashcardReviewer({ deckId, cards, onClose }: FlashcardReviewerProps) {
  const { toast } = useToast()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [isReviewing, setIsReviewing] = React.useState(false)
  const [reviewComplete, setReviewComplete] = React.useState(false)
  const [ratings, setRatings] = React.useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [shuffledIndices, setShuffledIndices] = React.useState<number[]>([])

  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0

  React.useEffect(() => {
    if (cards.length > 0 && shuffledIndices.length === 0) {
      setShuffledIndices(Array.from({ length: cards.length }, (_, i) => i))
    }
  }, [cards.length, shuffledIndices.length])

  const handleShuffle = () => {
    const indices = Array.from({ length: cards.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    setShuffledIndices(indices)
    setCurrentIndex(0)
    setShowAnswer(false)
    setReviewComplete(false)
    setRatings({})
  }

  const handleFlip = () => {
    setShowAnswer(true)
  }

  const handleRating = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard || isSubmitting) return
    
    setIsSubmitting(true)
    setRatings(prev => ({ ...prev, [currentCard.id]: rating }))
    
    try {
      const res = await fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      
      if (!res.ok) throw new Error('Review failed')
      
      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setShowAnswer(false)
      } else {
        setReviewComplete(true)
        setShowAnswer(false)
        toast({ title: "Review complete!", description: `You've reviewed all ${cards.length} cards.` })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setShowAnswer(false)
    setReviewComplete(false)
    setRatings({})
    setIsReviewing(true)
  }

  if (!isReviewing && !reviewComplete) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Flashcard Review</CardTitle>
          <p className="text-sm text-muted-foreground">{cards.length} cards ready to review</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center py-8">
            <div className="text-6xl font-bold text-primary/20 mb-4">{cards.length}</div>
            <p className="text-lg text-muted-foreground mb-6">Cards in this deck</p>
            <Button size="lg" onClick={() => setIsReviewing(true)}>
              <RotateCcw className="mr-2 h-5 w-5" />
              Start Review
            </Button>
            <Button variant="outline" onClick={handleShuffle} className="ml-2">
              <Shuffle className="mr-2 h-4 w-4" />
              Shuffle First
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (reviewComplete) {
    const ratedCount = Object.keys(ratings).length
    const againCount = Object.values(ratings).filter(r => r === 1).length
    const easyCount = Object.values(ratings).filter(r => r === 4).length
    
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Review Complete!</CardTitle>
          <p className="text-sm text-muted-foreground">Great job finishing your review session</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-primary">{ratedCount}</div>
              <div className="text-sm text-muted-foreground">Reviewed</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-destructive">{againCount}</div>
              <div className="text-sm text-muted-foreground">Need Review</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-green-600">{easyCount}</div>
              <div className="text-sm text-muted-foreground">Mastered</div>
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Review Again
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

  if (!currentCard) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          <p className="text-muted-foreground">No cards in this deck</p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            <X className="mr-2 h-4 w-4" />
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const actualIndex = shuffledIndices[currentIndex] ?? currentIndex
  const displayCard = cards[actualIndex]

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={progress} className="h-2" />
        </div>
        <span className="text-sm text-muted-foreground w-24 text-right">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Flashcard */}
      <Card className="shadow-xl">
        <CardContent className="pt-6 pb-8">
          <div className="text-center mb-4">
            <span className="text-sm text-muted-foreground">
              Card {currentIndex + 1} of {cards.length}
            </span>
          </div>

          <div
            className={cn(
              "h-[320px] border rounded-xl p-8 flex items-center justify-center cursor-pointer bg-card transition-all duration-300",
              showAnswer ? "bg-green-50 border-green-200" : "bg-card border-border hover:border-primary/50"
            )}
            onClick={handleFlip}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFlip() }}
          >
            {showAnswer ? (
              <div className="text-center w-full max-w-xl">
                <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-3">Answer</p>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={displayCard.back} />
                </div>
              </div>
            ) : (
              <div className="text-center w-full max-w-xl">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Question</p>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={displayCard.front} />
                </div>
                <p className="mt-6 text-sm text-muted-foreground">Click or press Space to reveal answer</p>
              </div>
            )}
          </div>

          {showAnswer && !isSubmitting && (
            <div className="mt-6 flex justify-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleRating(1)}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Again
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleRating(2)}
                className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
              >
                Hard
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleRating(3)}
                className="bg-primary hover:bg-primary/90"
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Good
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleRating(4)}
                className="border-green-500/50 text-green-500 hover:bg-green-500/10"
              >
                Easy
              </Button>
            </div>
          )}

          {isSubmitting && (
            <div className="mt-6 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {ratings[displayCard.id] && !isSubmitting && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Rated: <strong>{['', 'Again', 'Hard', 'Good', 'Easy'][ratings[displayCard.id]]}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex(prev => prev - 1)
              setShowAnswer(false)
            }
          }}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleShuffle}>
            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
            Shuffle
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Exit
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (currentIndex < cards.length - 1) {
              setCurrentIndex(prev => prev + 1)
              setShowAnswer(false)
            }
          }}
          disabled={currentIndex >= cards.length - 1}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}