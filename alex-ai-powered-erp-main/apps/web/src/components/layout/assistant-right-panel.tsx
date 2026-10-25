"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatRelativeTime } from "@/lib/utils"
import {
  ChevronRight,
  Upload,
  Settings,
  FileText,
  Sparkles,
  Zap,
  Brain,
  FlaskConical,
  Calendar,
  FolderKanban,
  Book,
} from "lucide-react"

interface AssistantRightPanelProps {
  isOpen: boolean
  onToggle: (open: boolean) => void
  activeProvider?: {
    id: string
    name: string
    model: string
    isActive: boolean
    isDefault: boolean
  } | null
  recentDocuments?: Array<{
    id: string
    title: string
    documentType: string
    createdAt: string
  }>
  onNavigate?: (path: string) => void
}

function QuickActionButton({ icon: Icon, label, description, onClick, primary }: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-lg transition-all duration-200 flex items-center gap-3 text-left",
        primary
          ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-[0_0_20px_-5px_rgba(0,212,255,0.4)]"
          : "bg-secondary hover:bg-surface-hover border border-border/50 hover:border-primary/20"
      )}
    >
      <div className={cn("p-2 rounded-lg flex-shrink-0", primary ? "bg-primary-foreground/20" : "bg-primary/10")}>
        <Icon className={cn("h-5 w-5", primary ? "text-primary-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{label}</p>
        <p className="text-xs truncate">{primary ? description : <span className="text-muted-foreground">{description}</span>}</p>
      </div>
    </button>
  )
}

function QuickLink({ icon: Icon, label, href, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; href: string; onClick?: () => void }) {
  const router = useRouter()
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onClick) onClick()
    else router.push(href)
  }
  return (
    <button onClick={handleClick} className="flex items-center gap-3 p-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 w-full text-left">
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

export function AssistantRightPanel({ 
  isOpen, 
  onToggle, 
  activeProvider, 
  recentDocuments = [],
  onNavigate
}: AssistantRightPanelProps) {
  const router = useRouter()

  const handleNavigate = (path: string) => {
    if (onNavigate) onNavigate(path)
    else router.push(path)
  }

  if (!isOpen) return null

  return (
    <aside
      className={cn(
        "h-screen border-l bg-sidebar transition-all duration-300 ease-out flex flex-col",
        "w-80"
      )}
      aria-label="Utility panel"
    >
      <div className="flex h-full flex-col">
        {/* Panel Header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-primary/5 pointer-events-none" />
          <h2 className="font-semibold text-foreground relative z-10">Quick Actions</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(false)}
            className="h-8 w-8 rounded-lg transition-all duration-200 hover:bg-secondary relative z-10"
            aria-label="Close utility panel"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Actions</h3>
              <QuickActionButton
                icon={Upload}
                label="Upload Document"
                description="Add files to your knowledge base"
                onClick={() => handleNavigate("/dashboard/documents")}
                primary
              />
              <QuickActionButton
                icon={Settings}
                label="AI Settings"
                description="Configure providers & models"
                onClick={() => handleNavigate("/dashboard/ai-settings")}
              />
              <QuickActionButton
                icon={FileText}
                label="Browse Documents"
                description="View all uploaded documents"
                onClick={() => handleNavigate("/dashboard/documents")}
              />
              <QuickActionButton
                icon={Sparkles}
                label="Solution Generator"
                description="Generate structured solutions"
                onClick={() => handleNavigate("/dashboard/solution-generator")}
              />
            </div>

            {/* Model Info */}
            <div className="space-y-3 border-t border-sidebar-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Model Info</h3>
              {activeProvider ? (
                <div className="panel-elevated p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{activeProvider.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{activeProvider.model}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-2xl font-bold text-primary">Chat</p>
                      <p className="text-xs text-muted-foreground">Primary</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary">
                      <p className="text-2xl font-bold text-accent">RAG</p>
                      <p className="text-xs text-muted-foreground">Enabled</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="panel-elevated p-4 text-center text-muted-foreground">
                  No provider configured
                </div>
              )}
            </div>

            {/* Recent Documents */}
            <div className="space-y-3 border-t border-sidebar-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Recent Documents</h3>
              {recentDocuments.length > 0 ? (
                <div className="space-y-2">
                  {recentDocuments.slice(0, 5).map((doc: { id: string; title: string; documentType: string; createdAt: string }) => (
                    <div key={doc.id} className="panel-elevated p-3 hover:border-primary/20 transition-all duration-200">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">{doc.documentType} • {formatRelativeTime(doc.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-sm" onClick={() => handleNavigate("/dashboard/documents")}>
                    View All Documents
                  </Button>
                </div>
              ) : (
                <div className="panel-elevated p-4 text-center text-muted-foreground">
                  <FileText className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
                  <p className="text-sm">No documents yet</p>
                  <Button variant="outline" className="mt-2 w-full" onClick={() => handleNavigate("/dashboard/documents")}>
                    Upload First Document
                  </Button>
                </div>
              )}
            </div>

            {/* Useful Links */}
            <div className="space-y-3 border-t border-sidebar-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Quick Links</h3>
              <div className="space-y-2">
                <QuickLink icon={Brain} label="Study Studio" href="/dashboard/study-studio" onClick={() => handleNavigate("/dashboard/study-studio")} />
                <QuickLink icon={FlaskConical} label="Research Lab" href="/dashboard/research" onClick={() => handleNavigate("/dashboard/research")} />
                <QuickLink icon={Calendar} label="Smart Planner" href="/dashboard/planner" onClick={() => handleNavigate("/dashboard/planner")} />
                <QuickLink icon={FolderKanban} label="Projects" href="/dashboard/projects" onClick={() => handleNavigate("/dashboard/projects")} />
                <QuickLink icon={Book} label="Subjects" href="/dashboard/subjects" onClick={() => handleNavigate("/dashboard/subjects")} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}