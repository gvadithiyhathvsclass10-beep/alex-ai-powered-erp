"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Code, 
  Image, 
  Download, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Maximize2,
  Minimize2,
  Settings,
  Zap,
  FileText,
  Monitor,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface DiagramDefinition {
  type: 'mermaid' | 'graphviz' | 'plantuml'
  code: string
  title?: string
}

interface DiagramViewerProps {
  definition: DiagramDefinition
  title?: string
  className?: string
  onDownloadPdf?: () => void
  editable?: boolean
  height?: string | number
}

interface DiagramRendererProps {
  definition: DiagramDefinition
  className?: string
}

function DiagramRenderer({ definition, className }: DiagramRendererProps) {
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  React.useEffect(() => {
    let mounted = true
    let abortController: AbortController | null = null
    
    const renderDiagram = async () => {
      setLoading(true)
      setError(null)
      setSvg(null)
      
      try {
        if (definition.type === 'mermaid') {
          await renderMermaid(definition.code)
        } else if (definition.type === 'graphviz') {
          await renderGraphviz(definition.code)
        } else if (definition.type === 'plantuml') {
          await renderPlantUML(definition.code)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    const renderMermaid = async (code: string) => {
      // Try to use mermaid from CDN or local
      try {
        // Check if mermaid is available globally
        if (typeof window !== 'undefined' && (window as any).mermaid) {
          const mermaid = (window as any).mermaid
          mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'system-ui, sans-serif',
          })
          
          const { svg } = await mermaid.render('diagram-' + Date.now(), code)
          if (mounted) setSvg(svg)
          return
        }
        
        // Fallback: load mermaid from CDN
        await loadScript('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs')
        if ((window as any).mermaid) {
          const mermaid = (window as any).mermaid
          mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'system-ui, sans-serif',
          })
          
          const { svg } = await mermaid.render('diagram-' + Date.now(), code)
          if (mounted) setSvg(svg)
          return
        }
        
        throw new Error('Mermaid not available')
      } catch {
        // Use fallback SVG
        setSvg(buildFallbackSvg('mermaid', code))
      }
    }
    
    const renderGraphviz = async (code: string) => {
      try {
        // Try @viz-js/viz
        const vizModule = await import('@viz-js/viz')
        const instance = await vizModule.instance()
        const svg = instance.renderString(code, { format: 'svg', engine: 'dot' })
        if (mounted && svg && svg.includes('<svg')) {
          setSvg(svg)
          return
        }
        throw new Error('Graphviz rendering failed')
      } catch {
        // Use fallback
        setSvg(buildFallbackSvg('graphviz', code))
      }
    }
    
    const renderPlantUML = async (code: string) => {
      // PlantUML requires server-side rendering, use fallback
      setSvg(buildFallbackSvg('plantuml', code))
    }
    
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.type = 'module'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
      })
    }
    
    renderDiagram()
    
    return () => {
      mounted = false
      if (abortController) abortController.abort()
    }
  }, [definition])
  
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[300px]", className)}>
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Rendering {definition.type} diagram…</span>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full min-h-[300px] p-6 text-center", className)}>
        <AlertCircle className="h-12 w-12 text-destructive mb-3" />
        <h4 className="font-medium text-destructive mb-1">Failed to render diagram</h4>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <div className="font-mono text-xs bg-muted p-3 rounded max-w-md text-left overflow-auto">
          {definition.code.slice(0, 500)}{definition.code.length > 500 ? '…' : ''}
        </div>
      </div>
    )
  }
  
  if (!svg) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[300px]", className)}>
        <p className="text-muted-foreground">No diagram output</p>
      </div>
    )
  }
  
  // Sanitize and display SVG
  return (
    <div 
      className={cn("w-full h-full min-h-[300px] overflow-auto", className)}
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}

function sanitizeSvg(svg: string): string {
  // Remove potentially dangerous content
  return svg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
}

