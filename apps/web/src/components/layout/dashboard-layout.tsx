"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { usePathname } from 'next/navigation'
import { AIAvatar } from '@/components/ai/Avatar'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileBottomNav } from '@/components/layout/mobile-nav'
import { useAuth } from '@/components/auth/AuthProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
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

  // The drawer is bound to the pathname it was opened on. A route change makes
  // the stored path stop matching, so the drawer closes without an effect that
  // writes state during render/commit (React 19 flags that as a cascading
  // render).
  const [sidebarOpenAt, setSidebarOpenAt] = React.useState<string | null>(null)
  const sidebarOpen = sidebarOpenAt === pathname
  const setSidebarOpen = React.useCallback(
    (open: boolean) => setSidebarOpenAt(open ? pathname : null),
    [pathname]
  )
  const toggleSidebar = React.useCallback(
    () => setSidebarOpenAt((current) => (current === pathname ? null : pathname)),
    [pathname]
  )

  // Lock background scrolling while the mobile drawer is open.
  React.useEffect(() => {
    if (!sidebarOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [sidebarOpen])

  React.useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [sidebarOpen, setSidebarOpen])

  // The Assistant owns its workspace layout. Do not wrap it in the global
  // dashboard sidebar/header as that creates nested, overlapping shells.
  if (pathname.startsWith('/dashboard/assistant')) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div
          className="app-shell min-h-[100dvh] bg-background"
          style={{ "--sidebar-width": sidebarCollapsed ? "4.5rem" : "16rem" } as React.CSSProperties}
        >
          {/* Mobile drawer backdrop */}
          {sidebarOpen && (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
            />
          )}

          <Sidebar
            userRole={userRole}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            mobileOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex min-h-[100dvh] min-w-0 flex-col transition-[padding] duration-300 lg:pl-[var(--sidebar-width)]">
            <Header
              user={{
                id: user?.id || '',
                firstName: user?.firstName || '',
                lastName: user?.lastName || '',
                email: user?.email || '',
                avatarUrl: user?.avatarUrl || null,
                role: userRole,
              }}
              menuOpen={sidebarOpen}
              onMenuClick={toggleSidebar}
            />

            <main id="main-content" className="app-main min-w-0 flex-1">
              <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </div>

          <MobileBottomNav userRole={userRole} onOpenMenu={() => setSidebarOpen(true)} />

          {/* Floating AI Avatar — positioned above the mobile bottom bar */}
          <AIAvatar />
        </div>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
