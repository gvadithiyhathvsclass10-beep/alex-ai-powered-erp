"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { Calendar } from "@/components/ui/calendar"
import { Plus, Clock, Target, Brain, Sparkles, Calendar as CalendarIcon, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { formatDate, formatRelativeTime, formatDateTime, cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface PlannerEvent {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  allDay: boolean
  eventType: string
  subjectId: string | null
  taskId: string | null
  subject: { id: string; name: string; code: string } | null
  createdAt: string
}

interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  completedAt: string | null
  isCompleted: boolean
  priority: number
  createdAt: string
}

export default function PlannerPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("calendar")
  const [selectedDate, setSelectedDate] = React.useState(new Date())
  const [viewMode, setViewMode] = React.useState<"month" | "week" | "day">("week")

  const { data: events } = useQuery({
    queryKey: ['planner-events'],
    queryFn: async () => {
      const res = await fetch('/api/planner/events')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const createEvent = useMutation({
    mutationFn: async (data: Partial<PlannerEvent>) => {
      const res = await fetch('/api/planner/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-events'] })
      toast({ title: "Event created" })
    },
    onError: () => toast({ title: "Error", description: "Failed to create event", variant: "destructive" }),
  })

  const createTask = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast({ title: "Task created" })
    },
    onError: () => toast({ title: "Error", description: "Failed to create task", variant: "destructive" }),
  })

  const updateTask = useMutation({
    mutationFn: async (task: Task) => {
      const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, isCompleted: !task.isCompleted }) })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); toast({ title: 'Task updated' }) },
    onError: () => toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' }),
  })

  const todayEvents = events?.events?.filter((e: PlannerEvent) => {
    const eventDate = new Date(e.startTime)
    return eventDate.toDateString() === new Date().toDateString()
  }) || []

  const upcomingTasks = tasks?.tasks?.filter((t: Task) => !t.isCompleted && t.dueDate).sort((a: Task, b: Task) => 
    new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
  ).slice(0, 5) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Planner</h1>
          <p className="text-muted-foreground mt-1">AI-powered academic planning and scheduling</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("calendar")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            Calendar
          </Button>
          <Button variant="outline" onClick={() => setActiveTab("tasks")}>
            <Target className="mr-2 h-4 w-4" />
            Tasks
          </Button>
          <Button variant="outline" onClick={() => setActiveTab("ai-planner")}>
            <Brain className="mr-2 h-4 w-4" />
            AI Planner
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="study-plan">Study Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Events</CardTitle>
                <CalendarIcon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayEvents.length}</div>
                <p className="text-sm text-muted-foreground">Events scheduled for today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                <Target className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingTasks.length}</div>
                <p className="text-sm text-muted-foreground">Tasks due this week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Hours This Week</CardTitle>
                <Clock className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0h</div>
                <p className="text-sm text-muted-foreground">Tracked study time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today&apos;s Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {todayEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No events scheduled for today</p>
                ) : (
                  <div className="space-y-3">
                    {todayEvents.map((event: PlannerEvent) => (
                      <div key={event.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 w-12 text-center text-sm text-muted-foreground">
                          {formatDateTime(event.startTime, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.subject?.code || event.eventType}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No upcoming deadlines</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingTasks.map((task: Task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Due {formatRelativeTime(task.dueDate!)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => updateTask.mutate(task)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => new Date(d.setMonth(d.getMonth() - 1)))}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-xl font-semibold">{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => new Date(d.setMonth(d.getMonth() + 1)))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>Month</Button>
              <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setViewMode("week")}>Week</Button>
              <Button variant={viewMode === "day" ? "default" : "outline"} size="sm" onClick={() => setViewMode("day")}>Day</Button>
            </div>
          </div>
          <Calendar
            mode={viewMode === "month" ? "single" : viewMode === "week" ? "range" : "single"}
            selected={selectedDate}
            onSelect={(date) => {
              if (date instanceof Date) {
                setSelectedDate(date)
              }
            }}
            initialFocus={new Date()}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <Button onClick={() => setActiveTab("ai-planner")}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
          <Card>
            <CardContent className="pt-0">
              {tasks?.tasks?.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No tasks yet. Create one to get started.</p>
                  <Button className="mt-4" onClick={() => setActiveTab("ai-planner")}>Create Task</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks?.tasks?.map((task: Task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Button
                        variant={task.isCompleted ? "default" : "outline"}
                        size="icon"
                        onClick={() => updateTask.mutate(task)}
                        className={task.isCompleted ? "text-green-500" : ""}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium", task.isCompleted && "line-through text-muted-foreground")}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {task.dueDate && <span>Due {formatRelativeTime(task.dueDate)}</span>}
                          <span>Priority: {task.priority}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon"><AlertCircle className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="study-plan" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Study Plan Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Generate a personalized study schedule based on your goals, upcoming assessments, and available time.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Study Goal</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam-prep">Exam Preparation</SelectItem>
                      <SelectItem value="assignment">Assignment Completion</SelectItem>
                      <SelectItem value="review">Content Review</SelectItem>
                      <SelectItem value="research">Research Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Available Hours/Week</Label>
                  <Input type="number" defaultValue="15" min="1" max="40" />
                </div>
              </div>
              <div>
                <Label>Focus Subjects</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="math">Mathematics</SelectItem>
                    <SelectItem value="cs">Computer Science</SelectItem>
                    <SelectItem value="physics">Physics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => toast({ title: "Study plan generation requires task generation setup", description: "Add your subjects and tasks first; AI generation will use those records when enabled." })}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Study Plan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

