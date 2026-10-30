"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { MarkdownRenderer } from "@/components/ui/markdown"
import { MindMapViewer } from "@/components/study-studio/mind-map-viewer"
import { DiagramViewer } from "@/components/diagrams/DiagramViewer"
import { FlashcardReviewer } from "@/components/study-studio/flashcard-reviewer"
import { QuizTaker } from "@/components/study-studio/quiz-taker"

interface StudyMaterial {
  id: string
  title: string
  content: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  topic: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface FlashcardDeck {
  id: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  algorithm: string
  _count: { cards: number }
  createdAt: string
  updatedAt: string
}

interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  difficulty: number
  interval: number
  repetitions: number
  easeFactor: number
  nextReview: string
  lastReviewed: string | null
}

interface MindMap {
  id: string
  title: string
  sourceDocId: string | null
  subjectId: string | null
  nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
  viewport?: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

interface Diagram {
  id: string
  title: string
  type: string
  sourceDocId: string | null
  subjectId: string | null
  definition: {
    type: "mermaid" | "graphviz" | "plantuml" | "svg" | "description"
    code: string
    title: string
    description?: string
  }
  renderedUrl: string | null
  createdAt: string
  updatedAt: string
}

interface Quiz {
  id: string
  title: string
  description: string | null
  subjectId: string | null
  sourceDocId: string | null
  topic: string | null
  difficulty: string
  questions: Array<{
    id: string
    prompt: string
    options: string[]
    answer: number
    explanation?: string
  }>
  timeLimit: number | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export default function StudyStudioPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notes")
  const [selectedDeck, setSelectedDeck] = React.useState<string | null>(null)
  const [selectedMindMap, setSelectedMindMap] = React.useState<string | null>(null)
  const [selectedDiagram, setSelectedDiagram] = React.useState<string | null>(null)
  const [selectedQuiz, setSelectedQuiz] = React.useState<string | null>(null)
  const [selectedSourceDoc, setSelectedSourceDoc] = React.useState("")
  const [generationState, setGenerationState] = React.useState<{
    type: string | null
    loading: boolean
    error: string | null
  }>({ type: null, loading: false, error: null })

