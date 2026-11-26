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
  Expand,
  Minus,
  Plus,
  RotateCcw,
  Move,
  ArrowUpLeft,
  ArrowDownRight,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { exportDiagramAsSvg, exportDiagramAsPng, exportDiagramAsPdf, DiagramExportData } from "@/lib/study-studio/export"

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
  onSvgLoad?: (svg: string) => void
}

function DiagramRenderer({ definition, className, onSvgLoad }: DiagramRendererProps) {
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  
  React.useEffect(() => {
    let mounted = true
    
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
      let safeCode = code
      try {
        const mermaid = await import('mermaid')
        const { prepareMermaidDefinition } = await import('@/lib/diagrams/mermaid')
        safeCode = prepareMermaidDefinition(code)
        mermaid.default.initialize({ 
          startOnLoad: false, 
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'system-ui, sans-serif',
        })
        
        const { svg } = await mermaid.default.render('diagram-' + Date.now(), safeCode)
        if (mounted) {
          setSvg(svg)
          onSvgLoad?.(svg)
        }
        return
      } catch (mermaidError) {
        console.warn('[DiagramViewer] Mermaid render failed, trying fallback:', mermaidError)
        
        if (typeof window !== 'undefined' && (window as any).mermaid) {
          try {
            const mermaid = (window as any).mermaid
            mermaid.initialize({ 
              startOnLoad: false, 
              theme: 'default',
              securityLevel: 'loose',
              fontFamily: 'system-ui, sans-serif',
            })
            
            const { svg } = await mermaid.render('diagram-' + Date.now(), safeCode)
            if (mounted) {
              setSvg(svg)
              onSvgLoad?.(svg)
            }
            return
          } catch {}
        }
        
        setSvg(buildFallbackSvg('mermaid', code))
      }
    }
    
    const renderGraphviz = async (code: string) => {
      try {
        const vizModule = await import('@viz-js/viz')
        const instance = await vizModule.instance()
        const svg = instance.renderString(code, { format: 'svg', engine: 'dot' })
        if (mounted && svg && svg.includes('<svg')) {
          setSvg(svg)
          onSvgLoad?.(svg)
          return
        }
        throw new Error('Graphviz rendering failed')
      } catch {
        setSvg(buildFallbackSvg('graphviz', code))
      }
    }
    
    const renderPlantUML = async (code: string) => {
      setSvg(buildFallbackSvg('plantuml', code))
    }
    
    renderDiagram()
    
    return () => {
      mounted = false
    }
  }, [definition, onSvgLoad])
  
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
  
  const sanitizedSvg = sanitizeSvg(svg)
  
  return (
    <div 
      className={cn("w-full h-full min-h-[300px]", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
    />
  )
}

function sanitizeSvg(svg: string): string {
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

  const displayNodes = nodes.length > 0 ? nodes.slice(0, 12) : lines.slice(0, 8)
  const nodeHeight = 60
  const nodeSpacing = 20
  const startY = 50
  const contentWidth = 600
  const contentHeight = Math.max(300, displayNodes.length * (nodeHeight + nodeSpacing) + 100)
  
  const viewBoxWidth = contentWidth
  const viewBoxHeight = contentHeight

  const boxes = displayNodes
    .map((label, idx) => {
      const y = startY + idx * (nodeHeight + nodeSpacing)
      const arrow = idx < displayNodes.length - 1
        ? `<line x1="${viewBoxWidth / 2}" y1="${y + nodeHeight}" x2="${viewBoxWidth / 2}" y2="${y + nodeHeight + nodeSpacing}" stroke="#6366f1" stroke-width="2" marker-end="url(#arrow)" />`
        : ''
      const rectWidth = viewBoxWidth - 100
      const rectX = 50
      return `
        <rect x="${rectX}" y="${y}" width="${rectWidth}" height="${nodeHeight}" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5" />
        <text x="${viewBoxWidth / 2}" y="${y + nodeHeight / 2 + 5}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#1e1b4b" dominant-baseline="middle">${escapeXml(label.slice(0, 80))}</text>
        ${arrow}
      `
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; max-width: 100%;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white" rx="12" />
  <text x="24" y="28" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#64748b">${escapeXml(diagramType.toUpperCase())} DIAGRAM (Fallback)</text>
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

interface PanZoomState {
  scale: number
  translateX: number
  translateY: number
  isPanning: boolean
  panStartX: number
  panStartY: number
  panStartTranslateX: number
  panStartTranslateY: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 5
const SCALE_STEP = 0.2

function PanZoomContainer({
  children,
  className,
  onFitToView,
  viewBox,
  width,
  height,
}: {
  children: React.ReactNode
  className?: string
  onFitToView?: () => void
  viewBox?: { x: number; y: number; width: number; height: number }
  width: number | string
  height: number | string
}) {
  const [state, setState] = React.useState<PanZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartTranslateX: 0,
    panStartTranslateY: 0,
  })
  
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  
  const applyTransform = React.useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
      contentRef.current.style.transformOrigin = '0 0'
    }
  }, [state.translateX, state.translateY, state.scale])
  
  React.useEffect(() => {
    applyTransform()
  }, [applyTransform])
  
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + wheel
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const oldScale = state.scale
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale - e.deltaY * 0.001))
      
      // Adjust translation to zoom towards mouse position
      const scaleRatio = newScale / oldScale
      const newTranslateX = mouseX - (mouseX - state.translateX) * scaleRatio
      const newTranslateY = mouseY - (mouseY - state.translateY) * scaleRatio
      
      setState(prev => ({
        ...prev,
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
      }))
    } else {
      // Pan with wheel (shift + wheel for horizontal)
      const deltaX = e.shiftKey ? e.deltaY : e.deltaX
      const deltaY = e.shiftKey ? 0 : e.deltaY
      
      setState(prev => ({
        ...prev,
        translateX: prev.translateX - deltaX,
        translateY: prev.translateY - deltaY,
      }))
    }
  }, [state.scale, state.translateX, state.translateY])
  
  const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    
    setState(prev => ({
      ...prev,
      isPanning: true,
      panStartX: e.clientX,
      panStartY: e.clientY,
      panStartTranslateX: prev.translateX,
      panStartTranslateY: prev.translateY,
    }))
  }, [])
  
  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.isPanning) return
    
    setState(prev => ({
      ...prev,
      translateX: prev.panStartTranslateX + (e.clientX - prev.panStartX),
      translateY: prev.panStartTranslateY + (e.clientY - prev.panStartY),
    }))
  }, [state.isPanning])
  
  const handleMouseUp = React.useCallback(() => {
    setState(prev => ({ ...prev, isPanning: false }))
  }, [])
  
  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    
    const panAmount = 50 / state.scale
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        setState(prev => ({ ...prev, translateX: prev.translateX + panAmount }))
        break
      case 'ArrowRight':
        e.preventDefault()
        setState(prev => ({ ...prev, translateX: prev.translateX - panAmount }))
        break
      case 'ArrowUp':
        e.preventDefault()
        setState(prev => ({ ...prev, translateY: prev.translateY + panAmount }))
        break
      case 'ArrowDown':
        e.preventDefault()
        setState(prev => ({ ...prev, translateY: prev.translateY - panAmount }))
        break
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          setState(prev => ({ ...prev, scale: 1, translateX: 0, translateY: 0 }))
        }
        break
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          onFitToView?.()
        }
        break
    }
  }, [state.scale, onFitToView])
  
  const zoomIn = React.useCallback(() => {
    setState(prev => ({ ...prev, scale: Math.min(MAX_SCALE, prev.scale + SCALE_STEP) }))
  }, [])
  
  const zoomOut = React.useCallback(() => {
    setState(prev => ({ ...prev, scale: Math.max(MIN_SCALE, prev.scale - SCALE_STEP) }))
  }, [])
  
  const resetZoom = React.useCallback(() => {
    setState(prev => ({ ...prev, scale: 1, translateX: 0, translateY: 0 }))
  }, [])
  
  const fitToView = React.useCallback(() => {
    if (!contentRef.current || !containerRef.current || !viewBox) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()
    
    if (contentRect.width === 0 || contentRect.height === 0) return
    
    const padding = 40
    const scaleX = (containerRect.width - padding) / contentRect.width
    const scaleY = (containerRect.height - padding) / contentRect.height
    const newScale = Math.min(scaleX, scaleY, 1)
    
    const newTranslateX = (containerRect.width - contentRect.width * newScale) / 2
    const newTranslateY = (containerRect.height - contentRect.height * newScale) / 2
    
    setState(prev => ({
      ...prev,
      scale: Math.max(MIN_SCALE, newScale),
      translateX: newTranslateX,
      translateY: newTranslateY,
    }))
  }, [viewBox])
  
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleMouseMoveNative = (e: MouseEvent) => {
      if (!state.isPanning) return
      
      setState(prev => ({
        ...prev,
        translateX: prev.panStartTranslateX + (e.clientX - prev.panStartX),
        translateY: prev.panStartTranslateY + (e.clientY - prev.panStartY),
      }))
    }
    
    const handleMouseUpNative = () => {
      setState(prev => ({ ...prev, isPanning: false }))
    }
    
    const handleKeyDownNative = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      const panAmount = 50 / state.scale
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setState(prev => ({ ...prev, translateX: prev.translateX + panAmount }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setState(prev => ({ ...prev, translateX: prev.translateX - panAmount }))
          break
        case 'ArrowUp':
          e.preventDefault()
          setState(prev => ({ ...prev, translateY: prev.translateY + panAmount }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setState(prev => ({ ...prev, translateY: prev.translateY - panAmount }))
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setState(prev => ({ ...prev, scale: 1, translateX: 0, translateY: 0 }))
          }
          break
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            onFitToView?.()
          }
          break
      }
    }
    
    container.addEventListener('mousemove', handleMouseMoveNative)
    container.addEventListener('mouseup', handleMouseUpNative)
    container.addEventListener('mouseleave', handleMouseUpNative)
    window.addEventListener('keydown', handleKeyDownNative)
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMoveNative)
      container.removeEventListener('mouseup', handleMouseUpNative)
      container.removeEventListener('mouseleave', handleMouseUpNative)
      window.removeEventListener('keydown', handleKeyDownNative)
    }
  }, [state.isPanning, state.scale, onFitToView])
  
  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden touch-none", className)}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{ width, height }}
      tabIndex={0}
    >
      <div
        ref={contentRef}
        style={{
          width: viewBox?.width || 'auto',
          height: viewBox?.height || 'auto',
          minWidth: viewBox?.width || 'auto',
          minHeight: viewBox?.height || 'auto',
        }}
      >
        {children}
      </div>
      
      {/* Zoom controls overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 z-10" role="toolbar" aria-label="Zoom controls">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg shadow-md" 
                onClick={zoomIn}
                aria-label="Zoom in (Ctrl+Mousewheel)"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom in</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg shadow-md" 
                onClick={zoomOut}
                aria-label="Zoom out (Ctrl+Mousewheel)"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom out</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg shadow-md" 
                onClick={resetZoom}
                aria-label="Reset zoom (0)"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Reset zoom</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-lg shadow-md" 
                onClick={fitToView}
                aria-label="Fit to view (Ctrl+F)"
              >
                <Move className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Fit to view</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-4 opacity-0 transition-opacity group-hover:opacity-100 z-10">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground shadow-md border">
          {Math.round(state.scale * 100)}%
        </div>
      </div>
    </div>
  )
}

export const DiagramViewer = React.forwardRef<HTMLDivElement, DiagramViewerProps>(({
  definition, 
  title, 
  className, 
  onDownloadPdf,
  editable = false,
  height = 500
}, ref) => {
  const [activeTab, setActiveTab] = React.useState<string>('diagram')
  const [copied, setCopied] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [svgContent, setSvgContent] = React.useState<string | null>(null)
  const [viewBox, setViewBox] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(definition.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleDownloadSvg = async () => {
    if (activeTab !== 'diagram') return
    const svgElement = document.querySelector('.diagram-viewer svg')
    if (!svgElement) return
    
    try {
      const diagramData: DiagramExportData = {
        svg: document.querySelector('.diagram-viewer svg')?.outerHTML || '',
        title: title || definition.title || 'diagram',
        type: definition.type,
      }
      await exportDiagramAsSvg(diagramData, containerRef)
    } catch (error) {
      console.error('Failed to download SVG:', error)
    }
  }
  
  const handleDownloadPng = async () => {
    if (activeTab !== 'diagram') return
    try {
      const diagramData: DiagramExportData = {
        svg: document.querySelector('.diagram-viewer svg')?.outerHTML || '',
        title: title || definition.title || 'diagram',
        type: definition.type,
      }
      await exportDiagramAsPng(diagramData, containerRef)
    } catch (error) {
      console.error('Failed to download PNG:', error)
    }
  }
  
  const handleDownloadPdf = async () => {
    if (onDownloadPdf) {
      onDownloadPdf()
    } else {
      window.print()
    }
  }
  
  const handleSvgLoad = React.useCallback((svg: string) => {
    setSvgContent(svg)
    
    // Extract viewBox from SVG
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/i)
    if (viewBoxMatch) {
      const [, viewBoxStr] = viewBoxMatch
      const parts = viewBoxStr.split(/\s+/).map(Number)
      if (parts.length === 4) {
        setViewBox({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] })
      }
    }
  }, [])
  
  const computedHeight = typeof height === 'number' ? `${height}px` : height
  
  return (
    <div 
      ref={ref}
      className={cn("relative rounded-xl border bg-card flex flex-col", className)}
      style={{ height: computedHeight }}
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
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg" 
                  onClick={handleDownloadPng} 
                  aria-label="Download PNG"
                >
                  <Image className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">Download PNG</TooltipContent>
            </Tooltip>
            
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
        
        <TabsContent value="diagram" className="flex-1 p-0 relative">
          <div className="diagram-viewer h-full w-full p-2" ref={containerRef}>
            <PanZoomContainer
              viewBox={viewBox || undefined}
              width={100}
              height={100}
              onFitToView={() => {}}
              className="h-full w-full"
            >
              <DiagramRenderer definition={definition} onSvgLoad={handleSvgLoad} />
            </PanZoomContainer>
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
          onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false) }}
        >
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
            <h3 className="font-semibold">{title || definition.title || 'Diagram'}</h3>
            <Button variant="ghost" size="icon" onClick={() => setFullscreen(false)}>
              <Minimize2 className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4" onClick={e => e.stopPropagation()}>
            <PanZoomContainer
              viewBox={viewBox || undefined}
              width={100}
              height={100}
              className="h-full w-full min-h-[600px]"
            >
              <DiagramRenderer definition={definition} className="w-full h-full" />
            </PanZoomContainer>
          </div>
        </div>
      )}
    </div>
  )
})