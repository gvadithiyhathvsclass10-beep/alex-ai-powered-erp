"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Bot,
  FolderOpen,
  Cloud,
  BookOpen,
  Calendar,
  Book,
  FlaskConical,
  FolderKanban,
  UserCheck,
  ClipboardCheck,
  FileText,
  Bell,
  Settings,
  GraduationCap,
  Users,
  Shield,
  Plus,
  Sparkles,
  Brain,
  Library,
  Archive,
  ChevronUp,
  ChevronDown,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  badge?: string
}

const moreMenuItems: Array<NavItem & { badge?: string }> = [
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, roles: ["STUDENT"] },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["STUDENT", "LECTURER", "ADMIN"] },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Personal Drive", href: "/dashboard/drive", icon: Cloud, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assignments", href: "/dashboard/assignments", icon: FileText, roles: ["STUDENT", "LECTURER"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
]

const lecturerOnlyMoreItems: NavItem[] = [
  { label: "Create Subject", href: "/dashboard/subjects", icon: Plus, roles: ["LECTURER", "ADMIN"] },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"] },
  { label: "Create Assessment", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["LECTURER"] },
  { label: "Create Assignment", href: "/dashboard/assignments", icon: FileText, roles: ["LECTURER"] },
  { label: "Manage Resources", href: "/dashboard/subjects", icon: Library, roles: ["LECTURER", "ADMIN"] },
]

const adminOnlyMoreItems: NavItem[] = [
  { label: "User Management", href: "/dashboard/settings", icon: Users, roles: ["ADMIN"] },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Shield, roles: ["ADMIN"] },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, roles: ["ADMIN"] },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, roles: ["ADMIN"] },
]

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "AI Assistant", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], badge: "AI" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Personal Drive", href: "/dashboard/drive", icon: Cloud, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, roles: ["STUDENT"] },
  { label: "Smart Planner", href: "/dashboard/planner", icon: Calendar, roles: ["STUDENT"] },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["STUDENT", "LECTURER", "ADMIN"] },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assignments", href: "/dashboard/assignments", icon: FileText, roles: ["STUDENT", "LECTURER"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
]

const lecturerOnlyItems = [
  { label: "Create Subject", href: "/dashboard/subjects", icon: Plus, roles: ["LECTURER", "ADMIN"] },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"] },
  { label: "Create Assessment", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["LECTURER"] },
  { label: "Create Assignment", href: "/dashboard/assignments", icon: FileText, roles: ["LECTURER"] },
  { label: "Manage Resources", href: "/dashboard/subjects", icon: Library, roles: ["LECTURER", "ADMIN"] },
]

const adminOnlyItems = [
  { label: "User Management", href: "/dashboard/settings", icon: Users, roles: ["ADMIN"] },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Shield, roles: ["ADMIN"] },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, roles: ["ADMIN"] },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, roles: ["ADMIN"] },
]

// Main nav items for bottom nav (most frequently used)
const bottomNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "AI Chat", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], badge: "AI" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Planner", href: "/dashboard/planner", icon: Calendar, roles: ["STUDENT"] },
  { label: "More", href: "#", icon: Sparkles, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
]

interface MobileNavProps {
  userRole: string
  onOpenMenu: () => void
}

export function MobileBottomNav({ userRole, onOpenMenu }: MobileNavProps) {
  const pathname = usePathname()
  const [showMore, setShowMore] = React.useState(false)

  const filteredBottomItems = bottomNavItems.filter(item => item.roles.includes(userRole))

  const moreItems = React.useMemo(() => {
    const items: NavItem[] = moreMenuItems.filter(item => item.roles.includes(userRole))

    if (userRole === "LECTURER" || userRole === "ADMIN") {
      items.push(...lecturerOnlyMoreItems.filter(item => item.roles.includes(userRole)))
    }

    if (userRole === "ADMIN") {
      items.push(...adminOnlyMoreItems.filter(item => item.roles.includes(userRole)))
    }

    return items
  }, [userRole])

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

  function renderNavItem(item: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: string }, isActive: boolean) {
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
        {filteredBottomItems.map((item, index) => {
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