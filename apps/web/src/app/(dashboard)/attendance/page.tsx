"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Plus, CheckCircle, XCircle, AlertCircle, Calendar, Download, UserCheck } from "lucide-react"
import { formatDate, formatRelativeTime, calculatePercentage } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface AttendanceSession {
  id: string
  subjectId: string
  semesterId: string
  date: string
  period: number
  topic: string | null
  conductedBy: string
  isCancelled: boolean
  subject: { id: string; name: string; code: string }
  records: AttendanceRecord[]
}

interface AttendanceRecord {
  id: string
  sessionId: string
  userId: string
  status: string
  markedBy: string
  markedAt: string
  user: { id: string; firstName: string; lastName: string; studentId: string | null }
}

interface SubjectAttendance {
  subjectId: string
  subjectName: string
  subjectCode: string
  present: number
  absent: number
  total: number
  percentage: number
}

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("overview")
  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null)

  const { data: sessions } = useQuery({
    queryKey: ['attendance-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/sessions')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: myAttendance } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/my')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const markAttendance = useMutation({
    mutationFn: async (data: { sessionId: string; records: { userId: string; status: string }[] }) => {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to mark')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
      toast({ title: "Attendance marked" })
    },
    onError: () => toast({ title: "Error", description: "Failed to mark attendance", variant: "destructive" }),
  })

  const createSession = useMutation({
    mutationFn: async (data: { subjectId: string; date: string; period: number; topic?: string }) => {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })
      toast({ title: "Session created" })
    },
    onError: () => toast({ title: "Error", description: "Failed to create session", variant: "destructive" }),
  })

  const subjectStats = myAttendance?.subjects?.map((s: SubjectAttendance) => ({
    ...s,
    status: s.percentage >= 75 ? 'good' : s.percentage >= 50 ? 'warning' : 'danger',
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track and manage class attendance</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {myAttendance?.overallPercentage || 0}%
                </div>
                <p className="text-sm text-muted-foreground">Across all subjects</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{myAttendance?.totalPresent || 0}</div>
                <p className="text-sm text-muted-foreground">Out of {myAttendance?.totalConducted || 0} classes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Classes Missed</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{myAttendance?.totalAbsent || 0}</div>
                <p className="text-sm text-muted-foreground">Need to catch up</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subject-wise Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {subjectStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No attendance data available</p>
              ) : (
                <div className="space-y-4">
                  {subjectStats.map((subject: SubjectAttendance & { status: string }) => (
                    <Card key={subject.subjectId}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{subject.subjectCode} - {subject.subjectName}</p>
                            <p className="text-sm text-muted-foreground">
                              {subject.present} / {subject.total} classes attended
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Progress value={subject.percentage} className="w-48" />
                            <Badge variant={
                              subject.status === 'good' ? 'success' :
                              subject.status === 'warning' ? 'warning' : 'destructive'
                            }>
                              {subject.percentage}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions?.sessions?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent sessions</p>
              ) : (
                <div className="space-y-2">
                  {sessions?.sessions?.slice(0, 5).map((session: AttendanceSession) => (
                    <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{session.subject.code} - {session.topic || 'Class'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(session.date)} · Period {session.period}
                        </p>
                      </div>
                      <Badge variant={session.isCancelled ? 'secondary' : 'outline'}>
                        {session.isCancelled ? 'Cancelled' : 'Conducted'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mark" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mark Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Subject</Label>
                  <Select onValueChange={setSelectedSubject}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {myAttendance?.subjects?.map((s: SubjectAttendance) => (
                        <SelectItem key={s.subjectId} value={s.subjectId}>{s.subjectCode} - {s.subjectName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <DatePicker />
                </div>
                <div>
                  <Label>Period</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8].map(p => <SelectItem key={p} value={p.toString()}>Period {p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Topic (Optional)</Label>
                <Input placeholder="What was covered in this class?" />
              </div>
              <Button onClick={() => {}}>
                <Plus className="mr-2 h-4 w-4" />
                Create Session & Mark Attendance
              </Button>
            </CardContent>
          </Card>

          {selectedSubject && sessions?.sessions?.find((s: { subjectId: string }) => s.subjectId === selectedSubject) && (
            <Card>
              <CardHeader>
                <CardTitle>Mark Attendance for Selected Session</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Click on a student to toggle their status</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessions?.sessions?.find((s: { subjectId: string }) => s.subjectId === selectedSubject)?.records?.map((record: AttendanceRecord) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {record.user.firstName[0]}{record.user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{record.user.firstName} {record.user.lastName}</p>
                          <p className="text-sm text-muted-foreground">{record.user.studentId || 'No student ID'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={record.status === 'PRESENT' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {}}
                        >
                          <CheckCircle className="h-4 w-4" /> Present
                        </Button>
                        <Button
                          variant={record.status === 'ABSENT' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => {}}
                        >
                          <XCircle className="h-4 w-4" /> Absent
                        </Button>
                        <Button
                          variant={record.status === 'LATE' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {}}
                        >
                          <AlertCircle className="h-4 w-4" /> Late
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="mt-4" onClick={() => {}}>Save Attendance</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions?.sessions?.map((session: AttendanceSession) => (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{session.subject.code} - {session.topic || 'Class'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(session.date)} · Period {session.period} · {session.records.length} students
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={session.isCancelled ? 'secondary' : 'outline'}>
                        {session.isCancelled ? 'Cancelled' : 'Conducted'}
                      </Badge>
                      <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}