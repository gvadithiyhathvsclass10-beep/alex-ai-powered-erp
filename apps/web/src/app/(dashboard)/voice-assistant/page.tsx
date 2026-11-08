"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
// import { VoiceAssistant } from "@/components/voice-assistant/VoiceAssistant"

export default function VoiceAssistantPage() {
  const router = useRouter()

  const content = React.createElement(
    "div",
    { className: "flex h-[100dvh] min-h-0 bg-background overflow-hidden" },
    React.createElement(
      "div",
      { className: "flex h-full items-center justify-center p-4" },
      React.createElement(
        "div",
        { className: "text-center text-muted-foreground" },
        React.createElement("p", { className: "text-lg font-medium" }, "Voice Assistant"),
        React.createElement("p", { className: "text-sm mt-2" }, "Coming soon...")
      )
    )
  )

  return content
}