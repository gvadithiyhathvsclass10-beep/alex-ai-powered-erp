"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GraduationCap,
  Bot,
  Brain,
  Calendar,
  Shield,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  FileText,
  FlaskConical,
} from "lucide-react"

const features = [
  {
    icon: Bot,
    title: "Agentic AI Assistant",
    description: "ALEX understands natural language, searches your documents, and executes tasks with persistent memory.",
  },
  {
    icon: FileText,
    title: "RAG-Powered Learning",
    description: "Upload documents and get grounded answers with citations. Generate flashcards, mind maps, and study notes.",
  },
  {
    icon: Calendar,
    title: "Smart Academic Planner",
    description: "AI-generated study schedules based on your goals, deadlines, and performance. Daily briefings and reminders.",
  },
  {
    icon: FlaskConical,
    title: "Collaborative Research",
    description: "NotebookLM-style research workspaces with source-grounded answers, literature matrices, and paper drafting.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure multi-tenant architecture with student, lecturer, mentor, and admin roles. Row-level security.",
  },
  {
    icon: Zap,
    title: "Multi-Model AI Router",
    description: "Bring your own API keys. Support for OpenAI, Gemini, Anthropic, Mistral, Groq, and more.",
  },
]

const stats = [
  { value: "10+", label: "AI Providers Supported" },
  { value: "15+", label: "Document Formats" },
  { value: "50+", label: "Academic Features" },
  { value: "∞", label: "Customizable Workflows" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-primary/5 to-accent/5 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-30 blur-lg" />
            </div>
            <span className="text-xl font-bold text-foreground">ALEX</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              How It Works
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/register">
              <Button className="btn-primary-gradient">
                <span>Get Started Free</span>
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32 text-center relative">
          <div className="max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-full mb-8 animate-in">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">New: AI Research Lab & Collaborative Projects</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-in" style={{ animationDelay: '100ms' }}>
              Your AI Academic{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">Intelligence</span> Companion
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto animate-in" style={{ animationDelay: '200ms' }}>
              ALEX combines autonomous agentic AI, fully functional RAG, persistent memory, and academic management
              into one powerful platform for students, lecturers, and institutions.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-in" style={{ animationDelay: '300ms' }}>
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto btn-primary-gradient px-8 py-3">
                  <span className="flex items-center gap-2">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto panel-hover px-8 py-3">
                  Explore Features
                </Button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 animate-in" style={{ animationDelay: '400ms' }}>
              {stats.map((stat) => (
                <div key={stat.label} className="text-center panel p-6 rounded-xl">
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="text-center mb-16 animate-in">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full mb-4">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Core Capabilities</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Everything You Need to Excel</h2>
            <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
              ALEX is built for real academic workflows with connected documents, planning, assessment, and AI tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={feature.title} className="panel-hover panel h-full animate-in overflow-hidden" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className="relative p-3 rounded-xl bg-primary/10 text-primary inline-flex">
                    <feature.icon className="h-6 w-6" />
                    <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-20 blur-lg" />
                  </div>
                  <CardTitle className="mt-4 text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-muted-foreground/80">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-primary font-medium text-sm">
                    <ArrowRight className="h-4 w-4" />
                    Learn more
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="absolute inset-0 bg-gradient-radial pointer-events-none -z-10" />
          <div className="relative text-center mb-16 animate-in">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full mb-4">
              <Target className="h-4 w-4" />
              <span className="font-medium">How It Works</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">From Documents to Insights in Four Steps</h2>
            <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
              ALEX handles the entire pipeline automatically so you can focus on learning.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 relative">
            {[
              { step: "01", title: "Upload Documents", description: "Drag & drop PDFs, DOCX, PPTX, images, and more. Supports 15+ formats with OCR.", icon: FileText },
              { step: "02", title: "Automatic Processing", description: "ALEX extracts, chunks, embeds, and indexes your content with full provenance tracking.", icon: Sparkles },
              { step: "03", title: "Ask Questions", description: "Chat with your documents. Get grounded answers with citations linking to exact pages.", icon: Bot },
              { step: "04", title: "Generate & Learn", description: "Create flashcards, mind maps, diagrams, quizzes, and study plans from your content.", icon: Brain },
            ].map((item, index) => (
              <Card key={item.step} className="panel-hover panel h-full animate-in relative overflow-hidden" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="pt-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl font-bold text-primary/50 font-mono">{item.step}</div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="text-muted-foreground/80 flex-1">{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20 md:py-28 text-center relative">
          <div className="absolute inset-0 bg-gradient-radial pointer-events-none -z-10" />
          <div className="relative max-w-3xl mx-auto animate-in">
            <div className="panel p-8 md:p-12 rounded-2xl border border-primary/20 bg-gradient-subtle relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 -z-10" />
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 relative">Ready to Transform Your Academic Life?</h2>
              <p className="text-xl text-muted-foreground mb-8 relative">
                Join thousands of students and educators using ALEX to study smarter, research faster, and achieve more.
              </p>
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto btn-primary-gradient px-8 py-3 relative">
                  <span className="flex items-center justify-center gap-2">
                    Create Your Free Account
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </Link>
              <p className="mt-6 text-sm text-muted-foreground/60 relative">
                Free forever · No credit card required · Open source
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-12 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">ALEX</span>
              </div>
              <p className="text-sm text-muted-foreground/80">
                AI-powered student intelligence and academic management platform.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4 text-foreground">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground/80">
                <li><Link href="/assistant" className="hover:text-primary transition-colors">AI Assistant</Link></li>
                <li><Link href="/documents" className="hover:text-primary transition-colors">RAG Pipeline</Link></li>
                <li><Link href="/study-studio" className="hover:text-primary transition-colors">Study Studio</Link></li>
                <li><Link href="/planner" className="hover:text-primary transition-colors">Smart Planner</Link></li>
                <li><Link href="/research" className="hover:text-primary transition-colors">Research Lab</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4 text-foreground">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground/80">
                <li><Link href="#how-it-works" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link href="/api/health" className="hover:text-primary transition-colors">API Reference</Link></li>
                <li><Link href="/roadmap" className="hover:text-primary transition-colors">Roadmap</Link></li>
                <li><Link href="https://github.com/gvadithiyhathvsclass10-beep/alex-ai-powered-erp" className="hover:text-primary transition-colors" target="_blank" rel="noopener">GitHub</Link></li>
                <li><Link href="#features" className="hover:text-primary transition-colors">Community</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4 text-foreground">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground/80">
                <li><Link href="#features" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link href="mailto:contact@alex-ai.example" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="#privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="#terms" className="hover:text-primary transition-colors">Terms</Link></li>
                <li><Link href="/api/health" className="hover:text-primary transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border/50 pt-8 text-center text-sm text-muted-foreground/60">
            © 2024 ALEX. Built by G V Adithiyha and Harsha K.
          </div>
        </div>
      </footer>

      </div>
  )
}