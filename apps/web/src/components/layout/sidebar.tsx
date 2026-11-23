"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  GraduationCap,
  ChevronLeft,
  Sparkles,
  Brain,
  X,
} from "lucide-react"
import {
  getNavItemsForRole,
  getSectionTitle,
  resolveActiveNavHref,
  type NavItem,
} from "@/lib/navigation/config"

function NavLink({
  item,
  isActive,
  compact,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  compact: boolean
  onNavigate?: () => void
}) {
  const baseClasses =
    "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const activeClasses =
    "bg-primary/15 border-l-2 border-primary text-primary shadow-[inset_0_0_20px_-5px_rgba(0,212,255,0.15)]"
  const inactiveClasses =
    "border-l-2 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(baseClasses, isActive ? activeClasses : inactiveClasses)}
      title={compact ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex-shrink-0">
        <item.icon className={cn("h-5 w-5", isActive && "text-primary")} aria-hidden="true" />
      </span>
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto shrink-0 rounded-full border border-primary/30 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function SectionHeader({ title, compact }: { title: string; compact: boolean }) {
  if (compact) return null
  return (
    <p className="mb-2 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {title}
    </p>
  )
}

interface SidebarProps {
  userRole: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  mobileOpen?: boolean
  onClose?: () => void
  className?: string
}

export function Sidebar({
  userRole,
  collapsed = false,
  onCollapsedChange,
  mobileOpen = false,
  onClose,
  className,
}: SidebarProps) {
  const pathname = usePathname()
  // A collapsed desktop rail must still render a full mobile drawer.
  const compact = collapsed && !mobileOpen

  const mainItems = getNavItemsForRole(userRole, false, false).filter(item => item.section === "main")
  const lecturerItems = getNavItemsForRole(userRole, true, false).filter(item => item.section === "lecturer")
  const adminItems = getNavItemsForRole(userRole, true, true).filter(item => item.section === "admin")

  // Resolve the single best destination for the current route. Tools that point
  // at the same page never claim a second active highlight.
  const activeHref = resolveActiveNavHref(mainItems, pathname)

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(18rem,86vw)] flex-col border-r bg-sidebar transition-transform duration-300 ease-out",
        "lg:w-[var(--sidebar-width,16rem)] lg:translate-x-0 lg:visible lg:transition-[width]",
        mobileOpen ? "max-lg:visible translate-x-0 shadow-2xl" : "-translate-x-full max-lg:invisible",
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Brand Header */}
        <div className="relative flex h-16 shrink-0 items-center justify-between overflow-hidden border-b border-sidebar-border px-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />

          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              "group relative z-10 flex items-center gap-3 text-lg font-bold",
              compact && "lg:mx-auto"
            )}
            title="ALEX Dashboard"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
              <span className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
            </span>
            <span className={cn("text-foreground", compact && "lg:hidden")}>ALEX</span>
          </Link>

          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="relative z-10 h-10 w-10 rounded-lg hover:bg-secondary lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Desktop collapse */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange?.(!compact)}
            className="relative z-10 hidden h-9 w-9 rounded-lg transition-all duration-200 hover:bg-secondary lg:inline-flex"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!compact}
            aria-controls="app-sidebar"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", compact && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">
          <SectionHeader title={getSectionTitle("main")} compact={compact} />

          <div className="space-y-1">
            {mainItems.map((item) => (
              <NavLink
                key={`${item.section}-${item.href}-${item.label}`}
                item={item}
                isActive={item.href === activeHref}
                compact={compact}
                onNavigate={onClose}
              />
            ))}
          </div>

          {lecturerItems.length > 0 && (
            <div className={cn("mt-4 border-t border-sidebar-border pt-4", compact && "lg:hidden")}>
              <SectionHeader title={getSectionTitle("lecturer")} compact={compact} />
              <div className="space-y-1">
                {lecturerItems.map((item) => (
                  <NavLink
                    key={`${item.section}-${item.href}-${item.label}`}
                    item={item}
                    isActive={false}
                    compact={compact}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </div>
          )}

          {adminItems.length > 0 && (
            <div className={cn("mt-4 border-t border-sidebar-border pt-4", compact && "lg:hidden")}>
              <SectionHeader title={getSectionTitle("admin")} compact={compact} />
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <NavLink
                    key={`${item.section}-${item.href}-${item.label}`}
                    item={item}
                    isActive={false}
                    compact={compact}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!compact ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>ALEX v0.1.0</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <Brain className="h-3 w-3 text-accent" />
                <span>AI-Powered ERP</span>
              </div>
            </div>
          ) : (
            <div className="hidden text-center text-xs text-muted-foreground/60 lg:block">
              <Sparkles className="mx-auto mb-1 h-3 w-3 text-primary" />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
