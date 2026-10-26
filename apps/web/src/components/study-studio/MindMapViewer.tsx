"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  Expand, 
  Minimize,
  Settings,
  PanelLeft,
  PanelRight,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface MindMapNode {
  id: string
  label: string
  position: { x: number; y: number }
}

export interface MindMapEdge {
  id: string
  source: string
  target: string
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

interface MindMapViewerProps {
  data: MindMapData
  title?: string
  className?: string
  onDownloadPdf?: () => void
  editable?: boolean
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 50
const NODE_RADIUS = 8
const EDGE_COLOR = "hsl(var(--primary))"
const NODE_BG = "hsl(var(--card))"
const NODE_BORDER = "hsl(var(--primary))"
const NODE_TEXT = "hsl(var(--card-foreground))"
const CENTRAL_NODE_BG = "hsl(var(--primary))"
const CENTRAL_NODE_TEXT = "hsl(var(--primary-foreground))"

function getCentralNode(nodes: MindMapNode[], edges: MindMapEdge[]): MindMapNode | null {
  if (nodes.length === 0) return null
  
  // Find node with most connections (highest degree)
  const nodeDegrees = new Map<string, number>()
  edges.forEach(edge => {
    nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1)
    nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1)
  })
  
  let maxDegree = -1
  let centralNode = nodes[0]
  nodes.forEach(node => {
    const degree = nodeDegrees.get(node.id) || 0
    if (degree > maxDegree) {
      maxDegree = degree
      centralNode = node
    }
  })
  
  return centralNode
}

function buildTreeLayout(nodes: MindMapNode[], edges: MindMapEdge[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const adjacency = new Map<string, string[]>()
  const reverseAdjacency = new Map<string, string[]>()
  
  // Build adjacency lists
  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
    
    if (!reverseAdjacency.has(edge.target)) reverseAdjacency.set(edge.target, [])
    reverseAdjacency.get(edge.target)!.push(edge.source)
  })
  
  const centralNode = getCentralNode(nodes, edges)
  if (!centralNode) return positions
  
  // Use a force-directed layout for better visualization
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  
  // Initialize positions with some randomness around center
  const centerX = 400
  const centerY = 300
  
  // Simple radial layout for tree-like structures
  const visited = new Set<string>()
  const levelMap = new Map<string, number>()
  
  function assignLevels(nodeId: string, level: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    levelMap.set(nodeId, level)
    
    const children = adjacency.get(nodeId) || []
    children.forEach(child => assignLevels(child, level + 1))
  }
  
  assignLevels(centralNode.id, 0)
  
  // Group nodes by level
  const levels = new Map<number, string[]>()
  levelMap.forEach((level, nodeId) => {
    if (!levels.has(level)) levels.set(level, [])
    levels.get(level)!.push(nodeId)
  })
  
  // Position nodes
  const maxLevel = Math.max(...Array.from(levels.keys()))
  levels.forEach((levelNodes, level) => {
    const radius = 100 + level * 180
    const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1)
    
    levelNodes.forEach((nodeId, index) => {
      const angle = index * angleStep - Math.PI / 2
      const node = nodeMap.get(nodeId)
      if (node) {
        // Use existing position if it looks reasonable, otherwise compute new one
        const existingX = node.position.x
        const existingY = node.position.y
        const computedX = centerX + radius * Math.cos(angle)
        const computedY = centerY + radius * Math.sin(angle)
        
        // If existing position is close to computed, keep it; otherwise use computed
        const dist = Math.sqrt((existingX - computedX) ** 2 + (existingY - computedY) ** 2)
        if (dist < 100 && existingX !== 0 && existingY !== 0) {
          positions.set(nodeId, node.position)
        } else {
          positions.set(nodeId, { x: computedX, y: computedY })
        }
      }
    })
  })
  
  // Ensure central node is at center
  positions.set(centralNode.id, { x: centerX, y: centerY })
  
  return positions
}

