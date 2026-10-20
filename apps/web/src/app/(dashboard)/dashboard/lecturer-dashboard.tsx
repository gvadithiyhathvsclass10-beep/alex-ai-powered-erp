"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  FolderOpen,
  BookOpen,
  Calendar,
  Users,
  UserCheck,
  ClipboardCheck,
  FileText,
  Bell,
  Plus,
  ArrowRight,
  Book,
  ClipboardList,
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

const lecturerQuickActions = [
  { label: "Mark Attendance", href: "/dashboard/attendance/mark", icon: UserCheck, description: "Record class attendance" },
  { label: "Create Assessment", href: "/dashboard/assessments/create", icon: ClipboardCheck, description: "Add new assessment" },
  { label: "Create Assignment", href: "/dashboard/assignments/create", icon: FileText, description: "Assign coursework" },
  { label: "Upload Resources", href: "/dashboard/subjects/resources", icon: BookOpen, description: "Share study materials" },
  { label: "View Subjects", href: "/dashboard/subjects", icon: Book, description: "Manage your subjects" },
  { label: "Grade Submissions", href: "/dashboard/assignments", icon: ClipboardList, description: "Review student work" },
]

const lecturerStats = [
  { label: "Assigned Subjects", value: "0", icon: Book, color: "text-blue-500" },
  { label: "Pending Attendance", value: "0", icon: UserCheck, color: "text-yellow-500" },
  { label: "Ungraded Submissions", value: "0", icon: ClipboardList, color: "text-red-500" },
  { label: "Active Students", value: "0", icon: Users, color: "text-green-500" },
]

export function LecturerDashboard({ user }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, Dr. {user.lastName}!</h1>
        <p className="text-muted-foreground mt-1">Manage your classes and assessments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {lecturerStats.map((stat) => (
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
          {lecturerQuickActions.map((action) => (
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Today&apos;s Classes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/attendance/mark">
                <Plus className="mr-1 h-4 w-4" />
                Mark Attendance
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No classes scheduled today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Grading</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/assignments">
                <ArrowRight className="mr-1 h-4 w-4" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No pending submissions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No recent announcements</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}