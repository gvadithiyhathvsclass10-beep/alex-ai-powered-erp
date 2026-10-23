"use client"

<<<<<<< HEAD
import { useEffect } from "react"
=======
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
import { useRouter } from "next/navigation"
import { StudentDashboard } from "./student-dashboard"
import { LecturerDashboard } from "./lecturer-dashboard"
import { AdminDashboard } from "./admin-dashboard"
import { useAuth } from "@/components/auth/AuthProvider"

interface UserWithRole {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  activeMembership?: {
    role: string
    institutionId: string
    departmentId: string | null
    courseId: string | null
    semesterId: string | null
  }
}

export default function DashboardPage() {
<<<<<<< HEAD
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const userWithRole: UserWithRole = {
    id: user.id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: user.avatarUrl || null,
    role: user.role || 'STUDENT',
    activeMembership: user.activeMembership,
  }

  const role = userWithRole.activeMembership?.role ?? userWithRole.role

  return (
    <>
=======
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()
  const [userWithRole, setUserWithRole] = useState<UserWithRole | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user) {
        setUserLoading(false)
        return
      }

      // The user object from useAuth already contains the role and activeMembership
      // from the server-side /api/auth/me endpoint
      setUserWithRole({
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        avatarUrl: user.avatarUrl || null,
        role: user.role || 'STUDENT',
        activeMembership: user.activeMembership,
      })
      setUserLoading(false)
    }

    fetchUserProfile()
  }, [user])

  if (loading || userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!userWithRole) {
    router.push("/login")
    return null
  }

  const role = userWithRole.activeMembership?.role ?? userWithRole.role

  return (
    <DashboardLayout>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      {role === "ADMIN" && <AdminDashboard user={userWithRole} />}
      {role === "LECTURER" && <LecturerDashboard user={userWithRole} />}
      {role === "STUDENT" && <StudentDashboard user={userWithRole} />}
      {role === "PROJECT_MENTOR" && <LecturerDashboard user={userWithRole} />}
<<<<<<< HEAD
    </>
=======
    </DashboardLayout>
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  )
}