function MindMapCanvas({ 
  data, 
  scale, 
  offset, 
  onNodeClick,
  selectedNodeId,
  showLabels = true
}: { 
  data: MindMapData
  scale: number
  offset: { x: number; y: number }
  onNodeClick?: (node: MindMapNode) => void
  selectedNodeId?: string
  showLabels?: boolean
}) {
  const { nodes, edges } = data
  const positions = buildTreeLayout(nodes, edges)
  const centralNode = getCentralNode(nodes, edges)
  
  // Calculate bounds for centering
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
  })
  
  const canvasWidth = Math.max(800, maxX - minX + 200)
  const canvasHeight = Math.max(600, maxY - minY + 200)
  
  return (
    <div 
      className="relative overflow-hidden bg-background"
      style={{ width: "100%", height: "100%", minHeight: "500px" }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${minX - 100} ${minY - 100} ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center center" }}
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
            <polygon points="0 0, 10 3.5, 0 7" fill={EDGE_COLOR} />
          </marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Edges */}
        <g className="mindmap-edges">
          {edges.map(edge => {
            const sourcePos = positions.get(edge.source)
            const targetPos = positions.get(edge.target)
            if (!sourcePos || !targetPos) return null
            
            // Calculate curved path
            const dx = targetPos.x - sourcePos.x
            const dy = targetPos.y - sourcePos.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            // Create curved bezier path
            const midX = (sourcePos.x + targetPos.x) / 2
            const midY = (sourcePos.y + targetPos.y) / 2
            const perpX = -dy / distance * Math.min(distance * 0.15, 60)
            const perpY = dx / distance * Math.min(distance * 0.15, 60)
            
            const controlX = midX + perpX
            const controlY = midY + perpY
            
            return (
              <path
                key={edge.id}
                d={`M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`}
                stroke={EDGE_COLOR}
                strokeWidth={2}
                fill="none"
                markerEnd="url(#arrowhead)"
                style={{ opacity: 0.7 }}
              />
            )
          })}
        </g>
        
        {/* Nodes */}
        <g className="mindmap-nodes">
          {nodes.map(node => {
            const pos = positions.get(node.id)
            if (!pos) return null
            
            const isCentral = centralNode && node.id === centralNode.id
            const isSelected = selectedNodeId === node.id
            
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onNodeClick?.(node)}
                style={{ cursor: onNodeClick ? "pointer" : "default" }}
              >
                {/* Node background */}
                <rect
                  x={-NODE_WIDTH / 2}
                  y={-NODE_HEIGHT / 2}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={NODE_RADIUS}
                  ry={NODE_RADIUS}
                  fill={isCentral ? CENTRAL_NODE_BG : NODE_BG}
                  stroke={isSelected ? "hsl(var(--ring))" : (isCentral ? CENTRAL_NODE_BORDER : NODE_BORDER)}
                  strokeWidth={isSelected ? 3 : (isCentral ? 2 : 1.5)}
                  filter={isCentral ? "url(#glow)" : undefined}
                  className="transition-all duration-200"
                />
                
                {/* Node label */}
                <text
                  x="0"
                  y={showLabels ? 5 : 0}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isCentral ? CENTRAL_NODE_TEXT : NODE_TEXT}
                  fontSize={isCentral ? 13 : 12}
                  fontWeight={isCentral ? 600 : 500}
                  fontFamily="system-ui, sans-serif"
                  className="select-none"
                >
                  {node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label}
                </text>
                
                {/* Selection indicator */}
                {isSelected && (
                  <circle
                    cx="0"
                    cy="0"
                    r={Math.max(NODE_WIDTH, NODE_HEIGHT) / 2 + 6}
                    fill="none"
                    stroke="hsl(var(--ring))"
                    strokeWidth={2}
                    strokeDasharray="6,4"
                  />
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export function MindMapViewer({ 
  data, 
  title, 
  className, 
  onDownloadPdf,
  editable = false
}: MindMapViewerProps) {
  const [scale, setScale] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = React.useState(false)
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = React.useState<MindMapNode | null>(null)
  const [showControls, setShowControls] = React.useState(true)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.3, Math.min(3, scale * zoomFactor))
    setScale(newScale)
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }
  
  const handleMouseUp = () => {
    setIsPanning(false)
  }
  
  const handleMouseLeave = () => {
    setIsPanning(false)
  }
  
  const zoomIn = () => setScale(s => Math.min(3, s * 1.2))
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.2))
  const resetView = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }
  
  const handleNodeClick = (node: MindMapNode) => {
    setSelectedNode(node)
  }
  
  const handleDownloadPdf = async () => {
    if (onDownloadPdf) {
      onDownloadPdf()
    } else {
      // Default: print to PDF
      window.print()
    }
  }
  
  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      switch (e.key) {
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            resetView()
          }
          break
        case "Escape":
          setSelectedNode(null)
          break
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
  
  return (
    <div 
      ref={containerRef}
      className={cn("relative rounded-xl border bg-card", className)}
      style={{ minHeight: "500px", height: "100%" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Mind Map Canvas */}
      <div className="absolute inset-0" style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        <MindMapCanvas 
          data={data} 
          scale={scale}
          offset={offset}
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedNode?.id}
        />
      </div>
      
      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm" onClick={zoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Zoom in (Ctrl++)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm" onClick={zoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Zoom out (Ctrl+-)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm" onClick={resetView} aria-label="Reset view">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Reset view (Ctrl+0)</TooltipContent>
            </Tooltip>
            
            {onDownloadPdf && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm" onClick={handleDownloadPdf} aria-label="Download PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Download PDF</TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm" onClick={() => setShowControls(false)} aria-label="Hide controls">
                  <Minimize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Hide controls</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Show controls button when hidden */}
      {!showControls && (
        <div className="absolute top-3 right-3 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="default" size="icon" className="h-8 w-8 rounded-lg shadow-lg" onClick={() => setShowControls(true)} aria-label="Show controls">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Show controls</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Selected node info panel */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-72 z-10">
          <div className="bg-card border rounded-lg p-3 shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">{selectedNode.label}</h4>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNode(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Node ID: {selectedNode.id}</p>
            <p className="text-xs text-muted-foreground">Position: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})</p>
          </div>
        </div>
      )}
      
      {/* Title */}
      {title && (
        <div className="absolute top-3 left-3 z-10">
          <h3 className="text-lg font-semibold text-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
            {title}
          </h3>
        </div>
      )}
    </div>
  )
}