"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Sparkles, Brain, Target, Clock, CheckCircle2, Zap, BookOpen, Lightbulb, Send } from "lucide-react"
import { cn } from "@/lib/utils"

export function ImportantQuestionsComingSoon() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="destructive" className="text-sm px-3 py-1 font-medium animate-pulse">
            COMING SOON
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Important Questions</h1>
        <p className="text-muted-foreground text-lg">
          We're improving this feature
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-6">
            {/* Illustration */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-purple/20 rounded-full blur-2xl" style={{ width: '200px', height: '200px' }} />
                <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 to-purple/20">
                  <Brain className="h-16 w-16 text-primary/80" />
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">We're improving Important Questions</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                We're improving Important Questions to provide a more reliable and accurate question-generation experience. This feature will be available again soon.
              </p>
            </div>

            {/* What's being improved */}
            <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
              <div className="text-center p-4 rounded-xl bg-card border border-border/50">
                <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-emerald/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-sm">Better Accuracy</h4>
                <p className="text-xs text-muted-foreground mt-1">Improved question extraction and ranking algorithms</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-card border border-border/50">
                <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-blue/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-sm">Faster Generation</h4>
                <p className="text-xs text-muted-foreground mt-1">Optimized AI pipeline for faster results</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-card border border-border/50">
                <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-purple/10 flex items-center justify-center">
                  <Lightbulb className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-sm">Smarter Ranking</h4>
                <p className="text-xs text-muted-foreground mt-1">Better priority scoring with evidence-based rationale</p>
              </div>
            </div>

            {/* What to expect */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold text-center">What's coming</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">AI-powered question generation</p>
                    <p className="text-xs text-muted-foreground">From your study materials and notes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Evidence-based ranking</p>
                    <p className="text-xs text-muted-foreground">HIGH / MEDIUM / LOW priority with rationale</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Multi-document analysis</p>
                    <p className="text-xs text-muted-foreground">Combine multiple papers and sources</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center flex-shrink-0">
                    <Send className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Export & sharing</p>
                    <p className="text-xs text-muted-foreground">PDF export and practice paper generation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline hint */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Expected to return in a future update</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <Button 
          variant="outline" 
          size="lg"
          onClick={() => window.history.back()}
          className="w-full sm:w-auto min-w-[160px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Study Studio
        </Button>
        <Button 
          variant="default" 
          size="lg"
          disabled
          className="w-full sm:w-auto min-w-[160px] opacity-50 cursor-not-allowed"
        >
          <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
          Notify Me
        </Button>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground pt-6">
        Your existing documents and uploads are safe and will be ready when this feature returns.
      </p>
    </div>
  )
}