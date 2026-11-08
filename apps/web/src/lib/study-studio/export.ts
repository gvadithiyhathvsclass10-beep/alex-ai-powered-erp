import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export interface ExportOptions {
  filename?: string
  format: 'png' | 'svg' | 'pdf'
  scale?: number
  quality?: number
  backgroundColor?: string
}

export interface MindMapExportData {
  nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
  title: string
}

export interface DiagramExportData {
  svg: string
  title: string
  type: 'mermaid' | 'graphviz' | 'plantuml'
}

export interface NoteExportData {
  content: string
  title: string
  type: string
}

/**
 * Export Mind Map as PNG
 */
export async function exportMindMapAsPng(
  mindMapData: MindMapExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (!containerRef.current) {
    throw new Error('Container reference not available')
  }

  const canvas = await html2canvas(containerRef.current, {
    scale: options.scale || 2,
    backgroundColor: options.backgroundColor || '#ffffff',
    useCORS: true,
    logging: false,
    width: containerRef.current.scrollWidth,
    height: containerRef.current.scrollHeight,
  })

  const filename = `${options.filename || mindMapData.title || 'mindmap'}.png`
  saveAs(canvas.toDataURL('image/png'), filename)
}

/**
 * Export Mind Map as SVG
 */
export function exportMindMapAsSvg(
  mindMapData: MindMapExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): void {
  const svgElement = containerRef.current?.querySelector('svg')
  if (!svgElement) {
    throw new Error('SVG element not found in container')
  }

  const svgData = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([svgData], { type: 'image/svg+xml' })
  const filename = `${options.filename || mindMapData.title || 'mindmap'}.svg`
  saveAs(blob, filename)
}

/**
 * Export Mind Map as PDF
 */
export async function exportMindMapAsPdf(
  mindMapData: MindMapExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (!containerRef.current) {
    throw new Error('Container reference not available')
  }

  const canvas = await html2canvas(containerRef.current, {
    scale: options.scale || 2,
    backgroundColor: options.backgroundColor || '#ffffff',
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [containerRef.current.scrollWidth, containerRef.current.scrollHeight],
  })

  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', 0, 0, containerRef.current.scrollWidth, containerRef.current.scrollHeight)

  const filename = `${options.filename || mindMapData.title || 'mindmap'}.pdf`
  pdf.save(filename)
}

/**
 * Export Diagram as PNG
 */
export async function exportDiagramAsPng(
  diagramData: DiagramExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (!containerRef.current) {
    throw new Error('Container reference not available')
  }

  const canvas = await html2canvas(containerRef.current, {
    scale: options.scale || 2,
    backgroundColor: options.backgroundColor || '#ffffff',
    useCORS: true,
    logging: false,
  })

  const filename = `${options.filename || diagramData.title || 'diagram'}.png`
  saveAs(canvas.toDataURL('image/png'), filename)
}

/**
 * Export Diagram as SVG
 */
export function exportDiagramAsSvg(
  diagramData: DiagramExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): void {
  const svgElement = containerRef.current?.querySelector('svg')
  if (!svgElement) {
    // Try to parse the SVG string directly
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(diagramData.svg, 'image/svg+xml')
    const svgElement = svgDoc.documentElement
    
    if (!svgElement || svgElement.tagName !== 'svg') {
      throw new Error('Invalid SVG content')
    }
    
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const filename = `${options.filename || diagramData.title || 'diagram'}.svg`
    saveAs(blob, filename)
    return
  }

  const svgData = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([svgData], { type: 'image/svg+xml' })
  const filename = `${options.filename || diagramData.title || 'diagram'}.svg`
  saveAs(blob, filename)
}

/**
 * Export Diagram as PDF
 */
export async function exportDiagramAsPdf(
  diagramData: DiagramExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (!containerRef.current) {
    throw new Error('Container reference not available')
  }

  const canvas = await html2canvas(containerRef.current, {
    scale: options.scale || 2,
    backgroundColor: options.backgroundColor || '#ffffff',
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [containerRef.current.scrollWidth, containerRef.current.scrollHeight],
  })

  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', 0, 0, containerRef.current.scrollWidth, containerRef.current.scrollHeight)

  const filename = `${options.filename || diagramData.title || 'diagram'}.pdf`
  pdf.save(filename)
}

/**
 * Export Notes as PDF
 */
export async function exportNotesAsPdf(
  noteData: NoteExportData,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Add title
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(noteData.title, 20, 20)

  // Add metadata
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Type: ${noteData.type}`, 20, 28)
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 34)

  // Add content
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  // Split content into lines that fit the page
  const pageWidth = pdf.internal.pageSize.getWidth() - 40
  const lines = pdf.splitTextToSize(noteData.content, pageWidth)

  let y = 45
  const lineHeight = 6
  const marginTop = 45
  const marginBottom = 20
  const pageHeight = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > pageHeight - marginBottom) {
      pdf.addPage()
      y = marginTop
    }
    pdf.text(lines[i], 20, y)
    y += lineHeight
  }

  const filename = `${options.filename || noteData.title || 'notes'}.pdf`
  pdf.save(filename)
}

/**
 * Export Notes as DOCX (requires docx library)
 */
export async function exportNotesAsDocx(
  noteData: NoteExportData,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  // This would require the docx package
  // For now, export as markdown
  const markdown = `# ${noteData.title}\n\n**Type:** ${noteData.type}\n\n${noteData.content}`
  const blob = new Blob([markdown], { type: 'text/markdown' })
  saveAs(blob, `${options.filename || noteData.title || 'notes'}.md`)
}

/**
 * Universal export function for any generated content
 */
export async function exportContent(
  type: 'mindmap' | 'diagram' | 'notes',
  exportData: MindMapExportData | DiagramExportData | NoteExportData,
  containerRef: React.RefObject<HTMLDivElement>,
  format: 'png' | 'svg' | 'pdf' | 'docx',
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (type === 'mindmap') {
    const data = exportData as MindMapExportData
    switch (format) {
      case 'png':
        return exportMindMapAsPng(data, containerRef, options)
      case 'svg':
        return exportMindMapAsSvg(data, containerRef, options)
      case 'pdf':
        return exportMindMapAsPdf(data, containerRef, options)
      default:
        throw new Error(`Unsupported format for mindmap: ${format}`)
    }
  } else if (type === 'diagram') {
    const data = exportData as DiagramExportData
    switch (format) {
      case 'png':
        return exportDiagramAsPng(data, containerRef, options)
      case 'svg':
        return exportDiagramAsSvg(data, containerRef, options)
      case 'pdf':
        return exportDiagramAsPdf(data, containerRef, options)
      default:
        throw new Error(`Unsupported format for diagram: ${format}`)
    }
  } else if (type === 'notes') {
    const data = exportData as NoteExportData
    switch (format) {
      case 'pdf':
        return exportNotesAsPdf(data, options)
      case 'docx':
        return exportNotesAsDocx(data, options)
      default:
        throw new Error(`Unsupported format for notes: ${format}`)
    }
  }
  
  throw new Error(`Unknown export type: ${type}`)
}