import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

interface MindMapData {
  title: string
  nodes: Array<{ id: string; label: string; position: { x: number; y: number } }>
  edges: Array<{ id: string; source: string; target: string }>
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { mindMap } = body as { mindMap: MindMapData }

    if (!mindMap) {
      return NextResponse.json({ error: 'Mind map data required' }, { status: 400 })
    }

    const pdfBuffer = await generateMindMapPDF(mindMap)
    
    const uint8Array = new Uint8Array(pdfBuffer)
    
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${mindMap.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Mind map PDF export error:', error)
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 })
  }
}

async function generateMindMapPDF(mindMap: MindMapData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: mindMap.title,
        Author: 'ALEX Study Studio',
        Creator: 'ALEX Mind Map Generator',
      },
    })

    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)

    // Title
    pdfDoc.fontSize(24).font('Helvetica-Bold').text(mindMap.title, { align: 'center' })
    pdfDoc.moveDown(1)
    pdfDoc.fontSize(12).font('Helvetica').fillColor('gray')
    pdfDoc.text(`Generated: ${new Date().toLocaleString()} | Nodes: ${mindMap.nodes.length} | Connections: ${mindMap.edges.length}`, { align: 'center' })
    pdfDoc.fillColor('black')
    pdfDoc.moveDown(2)

    // Render nodes
    pdfDoc.fontSize(14).font('Helvetica-Bold').text('Concepts', { underline: true })
    pdfDoc.moveDown(0.5)
    
    mindMap.nodes.forEach((node, index) => {
      pdfDoc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${node.label}`)
      pdfDoc.fontSize(10).font('Helvetica').fillColor('gray')
      pdfDoc.text(`  ID: ${node.id} | Position: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`)
      pdfDoc.fillColor('black')
      pdfDoc.moveDown(0.3)
    })

    pdfDoc.moveDown(1)
    pdfDoc.addPage()
    
    // Render edges
    pdfDoc.fontSize(14).font('Helvetica-Bold').text('Connections', { underline: true })
    pdfDoc.moveDown(0.5)
    
    mindMap.edges.forEach((edge, index) => {
      const sourceNode = mindMap.nodes.find(n => n.id === edge.source)
      const targetNode = mindMap.nodes.find(n => n.id === edge.target)
      const sourceLabel = sourceNode ? sourceNode.label : edge.source
      const targetLabel = targetNode ? targetNode.label : edge.target
      
      pdfDoc.fontSize(11).font('Helvetica').text(`${index + 1}. ${sourceLabel} → ${targetLabel}`)
      pdfDoc.moveDown(0.2)
    })

    // Metadata footer on last page
    pdfDoc.fontSize(8).font('Helvetica').fillColor('gray')
    pdfDoc.text(
      `Nodes: ${mindMap.nodes.length} | Edges: ${mindMap.edges.length} | Generated: ${new Date().toLocaleString()}`,
      50,
      pdfDoc.page.height - 40,
      { align: 'center', width: pdfDoc.page.width - 100 }
    )
    pdfDoc.fillColor('black')

    pdfDoc.end()
  })
}