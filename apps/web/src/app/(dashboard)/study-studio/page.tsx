"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"
import { Plus, FileText, Sparkles, Brain, BookOpen, Target, Zap, Download, Copy, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { MindMapViewer } from "@/components/study-studio/MindMapViewer"
import { DiagramViewer } from "@/components/study-studio/DiagramViewer"
import { QuizViewer } from "@/components/study-studio/QuizViewer"

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

interface MindMapData {
  id: string
  title: string
  sourceDocId: string
  nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
  createdAt: string
}

interface DiagramData {
  id: string
  title: string
  type: string
  definition: { type: string; code: string; title?: string }
  createdAt: string
}

interface QuizData {
  id: string
  title: string
  difficulty: string
  questions: Array<{
    id: string
    prompt: string
    options: string[]
    answer: number
    explanation?: string
  }>
  createdAt: string
}

export default function StudyStudioPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = React.useState("notes")
  const [selectedDeck, setSelectedDeck] = React.useState<string | null>(null)
  const [reviewMode, setReviewMode] = React.useState(false)
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [selectedSourceDoc, setSelectedSourceDoc] = React.useState("")
  
  // States for generated content viewers
  const [generatedMindMap, setGeneratedMindMap] = React.useState<MindMapData | null>(null)
  const [generatedDiagram, setGeneratedDiagram] = React.useState<DiagramData | null>(null)
  const [generatedQuiz, setGeneratedQuiz] = React.useState<QuizData | null>(null)
  
  // Fetch user documents
  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
  })

  // Fetch existing mind maps
  const { data: mindMaps } = useQuery({
    queryKey: ['mindmaps'],
    queryFn: async () => {
      const res = await fetch('/api/mindmaps/generate')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Fetch existing diagrams
  const { data: diagrams } = useQuery({
    queryKey: ['diagrams'],
    queryFn: async () => {
      const res = await fetch('/api/diagrams/generate')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Fetch existing quizzes
  const { data: quizzes } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const res = await fetch('/api/quizzes/generate')
      if (!res.ok) return []
      return res.json()
    },
  })

  // Fetch study notes
  const { data: notes } = useQuery({
    queryKey: ['study-materials'],
    queryFn: async () => {
      const res = await fetch('/api/study-materials')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  // Fetch flashcard decks
  const { data: decks } = useQuery({
    queryKey: ['flashcard-decks'],
    queryFn: async () => {
      const res = await fetch('/api/flashcards/decks')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  // Fetch deck cards
  const { data: deckCards } = useQuery({
    queryKey: ['flashcards', selectedDeck],
    queryFn: async () => {
      if (!selectedDeck) return { cards: [] }
      const res = await fetch(`/api/flashcards/decks/${selectedDeck}/cards`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: !!selectedDeck,
  })

  // Generate study notes
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-materials'] })
      toast({ title: "Notes generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate notes", variant: "destructive" }),
  })

  // Generate flashcards
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard-decks'] })
      setSelectedDeck(data.deckId)
      setActiveTab("flashcards")
      toast({ title: "Flashcards generated successfully" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message || "Failed to generate flashcards", variant: "destructive" }),
  })

  // Review flashcard
  const reviewCard = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
      const res = await fetch(`/api/flashcards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      if (!res.ok) throw new Error('Review failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', selectedDeck] })
      if (currentCardIndex < (deckCards?.cards?.length || 0) - 1) {
        setCurrentCardIndex(prev => prev + 1)
      } else {
        setReviewMode(false)
        toast({ title: "Review complete!" })
      }
      setShowAnswer(false)
    },
    onError: () => toast({ title: "Error", description: "Failed to submit review", variant: "destructive" }),
  })

  // Generate mind map
  const generateMindMap = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    try {
      const res = await fetch('/api/mindmaps/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ sourceDocId: selectedSourceDoc }) 
      })
      const data = await res.json()
      if (!res.ok) { 
        toast({ title: 'Generation failed', description: data.error, variant: 'destructive' }); 
        return 
      }
      setGeneratedMindMap(data.mindMap)
      toast({ title: 'Mind map generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate mind map', variant: 'destructive' })
    }
  }, [selectedSourceDoc])

  // Generate diagram
  const generateDiagram = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    try {
      const res = await fetch('/api/diagrams/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          customType: 'mermaid', 
          customCode: 'flowchart TD\n  A[Source document] --> B[Key concepts]', 
          title: 'Document overview', 
          sourceDocId: selectedSourceDoc 
        }) 
      })
      const data = await res.json()
      if (!res.ok) { 
        toast({ title: 'Generation failed', description: data.error, variant: 'destructive' }); 
        return 
      }
      setGeneratedDiagram(data)
      toast({ title: 'Diagram generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate diagram', variant: 'destructive' })
    }
  }, [selectedSourceDoc])

  // Generate quiz
  const generateQuiz = React.useCallback(async () => {
    if (!selectedSourceDoc) { 
      toast({ title: "Select a document first" }); 
      return 
    }
    try {
      const res = await fetch('/api/quizzes/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ sourceDocId: selectedSourceDoc }) 
      })
      const data = await res.json()
      if (!res.ok) { 
        toast({ title: 'Generation failed', description: data.error, variant: 'destructive' }); 
        return 
      }
      setGeneratedQuiz(data.quiz)
      toast({ title: 'Quiz generated successfully' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate quiz', variant: 'destructive' })
    }
  }, [selectedSourceDoc])

  // Close generated content
  const closeGenerated = React.useCallback((type: 'mindmap' | 'diagram' | 'quiz') => {
    if (type === 'mindmap') setGeneratedMindMap(null)
    else if (type === 'diagram') setGeneratedDiagram(null)
    else if (type === 'quiz') setGeneratedQuiz(null)
  }, [])

  const documentsList = Array.isArray(documents) ? documents : (documents?.documents || [])
  const filteredDocuments = documentsList.filter((d: any) => d.status === "READY")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study Studio</h1>
        <p className="text-muted-foreground mt-1">Generate and manage your study materials</p>
      </div>

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
            {[
              { type: "concise", title: "Concise Notes", icon: FileText, desc: "Key points only" },
              { type: "detailed", title: "Detailed Notes", icon: BookOpen, desc: "Comprehensive coverage" },
              { type: "exam", title: "Exam Notes", icon: Target, desc: "High-yield for tests" },
              { type: "formulas", title: "Formula Sheet", icon: Zap, desc: "Equations & constants" },
              { type: "definitions", title: "Definitions", icon: Sparkles, desc: "Key terms explained" },
              { type: "comparison", title: "Comparison Table", icon: Brain, desc: "Side-by-side analysis" },
            ].map(item => (
              <Card 
                key={item.type} 
                onClick={() => { 
                  if (selectedSourceDoc) generateNotes.mutate({ sourceDocId: selectedSourceDoc, type: item.type }); 
                  else toast({ title: "Select a document first", description: "Choose a processed document below to generate this study material." }) 
                }} 
                className="hover:shadow-md transition-shadow cursor-pointer"
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
            <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc}>
              <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
              <SelectContent>
                {(documentsList || []).map((doc: any) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DocumentUpload
            onSuccess={(doc) => {
              setSelectedSourceDoc(doc.id)
            }}
          />
          <DocumentList documents={documentsList} showUpload={false} />

          {notes?.materials?.map((material: StudyMaterial) => (
            <Card key={material.id} className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{material.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{material.type} · {material.topic || 'General'}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-h-60 overflow-y-auto whitespace-pre-wrap">{material.content}</div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* FLASHCARDS TAB */}
        <TabsContent value="flashcards" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Flashcard Decks</h2>
            <Button onClick={() => setSelectedDeck("new")}>
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
                    <Input placeholder="e.g., Biology Chapter 1" />
                  </div>
                  <div>
                    <Label>Source Document</Label>
                    <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc}>
                      <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                      <SelectContent>
                        {(documentsList || []).map((doc: any) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of Cards</Label>
                    <Input type="number" defaultValue="20" min="5" max="100" />
                  </div>
                  <Button type="submit" disabled={!selectedSourceDoc} onClick={e => { e.preventDefault(); generateFlashcards.mutate({ sourceDocId: selectedSourceDoc, count: 20 }) }}>
                    Generate Flashcards
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : selectedDeck ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Review Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    {deckCards?.cards?.length || 0} cards · Card {currentCardIndex + 1} of {deckCards?.cards?.length || 0}
                  </p>
                </div>
                <Button onClick={() => setReviewMode(true)} disabled={reviewMode}>
                  {reviewMode ? "Reviewing..." : "Start Review"}
                </Button>
              </div>

              {reviewMode && deckCards?.cards?.[currentCardIndex] ? (
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="pt-6 pb-8">
                    <div className="text-center">
                      <div className="mb-4 text-sm text-muted-foreground">
                        Card {currentCardIndex + 1} of {deckCards.cards.length}
                      </div>
                      <div
                        className="h-64 border rounded-lg p-8 flex items-center justify-center cursor-pointer bg-card"
                        onClick={() => setShowAnswer(true)}
                      >
                        {showAnswer ? (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Answer</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].back}</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-2xl font-medium mb-4">Question</p>
                            <p className="text-lg whitespace-pre-wrap">{deckCards.cards[currentCardIndex].front}</p>
                            <p className="mt-4 text-sm text-muted-foreground">Click to reveal answer</p>
                          </div>
                        )}
                      </div>
                      {showAnswer && (
                        <div className="mt-6 flex justify-center gap-2">
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 1 })}>Again</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 2 })}>Hard</Button>
                          <Button variant="default" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 3 })}>Good</Button>
                          <Button variant="outline" onClick={() => reviewCard.mutate({ cardId: deckCards.cards[currentCardIndex].id, rating: 4 })}>Easy</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
            </div>
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
        <TabsContent value="mindmaps" className="mt-4 space-y-6">
          {/* Generated mind map viewer */}
          {generatedMindMap && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedMindMap.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('mindmap')} aria-label="Close mind map">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MindMapViewer 
                  data={{ 
                    nodes: generatedMindMap.nodes, 
                    edges: generatedMindMap.edges 
                  }} 
                  title={generatedMindMap.title}
                  onDownloadPdf={() => window.print()}
                  className="h-[600px]"
                />
              </CardContent>
            </Card>
          )}

          {/* Generate new mind map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generate Mind Map
              </CardTitle>
              <CardDescription>
                Create a structured concept mind map from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} style={{ minWidth: 300 }}>
                  <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
                  <SelectContent>
                    {(documentsList || []).map((doc: any) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={generateMindMap} disabled={!selectedSourceDoc}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Mind Map
                </Button>
              </div>
              
              <DocumentUpload
                onSuccess={(doc) => {
                  setSelectedSourceDoc(doc.id)
                }}
              />
              <DocumentList documents={documentsList} showUpload={false} />
            </CardContent>
          </Card>

          {/* Existing mind maps list */}
          {(mindMaps?.length > 0 || (mindMaps as any)?.mindMaps?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Mind Maps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(mindMaps as any)?.mindMaps?.map?.((mindMap: MindMapData) => (
                    <Card key={mindMap.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle>{mindMap.title}</CardTitle>
                        <CardDescription>{mindMap.nodes.length} nodes · {mindMap.edges.length} connections</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MindMapViewer 
                          data={{ 
                            nodes: mindMap.nodes, 
                            edges: mindMap.edges 
                          }} 
                          title={mindMap.title}
                          className="h-[300px]"
                        />
                      </CardContent>
                    </Card>
                  )) || []}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DIAGRAMS TAB */}
        <TabsContent value="diagrams" className="mt-4 space-y-6">
          {/* Generated diagram viewer */}
          {generatedDiagram && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedDiagram.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('diagram')} aria-label="Close diagram">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DiagramViewer 
                  definition={generatedDiagram.definition}
                  title={generatedDiagram.title}
                  onDownloadPdf={() => window.print()}
                  height={600}
                />
              </CardContent>
            </Card>
          )}

          {/* Generate new diagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Generate Diagram
              </CardTitle>
              <CardDescription>
                Create Mermaid, Graphviz, or PlantUML diagrams from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} style={{ minWidth: 300 }}>
                  <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
                  <SelectContent>
                    {(documentsList || []).map((doc: any) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={generateDiagram} disabled={!selectedSourceDoc}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Diagram
                </Button>
              </div>
              
              <DocumentUpload
                onSuccess={(doc) => {
                  setSelectedSourceDoc(doc.id)
                }}
              />
              <DocumentList documents={documentsList} showUpload={false} />
            </CardContent>
          </Card>

          {/* Existing diagrams list */}
          {(diagrams?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Diagrams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {diagrams.map((diagram: DiagramData) => (
                    <Card key={diagram.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle>{diagram.title}</CardTitle>
                        <CardDescription>{diagram.type} diagram</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DiagramViewer 
                          definition={diagram.definition}
                          title={diagram.title}
                          height={300}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* QUIZZES TAB */}
        <TabsContent value="quizzes" className="mt-4 space-y-6">
          {/* Generated quiz viewer */}
          {generatedQuiz && (
            <Card className="animate-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{generatedQuiz.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{generatedQuiz.difficulty}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => closeGenerated('quiz')} aria-label="Close quiz">
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <QuizViewer 
                  quiz={generatedQuiz}
                  onExportPdf={() => window.print()}
                />
              </CardContent>
            </Card>
          )}

          {/* Generate new quiz */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Generate Quiz
              </CardTitle>
              <CardDescription>
                Create multiple-choice quizzes grounded in your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={selectedSourceDoc} onValueChange={setSelectedSourceDoc} style={{ minWidth: 300 }}>
                  <SelectTrigger><SelectValue placeholder="Select a processed document" /></SelectTrigger>
                  <SelectContent>
                    {(documentsList || []).map((doc: any) => <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={generateQuiz} disabled={!selectedSourceDoc}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Quiz
                </Button>
              </div>
              
              <DocumentUpload
                onSuccess={(doc) => {
                  setSelectedSourceDoc(doc.id)
                }}
              />
              <DocumentList documents={documentsList} showUpload={false} />
            </CardContent>
          </Card>

          {/* Existing quizzes list */}
          {(quizzes?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Quizzes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {quizzes.map((quiz: QuizData) => (
                    <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle>{quiz.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{quiz.difficulty}</Badge>
                          <Badge variant="secondary">{quiz.questions.length} questions</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <QuizViewer quiz={quiz} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}