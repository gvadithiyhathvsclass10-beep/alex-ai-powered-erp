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
  Sparkles,
  Brain,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  badge?: string
}

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

function NavLink({ item, isActive, userRole, collapsed }: { item: NavItem; isActive: boolean; userRole: string; collapsed: boolean }) {
  if (!item.roles.includes(userRole)) return null

  const baseClasses = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
  const activeClasses = "bg-primary/15 border-l-2 border-primary text-primary shadow-[inset_0_0_20px_-5px_rgba(0,212,255,0.15)]"
  const inactiveClasses = "text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/10"

  return (
    <Link
      href={item.href}
      className={cn(baseClasses, isActive ? activeClasses : inactiveClasses)}
      title={collapsed ? item.label : undefined}
    >
      <span className="flex-shrink-0">
        <item.icon className={cn("h-5 w-5", isActive && "text-primary")} aria-hidden="true" />
      </span>
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function SectionHeader({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <p className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 mt-4">
      {title}
    </p>
  )
}

interface AssistantSidebarProps {
  userRole: string
  isOpen: boolean
}

export function AssistantSidebar({ userRole, isOpen, onToggle }: AssistantSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  const filteredItems = navItems.filter(item => item.roles.includes(userRole))
  const filteredLecturerItems = lecturerOnlyItems.filter(item => item.roles.includes(userRole))
  const filteredAdminItems = adminOnlyItems.filter(item => item.roles.includes(userRole))

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar transition-all duration-300 ease-out flex flex-col",
        collapsed ? "w-16 lg:w-16" : "w-80 lg:w-80",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      aria-label="Navigation & conversations"
    >
      <div className="flex h-full flex-col">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-3 font-bold text-lg relative z-10 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
                <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
              </div>
              <span className="text-foreground">ALEX</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="flex items-center justify-center relative z-10 group" title="ALEX Dashboard">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
                <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
              </div>
            </Link>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-secondary relative z-10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
          <SectionHeader title="AI Assistant" collapsed={collapsed} />
          
          <div className="space-y-1">
            {filteredItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                userRole={userRole}
                collapsed={collapsed}
              />
            ))}
          </div>

          {filteredLecturerItems.length > 0 && !collapsed && (
            <>
              <SectionHeader title="Lecturer Tools" collapsed={collapsed} />
              <div className="space-y-1 border-t border-sidebar-border pt-4">
                {filteredLecturerItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={pathname === item.href}
                    userRole={userRole}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </>
          )}

          {filteredAdminItems.length > 0 && !collapsed && (
            <>
              <SectionHeader title="Administration" collapsed={collapsed} />
              <div className="space-y-1 border-t border-sidebar-border pt-4">
                {filteredAdminItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={pathname === item.href}
                    userRole={userRole}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          {!collapsed && (
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
          )}
          {collapsed && (
            <div className="text-center text-xs text-muted-foreground/60">
              <Sparkles className="mx-auto h-3 w-3 text-primary mb-1" />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}