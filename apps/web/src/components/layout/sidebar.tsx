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
  BookOpen,
  Calendar,
  Book,
  FlaskConical,
  FolderKanban,
  Users,
  ClipboardCheck,
  FileText,
  Cloud,
  Award,
  Bell,
  Settings,
  GraduationCap,
  UserCheck,
  Library,
  Archive,
  Shield,
  ChevronLeft,
  Plus,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  children?: NavItem[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "AI Assistant", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
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
  { label: "Achievements", href: "/dashboard/achievements", icon: Award, roles: ["STUDENT"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
]

const lecturerOnlyItems: NavItem[] = [
  { label: "Create Subject", href: "/dashboard/subjects", icon: Plus, roles: ["LECTURER", "ADMIN"] },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"] },
  { label: "Create Assessment", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["LECTURER"] },
  { label: "Create Assignment", href: "/dashboard/assignments", icon: FileText, roles: ["LECTURER"] },
  { label: "Manage Resources", href: "/dashboard/subjects", icon: Library, roles: ["LECTURER", "ADMIN"] },
]

const adminOnlyItems: NavItem[] = [
  { label: "User Management", href: "/dashboard/settings", icon: Users, roles: ["ADMIN"] },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Shield, roles: ["ADMIN"] },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, roles: ["ADMIN"] },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, roles: ["ADMIN"] },
]

function NavLink({ item, isActive, userRole }: { item: NavItem; isActive: boolean; userRole: string }) {
  if (!item.roles.includes(userRole)) return null

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors glass-nav-item",
        isActive
          ? "glass-nav-item.active text-primary"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.label}
    </Link>
  )
}

export function Sidebar({ userRole, className }: { userRole: string; className?: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  const filteredItems = navItems.filter(item => item.roles.includes(userRole))
  const filteredLecturerItems = lecturerOnlyItems.filter(item => item.roles.includes(userRole))
  const filteredAdminItems = adminOnlyItems.filter(item => item.roles.includes(userRole))

  return (
    <aside
      className={cn(
        "glass-sidebar fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        "-translate-x-full lg:translate-x-0",
        className
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border px-4 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/30">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="tracking-tight">ALEX</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 glass-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Main navigation">
          <div className="space-y-0.5">
            {filteredItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                userRole={userRole}
              />
            ))}
          </div>

          {filteredLecturerItems.length > 0 && !collapsed && (
            <div className="pt-3 space-y-0.5 border-t border-border/50">
              <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Lecturer Tools
              </p>
              {filteredLecturerItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  userRole={userRole}
                />
              ))}
            </div>
          )}

          {filteredAdminItems.length > 0 && !collapsed && (
            <div className="pt-3 space-y-0.5 border-t border-border/50">
              <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Administration
              </p>
              {filteredAdminItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  userRole={userRole}
                />
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-border/50 p-3 bg-background/30">
          {!collapsed && (
            <div className="text-[10px] text-muted-foreground text-center">
              ALEX v0.1.0
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
