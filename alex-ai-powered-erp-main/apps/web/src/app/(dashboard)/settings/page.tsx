"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Shield, Bell, Palette, Save, Loader2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  createdAt: string
}

interface NotificationPreference {
  category: string
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("profile")
  const [isLoading, setIsLoading] = React.useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const updateProfile = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast({ title: "Profile updated" })
    },
    onError: () => toast({ title: "Error", description: "Failed to update profile", variant: "destructive" }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateProfile.mutate({ firstName: fd.get('firstName') as string, lastName: fd.get('lastName') as string }) }} className="space-y-4 max-w-md">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>First Name</Label>
                    <Input name="firstName" defaultValue={profile?.user?.firstName} required />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input name="lastName" defaultValue={profile?.user?.lastName} required />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" defaultValue={profile?.user?.email} disabled />
                  <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Input defaultValue={profile?.user?.role} disabled />
                </div>
                <div>
                  <Label>Member Since</Label>
                  <Input defaultValue={profile?.user?.createdAt ? formatDate(profile?.user?.createdAt) : 'Unknown'} disabled />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline">Enable 2FA</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
                <Button variant="outline">Change Password</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Manage your logged-in devices</p>
                </div>
                <Button variant="outline">View Sessions</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CATEGORIES.map(category => (
                  <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{category.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">Notifications for {category.toLowerCase().replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={true} />
                        <span className="text-sm">In-App</span>
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={false} />
                        <span className="text-sm">Email</span>
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <Switch checked={false} />
                        <span className="text-sm">Push</span>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Theme</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="System" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label>Font Size</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label>Compact Mode</Label>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Data Export</p>
                    <p className="text-sm text-muted-foreground">Download all your data in JSON format</p>
                  </div>
                  <Button variant="outline">Export Data</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const CATEGORIES = [
  "ASSIGNMENT",
  "ATTENDANCE",
  "INTERNAL_ASSESSMENT",
  "ACADEMIC_ANNOUNCEMENT",
  "PROJECT_MILESTONE",
  "MENTOR_FEEDBACK",
  "RESEARCH_UPDATE",
  "STUDY_REMINDER",
  "UPCOMING_DEADLINE",
  "DOCUMENT_PROCESSING_FAILURE",
  "AI_TASK_COMPLETION",
]
