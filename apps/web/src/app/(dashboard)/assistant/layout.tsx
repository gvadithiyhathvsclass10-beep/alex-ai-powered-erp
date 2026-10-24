"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'
import { AIAvatar } from '@/components/ai/Avatar'
import { AssistantSidebar } from '@/components/layout/assistant-sidebar'
import { AssistantHeader } from '@/components/layout/assistant-header'
import { AssistantRightPanel } from '@/components/layout/assistant-right-panel'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/AuthProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [leftPanelOpen, setLeftPanelOpen] = React.useState(true)
  const [rightPanelOpen, setRightPanelOpen] = React.useState(true)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState(false)
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const userRole = user?.role || 'STUDENT'

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Three-panel grid layout: Left sidebar | Center content | Right panel */}
          <div className={cn(
            "grid h-screen",
            leftPanelOpen 
              ? (leftPanelCollapsed ? "lg:grid-cols-[64px_1fr_320px]" : "lg:grid-cols-[280px_1fr_320px]")
              : "lg:grid-cols-[0_1fr_320px]",
            rightPanelOpen ? "" : "lg:grid-cols-[280px_1fr_0]"
          )}>
            {/* Left Panel - Navigation & Conversation History */}
            <AssistantSidebar 
              userRole={userRole} 
              isOpen={leftPanelOpen}
              collapsed={leftPanelCollapsed}
              onToggleCollapse={setLeftPanelCollapsed}
              onClose={() => setLeftPanelOpen(false)}
            />

            {/* Center Content Area */}
            <div className="flex flex-col min-w-0 lg:min-w-0">
              {/* Header */}
              <AssistantHeader 
                user={{ 
                  id: user?.id || '', 
                  firstName: user?.firstName || '', 
                  lastName: user?.lastName || '', 
                  email: user?.email || '', 
                  avatarUrl: user?.avatarUrl || null, 
                  role: userRole 
                }} 
              />

              {/* Page content */}
              <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {children}
              </main>
            </div>

            {/* Right Panel - Utility Panel */}
            <AssistantRightPanel 
              isOpen={rightPanelOpen} 
              onToggle={setRightPanelOpen} 
            />

            {/* Mobile drawer overlays */}
            {leftPanelOpen && (
              <div 
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                onClick={() => setLeftPanelOpen(false)}
                aria-hidden="true"
              />
            )}
            {rightPanelOpen && (
              <div 
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                onClick={() => setRightPanelOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Floating AI Avatar */}
            <AIAvatar />
          </div>
        </div>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}