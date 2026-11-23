"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  ChevronDown,
  X,
  LayoutGrid,
} from "lucide-react"
import {
  getBottomNavItemsForRole,
  getMoreMenuItemsForRole,
  resolveActiveNavHref,
  type NavItem,
} from "@/lib/navigation/config"

interface MobileNavProps {
  userRole: string
  onOpenMenu: () => void
}

export function MobileBottomNav({ userRole, onOpenMenu }: MobileNavProps) {
  const pathname = usePathname()

  const bottomItems = getBottomNavItemsForRole(userRole)
  const moreItems = getMoreMenuItemsForRole(userRole)
  const hasMore = moreItems.length > 0
  const columns = bottomItems.length + (hasMore ? 1 : 0)

  const activeBottomHref = resolveActiveNavHref(bottomItems, pathname)
  const activeMoreHref = resolveActiveNavHref(moreItems, pathname)
  const moreIsActive = Boolean(activeMoreHref)

  // Bind the sheet to the pathname it was opened on: a route change closes it
  // without an effect that writes state (React 19 flags that pattern).
  const [moreOpenAt, setMoreOpenAt] = React.useState<string | null>(null)
  const showMore = moreOpenAt === pathname
  const setShowMore = React.useCallback(
    (open: boolean) => setMoreOpenAt(open ? pathname : null),
    [pathname]
  )
  const toggleMore = React.useCallback(
    () => setMoreOpenAt((current) => (current === pathname ? null : pathname)),
    [pathname]
  )

  // Prevent the page behind the More sheet from scrolling.
  React.useEffect(() => {
    if (!showMore) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [showMore])

  React.useEffect(() => {
    if (!showMore) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMore(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showMore, setShowMore])

  const renderNavItem = (item: NavItem, isActive: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="relative">
        <item.icon className="h-5 w-5" aria-hidden="true" />
        {item.badge && (
          <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1 text-[8px] font-bold uppercase leading-3 text-primary-foreground">
            {item.badge}
          </span>
        )}
      </span>
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  )

  return (
    <>
      {showMore && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
            onClick={() => setShowMore(false)}
            aria-label="Close more navigation"
          />
          <div
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-50 mx-auto w-full max-w-lg px-2 lg:hidden"
          >
            <div className="flex max-h-[min(70dvh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  <span className="font-semibold">More</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setShowMore(false)}
                  aria-label="Close more navigation"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                <div className="grid grid-cols-2 gap-1">
                  {moreItems.map((item) => {
                    const isActive = item.href === activeMoreHref
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        onClick={() => setShowMore(false)}
                        className={cn(
                          "flex min-h-12 min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto shrink-0 rounded-full border border-primary/30 bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>

                <div className="mt-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMore(false)
                      onOpenMenu()
                    }}
                    className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    Browse all navigation
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </>
      )}

      <nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className={cn(
            "mx-auto grid w-full max-w-lg gap-0.5 px-1.5 pt-1",
            columns === 5 ? "grid-cols-5" : "grid-cols-4"
          )}
        >
          {bottomItems.map((item) => renderNavItem(item, item.href === activeBottomHref))}

          {hasMore && (
            <button
              type="button"
              onClick={toggleMore}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors",
                showMore || moreIsActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-label="More navigation"
              aria-expanded={showMore}
              aria-controls="mobile-more-menu"
            >
              <span className="relative">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <ChevronDown
                  className={cn("absolute -right-2 -top-1 h-3 w-3 transition-transform", showMore && "rotate-180")}
                  aria-hidden="true"
                />
              </span>
              <span>More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
