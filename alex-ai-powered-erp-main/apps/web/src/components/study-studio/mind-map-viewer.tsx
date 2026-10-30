"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MindMapViewerProps {
  mindMap: {
    id: string
    title: string
    nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
    edges: Array<{ id: string; source: string; target: string }>
    viewport?: { x: number; y: number; zoom: number }
  }
  onClose: () => void
}

export function MindMapViewer({ mindMap, onClose }: MindMapViewerProps) {
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 })
  const [svgRef, setSvgRef] = React.useState<SVGSVGElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [showViewport, setShowViewport] = React.useState(false)

  // Initialize transform from viewport or center the mind map
  React.useEffect(() => {
    if (mindMap.viewport) {
      setTransform({ x: mindMap.viewport.x, y: mindMap.viewport.y, scale: mindMap.viewport.zoom || 1 })
    } else {
      // Center the mind map
      centerMindMap()
    }
  }, [])

  const centerMindMap = () => {
    if (!containerRef.current || !mindMap.nodes.length) return
    
    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    // Calculate bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    mindMap.nodes.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + 180) // approximate node width
      maxY = Math.max(maxY, node.position.y + 60) // approximate node height
    })
    
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const padding = 80
    
    const scaleX = (containerWidth - padding * 2) / contentWidth
    const scaleY = (containerHeight - padding * 2) / contentHeight
    const scale = Math.min(scaleX, scaleY, 1)
    
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    setTransform({
      x: containerWidth / 2 - centerX * scale,
      y: containerHeight / 2 - centerY * scale,
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
    if (e.button !== 0 || e.target !== containerRef.current) return
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
    centerMindMap()
  }

  const handleDownload = () => {
    if (!svgRef) return
    const svg = svgRef.cloneNode(true) as SVGSVGElement
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mindMap.title.replace(/\s+/g, '-')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }

  // Build edges as SVG paths
  const edges = mindMap.edges.map(edge => {
    const sourceNode = mindMap.nodes.find(n => n.id === edge.source)
    const targetNode = mindMap.nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) return null
    
    const x1 = sourceNode.position.x + 90 // center of node
    const y1 = sourceNode.position.y + 30 // center of node
    const x2 = targetNode.position.x + 90
    const y2 = targetNode.position.y + 30
    
    // Curved line
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    const offset = Math.min(dist * 0.3, 60)
    const ctrlX = cx - dy * (offset / dist)
    const ctrlY = cy + dx * (offset / dist)
    
    return (
      <path
        key={edge.id}
        d={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
        stroke="#6366f1"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
        style={{ opacity: 0.7 }}
      />
    )
  }).filter(Boolean)

  // Build nodes
  const nodes = mindMap.nodes.map(node => (
    <g
      key={node.id}
      transform={`translate(${node.position.x}, ${node.position.y})`}
      style={{ cursor: 'default' }}
    >
      <rect
        x="0"
        y="0"
        width="180"
        height="60"
        rx="12"
        fill="white"
        stroke="#6366f1"
        strokeWidth="2"
        filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
      />
      <text
        x="90"
        y="34"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="13"
        fontWeight="500"
        fill="#1e1b4b"
        style={{ pointerEvents: 'none' }}
      >
        {node.label.length > 22 ? node.label.slice(0, 22) + '...' : node.label}
      </text>
      <title>{node.label}</title>
    </g>
  ))

  return (
    <TooltipProvider>
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-muted/50 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-medium truncate">{mindMap.title}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {mindMap.nodes.length} nodes · {mindMap.edges.length} connections
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} aria-label="Download SVG">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Download SVG</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetView} aria-label="Reset view">
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Reset view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFullscreen} aria-label="Fullscreen">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Fullscreen</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Close</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 relative overflow-hidden">
          <div
            ref={containerRef}
            className="w-full h-full"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={e => e.preventDefault()}
          >
            <svg
              ref={setSvgRef}
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                transition: 'transform 0.1s ease-out',
                minWidth: '100%',
                minHeight: '100%',
              }}
              width="100%"
              height="100%"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
              </defs>
              <g>{edges}</g>
              <g>{nodes}</g>
            </svg>
            
            {/* Mini-map / viewport indicator */}
            {showViewport && (
              <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border rounded-lg p-2 shadow-lg">
                <div className="text-xs text-muted-foreground mb-1">Zoom: {Math.round(transform.scale * 100)}%</div>
                <div className="text-xs text-muted-foreground">Pan: {Math.round(transform.x)}, {Math.round(transform.y)}</div>
              </div>
            )}
          </div>
          
          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom in</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Zoom out</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleResetView} aria-label="Reset view">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Reset view</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}