  const { data: notes } = useQuery({
    queryKey: ['study-materials'],
    queryFn: async () => {
      const res = await fetch('/api/study-materials')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: decks } = useQuery({
    queryKey: ['flashcard-decks'],
    queryFn: async () => {
      const res = await fetch('/api/flashcards/decks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: mindMaps } = useQuery({
    queryKey: ['mind-maps'],
    queryFn: async () => {
      const res = await fetch('/api/mindmaps')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: diagrams } = useQuery({
    queryKey: ['diagrams'],
    queryFn: async () => {
      const res = await fetch('/api/diagrams')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: quizzes } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const res = await fetch('/api/quizzes')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
  })

  const { data: deckCards } = useQuery({
    queryKey: ['flashcards', selectedDeck],
    queryFn: async () => {
      if (!selectedDeck) return { cards: [] }
      const res = await fetch(`/api/flashcards/decks/${selectedDeck}/cards`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedDeck && selectedDeck !== "new",
  })

  const generateNotes = useMutation({
    mutationFn: async ({ sourceDocId, type }: { sourceDocId: string; type: string }) => {
      const res = await fetch('/api/study-materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId, type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onMutate: () => {
      setGenerationState({ type: 'notes', loading: true, error: null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-materials'] })
      setGenerationState({ type: null, loading: false, error: null })
      toast({ title: "Notes generated successfully" })
    },
    onError: (err: Error) => {
      setGenerationState({ type: null, loading: false, error: err.message })
      toast({ title: "Error", description: err.message || "Failed to generate notes", variant: "destructive" })
    },
  })

  const generateFlashcards = useMutation({
    mutationFn: async ({ sourceDocId, count }: { sourceDocId: string; count: number }) => {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId, count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onMutate: () => {
      setGenerationState({ type: 'flashcards', loading: true, error: null })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] })
      setSelectedDeck(data.deckId)
      setActiveTab("flashcards")
      setGenerationState({ type: null, loading: false, error: null })
      toast({ title: "Flashcards generated successfully" })
    },
    onError: (err: Error) => {
      setGenerationState({ type: null, loading: false, error: err.message })
      toast({ title: "Error", description: err.message || "Failed to generate flashcards", variant: "destructive" })
    },
  })

  const generateMindMap = useMutation({
    mutationFn: async ({ sourceDocId }: { sourceDocId: string }) => {
      const res = await fetch('/api/mindmaps/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onMutate: () => {
      setGenerationState({ type: 'mindmaps', loading: true, error: null })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mind-maps'] })
      setSelectedMindMap(data.mindMap.id)
      setActiveTab("mindmaps")
      setGenerationState({ type: null, loading: false, error: null })
      toast({ title: "Mind Map generated successfully" })
    },
    onError: (err: Error) => {
      setGenerationState({ type: null, loading: false, error: err.message })
      toast({ title: "Error", description: err.message || "Failed to generate mind map", variant: "destructive" })
    },
  })

  const generateDiagram = useMutation({
    mutationFn: async ({ sourceDocId }: { sourceDocId: string }) => {
      const res = await fetch('/api/diagrams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceDocId,
          customType: 'mermaid',
          customCode: 'flowchart TD\n  A[Source document] --> B[Key concepts]',
          title: 'Document overview'
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onMutate: () => {
      setGenerationState({ type: 'diagrams', loading: true, error: null })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['diagrams'] })
      setSelectedDiagram(data.id)
      setActiveTab("diagrams")
      setGenerationState({ type: null, loading: false, error: null })
      toast({ title: "Diagram generated successfully" })
    },
    onError: (err: Error) => {
      setGenerationState({ type: null, loading: false, error: err.message })
      toast({ title: "Error", description: err.message || "Failed to generate diagram", variant: "destructive" })
    },
  })

  const generateQuiz = useMutation({
    mutationFn: async ({ sourceDocId }: { sourceDocId: string }) => {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      return data
    },
    onMutate: () => {
      setGenerationState({ type: 'quizzes', loading: true, error: null })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      setSelectedQuiz(data.quiz.id)
      setActiveTab("quizzes")
      setGenerationState({ type: null, loading: false, error: null })
      toast({ title: "Quiz generated successfully" })
    },
    onError: (err: Error) => {
      setGenerationState({ type: null, loading: false, error: err.message })
      toast({ title: "Error", description: err.message || "Failed to generate quiz", variant: "destructive" })
    },
  })

  const noteTypes = [
    { type: "concise", title: "Concise Notes", icon: FileText, desc: "Key points only" },
    { type: "detailed", title: "Detailed Notes", icon: BookOpen, desc: "Comprehensive coverage" },
    { type: "exam", title: "Exam Notes", icon: Target, desc: "High-yield for tests" },
    { type: "formulas", title: "Formula Sheet", icon: Zap, desc: "Equations & constants" },
    { type: "definitions", title: "Definitions", icon: Sparkles, desc: "Key terms explained" },
    { type: "comparison", title: "Comparison Table", icon: Brain, desc: "Side-by-side analysis" },
  ]

  const handleGenerateNote = (type: string) => {
    if (!selectedSourceDoc) {
      toast({ title: "Select a document first", description: "Choose a processed document below to generate this study material." })
      return
    }
    generateNotes.mutate({ sourceDocId: selectedSourceDoc, type })
  }

  const handleGenerateFlashcards = () => {
    if (!selectedSourceDoc) {
      toast({ title: "Select a document first" })
      return
    }
    generateFlashcards.mutate({ sourceDocId: selectedSourceDoc, count: 20 })
  }

  const handleGenerateMindMap = () => {
    if (!selectedSourceDoc) {
      toast({ title: "Select a document first" })
      return
    }
    generateMindMap.mutate({ sourceDocId: selectedSourceDoc })
  }

  const handleGenerateDiagram = () => {
    if (!selectedSourceDoc) {
      toast({ title: "Select a document first" })
      return
    }
    generateDiagram.mutate({ sourceDocId: selectedSourceDoc })
  }

  const handleGenerateQuiz = () => {
    if (!selectedSourceDoc) {
      toast({ title: "Select a document first" })
      return
    }
    generateQuiz.mutate({ sourceDocId: selectedSourceDoc })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study Studio</h1>
        <p className="text-muted-foreground mt-1">Generate and manage your study materials</p>
      </div>

      {/* Generation Status Indicator */}
      {generationState.loading && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Generating {generationState.type}...</span>
          <span className="text-xs text-muted-foreground">This may take up to 60 seconds for complex materials</span>
        </div>
      )}

      {generationState.error && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Generation failed: {generationState.error}</span>
          <Button variant="ghost" size="sm" onClick={() => setGenerationState({ type: null, loading: false, error: null })}>
            Dismiss
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="notes">Smart Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="mindmaps">Mind Maps</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
        </TabsList>

        {/* SMART NOTES TAB */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {noteTypes.map(item => (
              <Card
                key={item.type}
                onClick={() => handleGenerateNote(item.type)}
                className={`hover:shadow-md transition-shadow cursor-pointer ${generateNotes.isPending ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} disabled={generateNotes.isPending}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {generateNotes.isPending && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
          <DocumentUpload
            onSuccess={(doc) => {
              setSelectedSourceDoc(doc.id)
            }}
            disabled={generateNotes.isPending}
          />
          <DocumentList documents={documents?.documents || []} showUpload={false} />

          {notes?.materials?.map((material: StudyMaterial) => (
            <Card key={material.id} className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{material.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{material.type} · {material.topic || 'General'}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={material.content} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* FLASHCARDS TAB */}
        <TabsContent value="flashcards" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Flashcard Decks</h2>
            <Button onClick={() => setSelectedDeck("new")} disabled={generateFlashcards.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>

          {selectedDeck === "new" ? (
            <Card>
              <CardHeader>
                <CardTitle>Create New Deck</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={e => { e.preventDefault(); }} className="space-y-4">
                  <div>
                    <Label>Deck Title</Label>
                    <Input placeholder="e.g., Biology Chapter 1" disabled={generateFlashcards.isPending} />
                  </div>
                  <div>
                    <Label>Source Document</Label>
                    <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} disabled={generateFlashcards.isPending}>
                      <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                      <SelectContent>
                        {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of Cards</Label>
                    <Input type="number" defaultValue="20" min="5" max="100" disabled={generateFlashcards.isPending} />
                  </div>
                  <Button type="submit" disabled={!selectedSourceDoc || generateFlashcards.isPending} onClick={e => { e.preventDefault(); handleGenerateFlashcards() }}>
                    {generateFlashcards.isPending ? (
                      <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... </> 
                    ) : (
                      'Generate Flashcards'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : selectedDeck ? (
            <FlashcardReviewer
              deckId={selectedDeck}
              cards={deckCards?.cards || []}
              onClose={() => setSelectedDeck(null)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks?.decks?.map((deck: FlashcardDeck) => (
                <Card key={deck.id} onClick={() => setSelectedDeck(deck.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{deck.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{deck._count.cards} cards · {deck.algorithm}</p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedDeck(deck.id) }}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MIND MAPS TAB */}
        <TabsContent value="mindmaps" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Mind Maps</h2>
              <p className="text-sm text-muted-foreground">Generate hierarchical concept maps from your documents</p>
            </div>
            <Button onClick={handleGenerateMindMap} disabled={!selectedSourceDoc || generateMindMap.isPending}>
              {generateMindMap.isPending ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... </> 
              ) : (
                <> <Sparkles className="mr-2 h-4 w-4" /> Generate Mind Map </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} disabled={generateMindMap.isPending}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedMindMap && mindMaps?.mindMaps?.find((m: MindMap) => m.id === selectedMindMap) ? (
            <MindMapViewer
              mindMap={mindMaps.mindMaps.find((m: MindMap) => m.id === selectedMindMap)!}
              onClose={() => setSelectedMindMap(null)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mindMaps?.mindMaps?.map((map: MindMap) => (
                <Card key={map.id} onClick={() => setSelectedMindMap(map.id)} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{map.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{map.nodes?.length || 0} nodes · {map.edges?.length || 0} connections</p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedMindMap(map.id) }}>
                      View Mind Map
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DIAGRAMS TAB */}
        <TabsContent value="diagrams" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Diagrams</h2>
              <p className="text-sm text-muted-foreground">Generate and view Mermaid diagrams from your documents</p>
            </div>
            <Button onClick={handleGenerateDiagram} disabled={!selectedSourceDoc || generateDiagram.isPending}>
              {generateDiagram.isPending ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... </> 
              ) : (
                <> <Zap className="mr-2 h-4 w-4" /> Generate Diagram </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} disabled={generateDiagram.isPending}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedDiagram && diagrams?.diagrams?.find((d: Diagram) => d.id === selectedDiagram) ? (
            <DiagramViewer
              definition={diagrams.diagrams.find((d: Diagram) => d.id === selectedDiagram)!.definition}
              className="h-[600px]"
              editable
              onSave={(code) => {
                // TODO: Implement diagram save
                console.log('Save diagram:', code)
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {diagrams?.diagrams?.map((diagram: Diagram) => (
                <Card key={diagram.id} onClick={() => setSelectedDiagram(diagram.id)} className="cursor-pointer hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="truncate">{diagram.title}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">{diagram.type}</p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedDiagram(diagram.id) }}>
                      View Diagram
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* QUIZZES TAB */}
        <TabsContent value="quizzes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Quizzes</h2>
              <p className="text-sm text-muted-foreground">Generate and take practice quizzes from your documents</p>
            </div>
            <Button onClick={handleGenerateQuiz} disabled={!selectedSourceDoc || generateQuiz.isPending}>
              {generateQuiz.isPending ? (
                <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating... </> 
              ) : (
                <> <Target className="mr-2 h-4 w-4" /> Generate Quiz </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} disabled={generateQuiz.isPending}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documents?.documents || []).map((doc: { id: string; title: string }) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedQuiz && quizzes?.quizzes?.find((q: Quiz) => q.id === selectedQuiz) ? (
            <QuizTaker
              quiz={quizzes.quizzes.find((q: Quiz) => q.id === selectedQuiz)!}
              onClose={() => setSelectedQuiz(null)}
              onComplete={() => {
                setSelectedQuiz(null)
                queryClient.invalidateQueries({ queryKey: ['quizzes'] })
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quizzes?.quizzes?.map((quiz: Quiz) => (
                <Card key={quiz.id} onClick={() => setSelectedQuiz(quiz.id)} className="cursor-pointer hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="truncate">{quiz.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {quiz.questions?.length || 0} questions · {quiz.difficulty} difficulty
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline" onClick={e => { e.stopPropagation(); setSelectedQuiz(quiz.id) }}>
                      Take Quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}