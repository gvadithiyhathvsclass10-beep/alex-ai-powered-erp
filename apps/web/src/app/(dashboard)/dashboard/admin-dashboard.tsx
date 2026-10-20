"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Users,
  Book,
  Calendar,
  Shield,
  Archive,
  Settings,
  Plus,
  ArrowRight,
  GraduationCap,
  Building2,
  Database,
  HardDrive,
  Server,
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

const adminQuickActions = [
  { label: "Manage Users", href: "/dashboard/admin/users", icon: Users, description: "Add, edit, remove users" },
  { label: "Manage Subjects", href: "/dashboard/admin/subjects", icon: Book, description: "Configure subjects" },
  { label: "Academic Calendar", href: "/dashboard/admin/calendar", icon: Calendar, description: "Set academic dates" },
  { label: "Institution Settings", href: "/dashboard/admin/institution", icon: Building2, description: "Configure institution" },
  { label: "Audit Logs", href: "/dashboard/admin/audit", icon: Archive, description: "View system activity" },
  { label: "System Settings", href: "/dashboard/admin/settings", icon: Settings, description: "Global configuration" },
]

const adminStats = [
  { label: "Total Students", value: "0", icon: GraduationCap, color: "text-blue-500" },
  { label: "Total Lecturers", value: "0", icon: Users, color: "text-green-500" },
  { label: "Active Subjects", value: "0", icon: Book, color: "text-purple-500" },
  { label: "Departments", value: "0", icon: Building2, color: "text-orange-500" },
]

export function AdminDashboard({ user }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your institution&apos;s academic system.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
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
          {adminQuickActions.map((action) => (
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
            <CardTitle className="text-lg">Recent Registrations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/admin/users">
                <ArrowRight className="mr-1 h-4 w-4" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No recent registrations</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Database className="h-4 w-4" />Database</span>
                <span className="text-green-500 font-medium">Healthy</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" />Storage</span>
                <span className="text-green-500 font-medium">Healthy</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Server className="h-4 w-4" />Background Jobs</span>
                <span className="text-green-500 font-medium">Running</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}