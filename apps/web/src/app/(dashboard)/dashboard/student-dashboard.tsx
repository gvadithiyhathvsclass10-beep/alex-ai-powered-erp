"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  FolderOpen,
  BookOpen,
  Calendar,
  FlaskConical,
  FolderKanban,
  UserCheck,
  ClipboardCheck,
  FileText,
  Award,
  Bell,
  Plus,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardProps {
  user: {
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

const quickActions = [
  { label: "Upload Document", href: "/dashboard/documents/upload", icon: FolderOpen, description: "Add study materials" },
  { label: "AI Assistant", href: "/dashboard/assistant", icon: BookOpen, description: "Chat with your AI tutor" },
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, description: "Generate flashcards & notes" },
  { label: "Smart Planner", href: "/dashboard/planner", icon: Calendar, description: "Plan your study schedule" },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, description: "Collaborative research" },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, description: "Manage team projects" },
]

const stats = [
  { label: "Documents", value: "0", icon: FolderOpen, color: "text-blue-500" },
  { label: "Study Materials", value: "0", icon: BookOpen, color: "text-green-500" },
  { label: "Active Projects", value: "0", icon: FolderKanban, color: "text-purple-500" },
  { label: "Upcoming Deadlines", value: "0", icon: Calendar, color: "text-orange-500" },
]

export function StudentDashboard({ user }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.firstName}!</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your studies today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card key={action.label} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-lg bg-primary/10 text-primary", "flex-shrink-0")}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={action.href} className="font-medium hover:text-primary">
                      {action.label}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  </div>
                  <Link href={action.href} className="text-primary hover:text-primary/80">
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
              <Button variant="outline" className="w-full mt-2" asChild>
                <Link href="/dashboard/documents/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No attendance data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}