"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Download, Copy, Check, Loader2, RotateCcw, Maximize2, AlertTriangle, ZoomIn, ZoomOut, Home, Expand } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface DiagramViewerProps {
  definition: {
    type: "mermaid" | "graphviz" | "plantuml" | "svg" | "description"
    code: string
    title: string
    description?: string
  }
  className?: string
  editable?: boolean
  onSave?: (code: string) => void
  autoRender?: boolean
}

export function DiagramViewer({
  definition,
  className,
  editable = false,
  onSave,
  autoRender = true,
}: DiagramViewerProps) {
  const { toast } = useToast()
  const [rendered, setRendered] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editCode, setEditCode] = React.useState(definition.code)
  const [svgContent, setSvgContent] = React.useState<string | null>(null)
  const [isRendering, setIsRendering] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const diagramIdRef = React.useRef(`diagram-${Math.random().toString(36).substr(2, 9)}`)

  // Reset transform when diagram changes
  React.useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [definition.code, definition.type])

  React.useEffect(() => {
    let isMounted = true
    
    const doRender = async () => {
      if (!autoRender) return
      
      if (definition.type === "mermaid" || definition.type === "graphviz" || definition.type === "plantuml" || definition.type === "svg") {
        if (definition.type === "mermaid") {
          if (!containerRef.current || !isMounted) return
          
          try {
            setIsRendering(true)
            setError(null)
            
            const mermaid = await import("mermaid")
            mermaid.default.initialize({
              startOnLoad: false,
              theme: "default",
              securityLevel: "loose",
              fontFamily: "inherit",
              flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: "basis",
              },
            })

            const { svg } = await mermaid.default.render(
              diagramIdRef.current,
              definition.code
            )
            
            if (isMounted) {
              setSvgContent(svg)
              setRendered(true)
              // Reset view to fit content after render
              setTimeout(() => fitToContainer(), 100)
            }
          } catch (err) {
            if (isMounted) {
              setError(err instanceof Error ? err.message : "Failed to render diagram")
              setRendered(true)
            }
          } finally {
            if (isMounted) {
              setIsRendering(false)
            }
          }
        } else if (definition.type === "svg") {
          if (isMounted) {
            setSvgContent(definition.code)
            setRendered(true)
            setTimeout(() => fitToContainer(), 100)
          }
        } else if (definition.type === "graphviz" || definition.type === "plantuml") {
          try {
            setIsRendering(true)
            setError(null)
            
            const response = await fetch("/api/diagrams/render", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: definition.type,
                code: definition.code,
                title: definition.title,
              }),
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || "Server-side rendering failed")
            }
            
            const data = await response.json()
            if (isMounted) {
              setSvgContent(data.svg)
              setRendered(true)
              setTimeout(() => fitToContainer(), 100)
            }
          } catch (err) {
            if (isMounted) {
              setError(err instanceof Error ? err.message : "Failed to render diagram")
              setRendered(true)
            }
          } finally {
            if (isMounted) {
              setIsRendering(false)
            }
          }
        }
      } else if (definition.type === "description") {
        if (isMounted) {
          setRendered(true)
        }
      }
    }
    
    doRender()
    
    return () => {
      isMounted = false
    }
  }, [definition.type, definition.code, autoRender, retryCount])

  const fitToContainer = () => {
    if (!containerRef.current || !svgRef.current) return
    
    const container = containerRef.current
    const svg = svgRef.current
    
    const containerRect = container.getBoundingClientRect()
    const svgRect = svg.getBoundingClientRect()
    
    // Get SVG viewBox or compute from content
    const viewBox = svg.viewBox.baseVal
    let svgWidth = viewBox.width || svgRect.width
    let svgHeight = viewBox.height || svgRect.height
    
    if (svgWidth === 0 || svgHeight === 0) {
      // Try to get from width/height attributes
      const width = svg.getAttribute('width')
      const height = svg.getAttribute('height')
      if (width && height) {
        svgWidth = parseFloat(width)
        svgHeight = parseFloat(height)
      }
    }
    
    if (svgWidth === 0 || svgHeight === 0) return
    
    const padding = 40
    const scaleX = (containerRect.width - padding * 2) / svgWidth
    const scaleY = (containerRect.height - padding * 2) / svgHeight
    const scale = Math.min(scaleX, scaleY, 1)
    
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    const svgCenterX = svgWidth / 2
    const svgCenterY = svgHeight / 2
    
    setTransform({
      x: centerX - svgCenterX * scale,
      y: centerY - svgCenterY * scale,
      scale
    })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.1), 5)
    
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale)
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale)
    
    setTransform({ x: newX, y: newY, scale: newScale })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Don't start drag if clicking on SVG elements (links, etc.)
    if (e.target !== containerRef.current && !(e.target as HTMLElement).closest('svg')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }))
  }

  const handleZoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }))
  }

  const handleResetView = () => {
    fitToContainer()
  }

  const handleDownload = () => {
    if (svgContent) {
      const blob = new Blob([svgContent], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${definition.title.replace(/\s+/g, "-")}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(definition.code)
    toast({ title: "Code copied to clipboard" })
  }

  const handleSave = () => {
    if (onSave) {
      onSave(editCode)
    }
    setIsEditing(false)
  }

  const toggleEdit = () => {
    setIsEditing(!isEditing)
    if (!isEditing) {
      setEditCode(definition.code)
    }
  }

  const handleRetry = () => {
    setRendered(false)
    setError(null)
    setRetryCount(prev => prev + 1)
  }

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  const handleExpand = () => {
    // Open in a new window/tab with just the diagram
    if (svgContent) {
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${definition.title}</title>
            <style>
              body { margin: 0; padding: 20px; background: #f8fafc; display: flex; justify-content: center; min-height: 100vh; }
              svg { max-width: 100%; height: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); background: white; }
              @media (prefers-color-scheme: dark) {
                body { background: #0f172a; }
                svg { background: #1e293b; }
              }
            </style>
          </head>
          <body>
            ${svgContent}
          </body>
          </html>
        `)
        newWindow.document.close()
      }
    }
  }

  return (
    <TooltipProvider>
      <div className={cn("border rounded-xl overflow-hidden bg-card flex flex-col", className)}>
        <div className="flex items-center justify-between p-3 border-b bg-muted/50 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium truncate">{definition.title}</span>
            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{definition.type}</Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {editable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleEdit}
                    aria-label={isEditing ? "Done editing" : "Edit diagram"}
                  >
                    {isEditing ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{isEditing ? "Done" : "Edit"}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy code</TooltipContent>
            </Tooltip>
            {svgContent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    aria-label="Download SVG"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Download SVG</TooltipContent>
              </Tooltip>
            )}
            {(definition.type === "mermaid" || definition.type === "graphviz" || definition.type === "plantuml" || definition.type === "svg") && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleRetry}
                      disabled={isRendering || !error}
                      aria-label="Retry render"
                    >
                      <RotateCcw className={cn("h-4 w-4", isRendering && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Retry render</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleResetView}
                      aria-label="Reset view"
                    >
                      <Home className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Reset view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleExpand}
                      aria-label="Expand diagram"
                    >
                      <Expand className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Open in new tab</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleFullscreen}
                      aria-label="Fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Fullscreen</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="p-4 border-b bg-muted/50 flex-shrink-0">
            <Textarea
              value={editCode}
              onChange={e => setEditCode(e.target.value)}
              className="font-mono text-sm min-h-[300px] resize-y"
              placeholder="Enter diagram code..."
              spellCheck={false}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className={cn(
            "flex-1 relative overflow-hidden",
            "touch-pan-x touch-pan-y"
          )}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
          style={{ touchAction: 'none' }}
        >
          {!rendered && isRendering && (
            <div className="flex items-center justify-center h-full w-full text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Rendering diagram...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full w-full text-center p-4 text-red-500">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-medium">Failed to render diagram</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handleRetry}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                {editable && (
                  <Button variant="ghost" onClick={() => setIsEditing(true)}>
                    Edit Code
                  </Button>
                )}
              </div>
            </div>
          )}

          {definition.type === "description" && rendered && (
            <div className="prose max-w-none h-full w-full overflow-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded">{definition.code}</pre>
            </div>
          )}

          {svgContent && rendered && (
            <div
              ref={svgRef}
              className="absolute top-0 left-0"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                transition: 'transform 0.1s ease-out',
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}

          {/* Zoom indicator */}
          {svgContent && rendered && (
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg p-2 shadow-lg">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono text-muted-foreground w-16 text-center">
                {Math.round(transform.scale * 100)}%
              </span>
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Zoom controls - fixed position */}
        {svgContent && rendered && (
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 pointer-events-auto" 
                  onClick={handleZoomIn} 
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom in</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 pointer-events-auto" 
                  onClick={handleZoomOut} 
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom out</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 pointer-events-auto" 
                  onClick={handleResetView} 
                  aria-label="Reset view"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Reset view</TooltipContent>
            </Tooltip>
          </div>
        )}

        {definition.description && (
          <div className="p-3 border-t bg-muted/50 text-sm text-muted-foreground flex-shrink-0">
            {definition.description}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}