"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, GlassCard, GlassCardContent, GlassCardHeader } from "@/components/ui/card"
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
  { label: "Upload Document", href: "/dashboard/documents", icon: FolderOpen, description: "Add study materials" },
  { label: "AI Assistant", href: "/dashboard/assistant", icon: BookOpen, description: "Chat with your AI tutor" },
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, description: "Generate flashcards & notes" },
  { label: "Smart Planner", href: "/dashboard/planner", icon: Calendar, description: "Plan your study schedule" },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, description: "Collaborative research" },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, description: "Manage team projects" },
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

  const stats = [
    { label: "Documents", value: String(data?.stats?.documentsCount ?? 0), icon: FolderOpen, color: "text-blue-500" },
    { label: "Study Materials", value: String(data?.stats?.studyMaterialsCount ?? 0), icon: BookOpen, color: "text-green-500" },
    { label: "Active Projects", value: String(data?.stats?.activeProjectsCount ?? 0), icon: FolderKanban, color: "text-purple-500" },
    { label: "Upcoming Deadlines", value: String(data?.stats?.upcomingDeadlinesCount ?? 0), icon: Calendar, color: "text-orange-500" },
  ]

  const upcomingDeadlines: Array<{ id: string; title: string; subtitle: string; href: string; dueDate: string }> = data?.upcomingDeadlines || []
  const recentDocuments: Array<{ id: string; title: string; subtitle: string; href: string; updatedAt: string; status: string }> = data?.recentDocuments || []
  const attendanceSummary: Array<{ subjectId: string; subjectCode: string; subjectName: string; percentage: number }> = data?.attendanceSummary || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.firstName}!</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your studies today.</p>
      </div>

      {isError && (
        <GlassCard className="border-destructive/50">
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : "Failed to load dashboard metrics"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </GlassCardHeader>
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label}>
            <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </GlassCardHeader>
            <GlassCardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </GlassCardContent>
          </GlassCard>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <GlassCard key={action.label} className="hover:border-primary/40 transition-colors cursor-pointer group">
              <GlassCardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-lg glass-surface flex-shrink-0", "group-hover:bg-primary/20 transition-colors")}>
                    <action.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={action.href} className="font-medium hover:text-primary transition-colors">
                      {action.label}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  </div>
                  <Link href={action.href} className="text-primary hover:text-primary/80">
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <GlassCard>
          <GlassCardHeader>
            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((item) => (
                  <Link key={item.id} href={item.href} className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {formatDate(item.dueDate)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <CardTitle className="text-lg">Recent Documents</CardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
              ) : (
                <div>
                  {recentDocuments.map((doc) => (
                    <Link key={doc.id} href="/dashboard/documents" className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{doc.title}</span>
                      </div>
                      <Badge variant={doc.status === "READY" ? "default" : "outline"} className="text-xs">
                        {doc.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full mt-2" asChild>
                <Link href="/dashboard/documents">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <CardTitle className="text-lg">Attendance Overview</CardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : attendanceSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No attendance data available</p>
            ) : (
              <div>
                {attendanceSummary.map((subj) => (
                  <div key={subj.subjectId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{subj.subjectCode} - {subj.subjectName}</span>
                      <span className="text-muted-foreground">{subj.percentage}%</span>
                    </div>
                    <Progress value={subj.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  )
}
