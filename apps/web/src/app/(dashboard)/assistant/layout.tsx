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
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [leftPanelOpen, setLeftPanelOpen] = React.useState(true)
  const [rightPanelOpen, setRightPanelOpen] = React.useState(true)
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
        <div className="min-h-screen bg-background flex">
          {/* Left Panel - Navigation & Conversation History */}
          <AssistantSidebar 
            userRole={userRole} 
            isOpen={leftPanelOpen} 
          />

          {/* Main Content Area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300",
            leftPanelOpen ? "lg:pl-80" : "lg:pl-16"
          )}>
            {/* Header with mobile menu button */}
            <TooltipProvider>
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
            </TooltipProvider>

            {/* Page content */}
            <main className="flex-1 flex flex-col min-w-0">
              {children}
            </main>
          </div>

          {/* Right Panel - Utility Panel */}
          <AssistantRightPanel 
            isOpen={rightPanelOpen} 
            onToggle={setRightPanelOpen} 
          />

          {/* Floating AI Avatar */}
          <AIAvatar />
        </div>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}