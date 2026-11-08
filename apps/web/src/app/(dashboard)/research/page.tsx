"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function ResearchRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Redirect to Study Studio with research tab
    const tab = searchParams.get("tab") || "research"
    router.push(`/study-studio?tab=${tab}`)
    router.refresh()
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to Study Studio...</p>
      </div>
    </div>
  )
}

export default function ResearchLabPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><p className="text-muted-foreground">Loading...</p></div>}>
      <ResearchRedirect />
    </Suspense>
  )
}