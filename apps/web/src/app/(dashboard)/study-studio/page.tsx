"use client"

import * as React from "react"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { StudyStudioContent } from "./StudyStudioContent"
import { Loader2 } from "lucide-react"

function StudyStudioClientWrapper() {
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get('tab') || 'notes'

  return <StudyStudioContent initialTab={initialTab} />
}

export default function StudyStudioPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading Study Studio...</span>
          </div>
        </div>
      </div>
    }>
      <StudyStudioClientWrapper />
    </Suspense>
  )
}