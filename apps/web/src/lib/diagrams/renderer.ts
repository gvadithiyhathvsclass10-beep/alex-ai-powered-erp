import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

export interface DiagramRenderResult {
  success: boolean
  svg?: string
  error?: string
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;')
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

  // Use viewBox for responsive scaling - no fixed width
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

  // Return responsive SVG with viewBox - no fixed width/height
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

export class DiagramRenderer {
  private static tempDir: string

  static getTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = mkdtempSync(join(tmpdir(), 'alex-diagrams-'))
    }
    return this.tempDir
  }

  static async renderMermaid(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    const cliPath = join(process.cwd(), 'node_modules', '.bin', 'mmdc')
    if (existsSync(cliPath)) {
      const tempDir = this.getTempDir()
      const inputFile = join(tempDir, `mermaid-${Date.now()}.mmd`)
      const outputFile = join(tempDir, `mermaid-${Date.now()}.svg`)
      try {
        writeFileSync(inputFile, code)
        execSync(`"${cliPath}" -i "${inputFile}" -o "${outputFile}" -b transparent`, {
          stdio: 'pipe',
          timeout: 15000,
        })
        const svg = readFileSync(outputFile, 'utf-8')
        unlinkSync(inputFile)
        unlinkSync(outputFile)
        return { success: true, svg }
      } catch {
        // Fall through to pure SVG renderer
      }
    }

    return {
      success: true,
      svg: buildFallbackSvg('mermaid', code),
    }
  }

  static async renderGraphviz(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    try {
      // Try @viz-js/viz
      const vizModule = await import('@viz-js/viz')
      const instance = await vizModule.instance()
      const svg = instance.renderString(code, { format: 'svg', engine: 'dot' })
      if (svg && svg.includes('<svg')) {
        return { success: true, svg }
      }
      throw new Error('Graphviz rendering failed')
    } catch {
      // Use fallback
      return {
        success: true,
        svg: buildFallbackSvg('graphviz', code),
      }
    }
  }

  static async renderPlantUML(code: string): Promise<DiagramRenderResult> {
    if (!code || !code.trim()) {
      return { success: false, error: 'Diagram code is empty' }
    }
    // PlantUML requires server-side rendering, use fallback
    return {
      success: true,
      svg: buildFallbackSvg('plantuml', code),
    }
  }

  static async render(diagramType: string, code: string): Promise<DiagramRenderResult> {
    switch (diagramType) {
      case 'mermaid':
        return this.renderMermaid(code)
      case 'graphviz':
        return this.renderGraphviz(code)
      case 'plantuml':
        return this.renderPlantUML(code)
      default:
        return { success: false, error: `Unsupported diagram type: ${diagramType}` }
    }
  }

  static cleanup() {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true })
      } catch {}
      this.tempDir = ''
    }
  }
}

export async function renderDiagramFromCode(
  type: 'mermaid' | 'graphviz' | 'plantuml',
  code: string
): Promise<{ svg: string; width: number; height: number }> {
  const result = await DiagramRenderer.render(type, code)

  if (!result.success || !result.svg) {
    throw new Error(result.error || 'Failed to render diagram')
  }

  const widthMatch = result.svg.match(/width="(\d+(?:\.\d+)?)/)
  const heightMatch = result.svg.match(/height="(\d+(?:\.\d+)?)/)

  return {
    svg: result.svg,
    width: widthMatch ? parseFloat(widthMatch[1]) : 640,
    height: heightMatch ? parseFloat(heightMatch[1]) : 400,
  }
}