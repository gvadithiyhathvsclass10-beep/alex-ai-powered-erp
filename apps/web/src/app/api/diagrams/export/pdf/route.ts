import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

interface DiagramData {
  title: string
  type: 'mermaid' | 'graphviz' | 'plantuml'
  code: string
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { diagram } = body as { diagram: DiagramData }

    if (!diagram) {
      return NextResponse.json({ error: 'Diagram data required' }, { status: 400 })
    }

    const pdfBuffer = await generateDiagramPDF(diagram)
    
    const uint8Array = new Uint8Array(pdfBuffer)
    
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${diagram.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Diagram PDF export error:', error)
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 })
  }
}

async function generateDiagramPDF(diagram: DiagramData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: diagram.title,
        Author: 'ALEX Study Studio',
        Creator: 'ALEX Diagram Generator',
      },
    })

    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)

    // Title
    pdfDoc.fontSize(24).font('Helvetica-Bold').text(diagram.title, { align: 'center' })
    pdfDoc.moveDown(1)
    pdfDoc.fontSize(12).font('Helvetica').fillColor('gray')
    pdfDoc.text(`Type: ${diagram.type.toUpperCase()} | Generated: ${new Date().toLocaleString()}`, { align: 'center' })
    pdfDoc.fillColor('black')
    pdfDoc.moveDown(2)

    // Diagram type
    pdfDoc.fontSize(14).font('Helvetica-Bold').text(`Diagram Type: ${diagram.type.toUpperCase()}`)
    pdfDoc.moveDown(0.5)

    // Diagram code
    pdfDoc.fontSize(10).font('Courier').fillColor('#333')
    
    // Wrap long lines
    const lines = diagram.code.split('\n')
    lines.forEach(line => {
      if (pdfDoc.y > pdfDoc.page.height - 80) {
        pdfDoc.addPage()
      }
      // Wrap long lines
      const maxWidth = 500
      if (pdfDoc.widthOfString(line) > maxWidth) {
        // Simple word wrap
        const words = line.split(' ')
        let currentLine = ''
        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word
          if (pdfDoc.widthOfString(testLine) > maxWidth) {
            pdfDoc.text(currentLine, { indent: 20 })
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        if (currentLine) {
          pdfDoc.text(currentLine, { indent: 20 })
        }
      } else {
        pdfDoc.text(line, { indent: 20 })
      }
    })

    pdfDoc.fillColor('black')
    pdfDoc.moveDown(2)

    // Metadata footer on last page
    pdfDoc.fontSize(8).font('Helvetica').fillColor('gray')
    pdfDoc.text(
      `Type: ${diagram.type.toUpperCase()} | Generated: ${new Date().toLocaleString()}`,
      50,
      pdfDoc.page.height - 40,
      { align: 'center', width: pdfDoc.page.width - 100 }
    )
    pdfDoc.fillColor('black')

    pdfDoc.end()
  })
}