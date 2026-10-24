"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import {
  FolderOpen,
  BookOpen,
  Calendar,
  FlaskConical,
  FolderKanban,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
  Bot,
  Sparkles,
  Zap,
  Brain,
  Award,
  Bell,
  UserCheck,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

interface DashboardProps {
  user: {
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

const quickActions = [
  { label: "AI Assistant", href: "/dashboard/assistant", icon: Bot, description: "Chat with your AI tutor", primary: true },
  { label: "Upload Document", href: "/dashboard/documents", icon: FolderOpen, description: "Add study materials" },
  { label: "Study Studio", href: "/dashboard/study-studio", icon: Brain, description: "Generate flashcards & notes" },
  { label: "Smart Planner", href: "/dashboard/planner", icon: Calendar, description: "Plan your study schedule" },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, description: "Collaborative research" },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, description: "Manage team projects" },
]

const stats = [
  { label: "Documents", icon: FolderOpen, color: "text-primary", bg: "bg-primary/10" },
  { label: "Study Materials", icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Active Projects", icon: FolderKanban, color: "text-accent", bg: "bg-accent/10" },
  { label: "Upcoming Deadlines", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10" },
]

export function StudentDashboard({ user }: DashboardProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-stats", "student"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load dashboard data")
      }
      return res.json()
    },
  })

  const statValues = [
    { label: "Documents", value: String(data?.stats?.documentsCount ?? 0), icon: FolderOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Study Materials", value: String(data?.stats?.studyMaterialsCount ?? 0), icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Active Projects", value: String(data?.stats?.activeProjectsCount ?? 0), icon: FolderKanban, color: "text-accent", bg: "bg-accent/10" },
    { label: "Upcoming Deadlines", value: String(data?.stats?.upcomingDeadlinesCount ?? 0), icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10" },
  ]

  const upcomingDeadlines = data?.upcomingDeadlines || []
  const recentDocuments = data?.recentDocuments || []
  const attendanceSummary = data?.attendanceSummary || []

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {user.firstName}!</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your studies today.</p>
      </div>

      {/* Error State */}
      {isError && (
        <Card className="panel border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : "Failed to load dashboard metrics"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statValues.map((stat) => (
          <Card key={stat.label} className="panel-hover panel">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={cn("p-2 rounded-xl", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card key={action.label} className="panel-hover panel transition-all duration-300 group">
              <CardContent className="pt-6">
                <Link href={action.href} className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-xl flex-shrink-0 transition-all duration-300 group-hover:scale-105",
                    action.primary ? "bg-gradient-primary" : "bg-primary/10"
                  )}>
                    <action.icon className={cn("h-6 w-6", action.primary ? "text-primary-foreground" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  </div>
                  <span className="text-primary group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming Deadlines */}
        <Card className="panel h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                <p className="text-xs text-muted-foreground/60 mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((item: { id: string; title: string; subtitle: string; dueDate: string; href: string }) => (
                  <Link key={item.id} href={item.href} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary hover:border-primary/20 transition-all duration-200 group">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap border-amber-500/30 text-amber-400 bg-amber-500/10">
                      {formatDate(item.dueDate)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card className="panel h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                  <Button variant="outline" className="w-full mt-2" asChild>
                    <Link href="/dashboard/documents">
                      <Plus className="mr-2 h-4 w-4" />
                      Upload Document
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  {recentDocuments.map((doc: { id: string; title: string; status: string }) => (
                    <Link key={doc.id} href="/dashboard/documents" className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50 hover:bg-secondary hover:border-primary/20 transition-all duration-200 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{doc.title}</span>
                      </div>
                      <Badge variant={doc.status === "READY" ? "default" : "outline"} className="text-xs">
                        {doc.status}
                      </Badge>
                    </Link>
                  ))}
                  <Button variant="outline" className="w-full mt-2" asChild>
                    <Link href="/dashboard/documents">
                      <Plus className="mr-2 h-4 w-4" />
                      Upload Document
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Overview */}
        <Card className="panel h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Attendance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : attendanceSummary.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No attendance data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceSummary.map((subj: { subjectId: string; subjectCode: string; subjectName: string; percentage: number }) => (
                  <div key={subj.subjectId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{subj.subjectCode} - {subj.subjectName}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs font-medium", 
                        subj.percentage >= 75 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                        subj.percentage >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                        "text-destructive border-destructive/30 bg-destructive/10"
                      )}>
                        {subj.percentage}%
                      </Badge>
                    </div>
                    <Progress 
                      value={subj.percentage} 
                      className="h-2" 
                      style={{ 
                        '--progress-color': subj.percentage >= 75 ? '#22c55e' : subj.percentage >= 50 ? '#eab308' : '#ef4444' 
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}