function buildFallbackSvg(diagramType: string, code: string): string {
  const lines = code
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('%%') && !l.startsWith('@startuml') && !l.startsWith('@enduml') && !l.startsWith('//'))
  
  const nodes: string[] = []
  for (const line of lines) {
    const bracketMatches = [...line.matchAll(/\[([^\]]+)\]|\(([^)]+)\)|"([^"]+)"/g)]
    if (bracketMatches.length > 0) {
      for (const m of bracketMatches) {
        const label = (m[1] || m[2] || m[3] || '').trim()
        if (label && !nodes.includes(label)) nodes.push(label)
      }
    } else if (line.includes('-->') || line.includes('->') || line.includes('--')) {
      const parts = line.split(/-->|->|--/).map(p => p.replace(/[^a-zA-Z0-9 _-]/g, '').trim()).filter(Boolean)
      for (const p of parts) {
        if (p && !nodes.includes(p)) nodes.push(p)
      }
    }
  }
  
  const displayNodes = nodes.length > 0 ? nodes.slice(0, 8) : lines.slice(0, 6)
  const height = Math.max(300, displayNodes.length * 80 + 100)
  const width = 700
  
  const boxes = displayNodes
    .map((label, idx) => {
      const y = 60 + idx * 75
      const arrow = idx < displayNodes.length - 1
        ? `<line x1="350" y1="${y + 50}" x2="350" y2="${y + 75}" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)" />`
        : ''
      return `
        <rect x="100" y="${y}" width="500" height="50" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5" />
        <text x="350" y="${y + 30}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#1e1b4b">${escapeXml(label.slice(0, 60))}</text>
        ${arrow}
      `
    })
    .join('\n')
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white" rx="12" />
  <text x="24" y="32" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#64748b">${escapeXml(diagramType.toUpperCase())} DIAGRAM (Fallback)</text>
  ${boxes}
</svg>`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;')
}

export function DiagramViewer({ 
  definition, 
  title, 
  className, 
  onDownloadPdf,
  editable = false,
  height = 500
}: DiagramViewerProps) {
  const [activeTab, setActiveTab] = React.useState<string>('diagram')
  const [copied, setCopied] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  
  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(definition.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleDownloadSvg = () => {
    if (activeTab !== 'diagram') return
    const svgElement = document.querySelector('.diagram-viewer svg')
    if (!svgElement) return
    
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'diagram').replace(/\s+/g, '-')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleDownloadPdf = async () => {
    if (onDownloadPdf) {
      onDownloadPdf()
    } else {
      window.print()
    }
  }
  
  return (
    <div 
      className={cn("relative rounded-xl border bg-card flex flex-col", className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {definition.type === 'mermaid' && <Zap className="h-5 w-5 text-amber-500" />}
            {definition.type === 'graphviz' && <Monitor className="h-5 w-5 text-blue-500" />}
            {definition.type === 'plantuml' && <FileText className="h-5 w-5 text-green-500" />}
            {title || definition.title || 'Diagram'}
          </h3>
          <Badge variant="outline" className="text-xs capitalize">{definition.type}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg" 
                  onClick={handleCopyCode} 
                  aria-label="Copy code"
                >
                  <Copy className={cn("h-4 w-4", copied && "text-primary")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                {copied ? "Copied!" : "Copy code"}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg" 
                  onClick={handleDownloadSvg} 
                  aria-label="Download SVG"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">Download SVG</TooltipContent>
            </Tooltip>
            
            {onDownloadPdf && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg" 
                    onClick={handleDownloadPdf} 
                    aria-label="Download PDF"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">Download PDF</TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg" 
                  onClick={() => setFullscreen(!fullscreen)} 
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                {fullscreen ? "Exit fullscreen" : "Fullscreen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="border-b px-4 bg-muted/30">
          <TabsTrigger value="diagram" className="gap-1">
            <Image className="h-4 w-4" />
            Diagram
          </TabsTrigger>
          <TabsTrigger value="code" className="gap-1">
            <Code className="h-4 w-4" />
            Source
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="diagram" className="flex-1 p-0">
          <div className="diagram-viewer h-full w-full p-4" style={{ overflow: 'auto' }}>
            <DiagramRenderer definition={definition} />
          </div>
        </TabsContent>
        
        <TabsContent value="code" className="flex-1 p-0">
          <div className="h-full w-full p-4 overflow-auto">
            <pre className="font-mono text-sm bg-muted/50 p-4 rounded-none h-full m-0 overflow-auto">
              <code>{definition.code}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Fullscreen modal */}
      {fullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-background flex flex-col"
          onClick={() => setFullscreen(false)}
        >
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
            <h3 className="font-semibold">{title || definition.title || 'Diagram'}</h3>
            <Button variant="ghost" size="icon" onClick={() => setFullscreen(false)}>
              <Minimize2 className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4" onClick={e => e.stopPropagation()}>
            <DiagramRenderer definition={definition} className="w-full h-full min-h-[600px]" />
          </div>
        </div>
      )}
    </div>
  )
}