"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  Brain,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { getBottomNavItemsForRole, getMoreMenuItemsForRole } from "@/lib/navigation/config"

interface MobileNavProps {
  userRole: string
  onOpenMenu: () => void
}

export function MobileBottomNav({ userRole, onOpenMenu }: MobileNavProps) {
  const pathname = usePathname()
  const [showMore, setShowMore] = React.useState(false)

  const bottomItems = getBottomNavItemsForRole(userRole)
  const moreItems = getMoreMenuItemsForRole(userRole)

  function renderMoreButton() {
    return (
      <div>
        <Button
          variant={showMore ? "default" : "ghost"}
          size="sm"
          className="h-10 flex flex-col items-center gap-1 px-1"
          onClick={() => setShowMore(!showMore)}
          aria-label="More"
          aria-expanded={showMore}
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium">More</span>
          {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        
        {showMore && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 pb-safe">
            <div className="bg-background border-t border-border rounded-t-2xl shadow-xl max-h-[50vh] overflow-y-auto">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="font-semibold">More</span>
                <Button variant="ghost" size="icon" onClick={() => setShowMore(false)} aria-label="Close">
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
              <nav className="p-2 space-y-1">
                {moreItems.map(moreItem => (
                  <Link
                    key={moreItem.href}
                    href={moreItem.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      pathname === moreItem.href || pathname.startsWith(moreItem.href + "/")
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <moreItem.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{moreItem.label}</span>
                    {moreItem.badge && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
                        {moreItem.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderNavItem(item: typeof bottomItems[0], isActive: boolean) {
    return (
      <Link
        href={item.href}
        onClick={() => setShowMore(false)}
        className={cn(
          "flex flex-col items-center gap-1 px-1 h-10 transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <item.icon className="h-5 w-5" />
        <span className="text-xs font-medium truncate max-w-[5rem]">{item.label}</span>
        {item.badge && (
          <span className="text-[9px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30 px-1.5">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="grid grid-cols-5 gap-1 px-2 py-1.5 pb-safe">
        {bottomItems.map((item, index) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + "/"))
          const isMore = item.label === "More"
          
          return (
            <React.Fragment key={item.href}>
              {isMore ? renderMoreButton() : renderNavItem(item, isActive)}
            </React.Fragment>
          )}
        )}
      </div>
    </div>
  )
}