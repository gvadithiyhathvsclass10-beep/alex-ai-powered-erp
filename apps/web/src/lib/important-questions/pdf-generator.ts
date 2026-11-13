/**
 * PDF Generator for Important Questions Report
 * Uses pdfkit for server-side PDF generation
 */

import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

export interface ReportData {
  subject: { name: string; code: string } | null
  semester: string | null
  academicYear: string | null
  analysis: {
    title: string
    totalQuestions: number
    exactRepeats: number
    semanticRepeats: number
    paperIds: string[]
    priorityItems: PriorityItem[]
    analysisData: {
      unitDistribution?: Record<string, number>
      topicDistribution?: Record<string, number>
      marksDistribution?: Record<number, number>
      yearDistribution?: Record<number, number>
      questionTypeDistribution?: Record<string, number>
    }
    webResearch?: {
      syllabusTopics: string[]
      importantConcepts: string[]
      missingTopics: string[]
      sources: WebSource[]
    }
  }
  papers: Array<{
    id: string
    title: string
    paperType: 'QB' | 'PYQ'
    subjectId: string | null
    semester: string | null
    unit: string | null
    academicYear: string | null
    examinationYear: number | null
    marks: number | null
    questions: Array<{
      questionNumber: string
      text: string
      marks: number | null
      unit: string | null
      topic: string | null
      concept: string | null
      year: number | null
    }>
  }>
  generatedAt: Date
}

export interface PriorityItem {
  questionId: string
  questionText: string
  concept: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
  frequency: number
  papersCount: number
  totalMarks: number
  avgMarks: number
  firstYear: number | null
  lastYear: number | null
  units: string[]
  topics: string[]
  concepts: string[]
  questionTypes: string[]
  isExactRepeat: boolean
  matchedQuestionIds: string[]
  source: 'historical' | 'web_research' | 'fundamental'
}

export interface WebSource {
  title: string
  url: string
  type: 'syllabus' | 'textbook' | 'academic' | 'educational'
  relevance: number
}

/**
 * Generate PDF report as a buffer
 */
export async function generateImportantQuestionsPDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: `Important Questions Report - ${data.subject?.name || 'General'}`,
          Author: 'ALEX AI-Powered ERP',
          Subject: 'Examination Preparation Report',
          Keywords: 'important questions, exam preparation, academic analysis',
        },
      })
      
      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      
      // Generate the PDF content
      generatePDFContent(doc, data)
      
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function generatePDFContent(doc: PDFKit.PDFDocument, data: ReportData) {
  const { subject, semester, academicYear, analysis, papers, generatedAt } = data
  const subjectName = subject?.name || 'General'
  const subjectCode = subject?.code || ''
  
  // ============ COVER PAGE ============
  addCoverPage(doc, subjectName, subjectCode, semester, academicYear, papers.length, generatedAt)
  
  // ============ TABLE OF CONTENTS ============
  doc.addPage()
  addTableOfContents(doc)
  
  // ============ EXECUTIVE SUMMARY ============
  doc.addPage()
  addExecutiveSummary(doc, analysis, papers)
  
  // ============ HIGH PRIORITY QUESTIONS ============
  doc.addPage()
  addHighPriorityQuestions(doc, analysis.priorityItems)
  
  // ============ MEDIUM PRIORITY QUESTIONS ============
  if (analysis.priorityItems.some(p => p.priority === 'MEDIUM')) {
    doc.addPage()
    addMediumPriorityQuestions(doc, analysis.priorityItems)
  }
  
  // ============ UNIT-WISE IMPORTANT QUESTIONS ============
  if (analysis.analysisData?.unitDistribution && Object.keys(analysis.analysisData.unitDistribution).length > 0) {
    doc.addPage()
    addUnitWiseQuestions(doc, analysis)
  }
  
  // ============ REPEATED QUESTIONS ============
  if (analysis.exactRepeats > 0 || analysis.semanticRepeats > 0) {
    doc.addPage()
    addRepeatedQuestions(doc, analysis)
  }
  
  // ============ IMPORTANT CONCEPTS & DEFINITIONS ============
  doc.addPage()
  addImportantConcepts(doc, analysis)
  
  // ============ WEB RESEARCH FINDINGS ============
  if (analysis.webResearch && (analysis.webResearch.importantConcepts.length > 0 || analysis.webResearch.sources.length > 0)) {
    doc.addPage()
    addWebResearchFindings(doc, analysis.webResearch)
  }
  
  // ============ EXAMINATION PREPARATION RECOMMENDATIONS ============
  doc.addPage()
  addRecommendations(doc, analysis, papers)
  
  // ============ REFERENCES ============
  if (analysis.webResearch?.sources.length) {
    doc.addPage()
    addReferences(doc, analysis.webResearch.sources, papers)
  }
  
  // Add page numbers
  addPageNumbers(doc)
}

// ============ HELPER FUNCTIONS ============

function addCoverPage(
  doc: PDFKit.PDFDocument,
  subjectName: string,
  subjectCode: string,
  semester: string | null,
  academicYear: string | null,
  paperCount: number,
  generatedAt: Date
) {
  // Background accent
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8fafc')
  
  // Top accent bar
  doc.rect(0, 0, doc.page.width, 8).fill('#0ea5e9')
  
  // Title area
  doc.fontSize(14).fillColor('#64748b').text('ALEX AI-POWERED ERP', 50, 60, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor('#94a3b8').text('Academic Intelligence Platform', { align: 'center' })
  
  doc.moveDown(3)
  
  // Main title
  doc.fontSize(32).fillColor('#0f172a').font('Helvetica-Bold').text('Important Questions Report', { align: 'center' })
  doc.moveDown(0.5)
  
  // Subject
  doc.fontSize(24).fillColor('#0ea5e9').font('Helvetica-Bold').text(subjectName, { align: 'center' })
  if (subjectCode) {
    doc.fontSize(16).fillColor('#64748b').font('Helvetica').text(`Subject Code: ${subjectCode}`, { align: 'center' })
  }
  
  doc.moveDown(2)
  
  // Details
  const details = []
  if (semester) details.push(`Semester: ${semester}`)
  if (academicYear) details.push(`Academic Year: ${academicYear}`)
  details.push(`Papers Analyzed: ${paperCount}`)
  details.push(`Questions Processed: ${analysis.totalQuestions}`)
  details.push(`Report Generated: ${generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
  
  details.forEach(detail => {
    doc.fontSize(12).fillColor('#334155').font('Helvetica').text(detail, { align: 'center' })
    doc.moveDown(0.3)
  })
  
  doc.moveDown(4)
  
  // Disclaimer
  doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Oblique').text(
    'This report is generated by AI analysis of historical question papers and web research. ' +
    'Predicted questions are for preparation guidance only and do not guarantee examination content.',
    { align: 'center', width: doc.page.width - 100 }
  )
  
  // Bottom accent bar
  doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill('#0ea5e9')
}

function addTableOfContents(doc: PDFKit.PDFDocument) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Table of Contents', 50, 50)
  doc.moveDown(1)
  
  const toc = [
    { title: 'Executive Summary', page: 3 },
    { title: 'High-Priority Questions', page: 4 },
    { title: 'Medium-Priority Questions', page: 5 },
    { title: 'Unit-Wise Important Questions', page: 6 },
    { title: 'Repeated Questions & Variations', page: 7 },
    { title: 'Important Concepts & Definitions', page: 8 },
    { title: 'Web Research Findings', page: 9 },
    { title: 'Examination Preparation Recommendations', page: 10 },
    { title: 'References & Sources', page: 11 },
  ]
  
  toc.forEach(item => {
    doc.fontSize(12).fillColor('#334155').font('Helvetica')
    const titleWidth = doc.widthOfString(item.title)
    const pageStr = String(item.page)
    const pageWidth = doc.widthOfString(pageStr)
    const dotsWidth = doc.page.width - 100 - titleWidth - pageWidth - 20
    const dots = '.'.repeat(Math.max(1, Math.floor(dotsWidth / doc.widthOfString('.'))))
    
    doc.text(item.title, 50, doc.y, { continued: true })
    doc.fillColor('#cbd5e1').text(` ${dots} `, { continued: true })
    doc.fillColor('#0ea5e9').text(pageStr)
    doc.moveDown(0.5)
  })
}

function addExecutiveSummary(
  doc: PDFKit.PDFDocument,
  analysis: any,
  papers: any[]
) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Executive Summary', 50, 50)
  doc.moveDown(1)
  
  // Key Statistics
  addSection(doc, 'Key Statistics', [
    { label: 'Total Questions Analyzed', value: analysis.totalQuestions.toString() },
    { label: 'Question Papers Processed', value: analysis.totalPapers.toString() },
    { label: 'Exact Repeated Questions', value: analysis.exactRepeats.toString() },
    { label: 'Semantically Similar Questions', value: analysis.semanticRepeats.toString() },
    { label: 'High-Priority Topics', value: analysis.priorityItems.filter((p: any) => p.priority === 'HIGH').length.toString() },
    { label: 'Medium-Priority Topics', value: analysis.priorityItems.filter((p: any) => p.priority === 'MEDIUM').length.toString() },
  ])
  
  doc.moveDown(1)
  
  // Paper breakdown
  addSection(doc, 'Papers Analyzed', papers.map((p, i) => 
    `${i + 1}. ${p.title} (${p.paperType}${p.examinationYear ? `, ${p.examinationYear}` : ''}${p.marks ? `, ${p.marks} marks` : ''})`
  ))
  
  doc.moveDown(1)
  
  // Major findings
  const highPriority = analysis.priorityItems.filter((p: any) => p.priority === 'HIGH')
  if (highPriority.length > 0) {
    addSection(doc, 'Major Recurring Themes', highPriority.slice(0, 5).map(p => 
      `• ${p.concept} — ${p.reason} (Frequency: ${p.frequency}, Papers: ${p.papersCount})`
    ))
  }
}

function addHighPriorityQuestions(doc: PDFKit.PDFDocument, priorityItems: any[]) {
  const highPriority = priorityItems.filter(p => p.priority === 'HIGH')
  
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('High-Priority Questions', 50, 50)
  doc.moveDown(0.5)
  
  doc.fontSize(10).fillColor('#dc2626').font('Helvetica-Bold').text('■ HIGH PRIORITY', 50, doc.y)
  doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Based on historical frequency, recency, marks weight, and cross-paper occurrence', { width: doc.page.width - 100 })
  doc.moveDown(1)
  
  if (highPriority.length === 0) {
    doc.fontSize(11).fillColor('#64748b').text('No high-priority questions identified from historical data.')
    return
  }
  
  highPriority.forEach((item, index) => {
    if (doc.y > doc.page.height - 150) doc.addPage()
    
    // Priority badge
    doc.fontSize(11).fillColor('#dc2626').font('Helvetica-Bold').text(`HIGH PRIORITY`, 50, doc.y)
    doc.moveDown(0.3)
    
    // Question text
    doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`${index + 1}. ${item.questionText}`)
    doc.moveDown(0.3)
    
    // Metadata
    const meta = []
    if (item.frequency > 1) meta.push(`Frequency: ${item.frequency}`)
    if (item.papersCount > 1) meta.push(`Appears in ${item.papersCount} papers`)
    if (item.avgMarks > 0) meta.push(`Avg Marks: ${item.avgMarks.toFixed(1)}`)
    if (item.lastYear) meta.push(`Last seen: ${item.lastYear}`)
    if (item.units.length) meta.push(`Units: ${item.units.join(', ')}`)
    if (item.topics.length) meta.push(`Topics: ${item.topics.slice(0, 3).join(', ')}`)
    if (item.isExactRepeat) meta.push('⚠ EXACT REPEAT')
    
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(meta.join('  |  '))
    doc.moveDown(0.3)
    
    // Reason
    doc.fontSize(9).fillColor('#334155').font('Helvetica-Oblique').text(`Reason: ${item.reason}`, { width: doc.page.width - 100 })
    doc.moveDown(1)
  })
}

function addMediumPriorityQuestions(doc: PDFKit.PDFDocument, priorityItems: any[]) {
  const mediumPriority = priorityItems.filter(p => p.priority === 'MEDIUM')
  
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Medium-Priority Questions', 50, 50)
  doc.moveDown(0.5)
  
  doc.fontSize(10).fillColor('#ea580c').font('Helvetica-Bold').text('■ MEDIUM PRIORITY', 50, doc.y)
  doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Moderate historical evidence; recommended for review', { width: doc.page.width - 100 })
  doc.moveDown(1)
  
  if (mediumPriority.length === 0) {
    doc.fontSize(11).fillColor('#64748b').text('No medium-priority questions identified.')
    return
  }
  
  mediumPriority.forEach((item, index) => {
    if (doc.y > doc.page.height - 120) doc.addPage()
    
    doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`${index + 1}. ${item.questionText}`)
    doc.moveDown(0.2)
    
    const meta = []
    if (item.frequency > 1) meta.push(`Frequency: ${item.frequency}`)
    if (item.papersCount > 1) meta.push(`Papers: ${item.papersCount}`)
    if (item.avgMarks > 0) meta.push(`Avg Marks: ${item.avgMarks.toFixed(1)}`)
    if (item.units.length) meta.push(`Units: ${item.units.join(', ')}`)
    
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(meta.join('  |  '))
    doc.moveDown(0.2)
    
    doc.fontSize(9).fillColor('#334155').font('Helvetica-Oblique').text(`Reason: ${item.reason}`, { width: doc.page.width - 100 })
    doc.moveDown(0.8)
  })
}

function addUnitWiseQuestions(doc: PDFKit.PDFDocument, analysis: any) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Unit-Wise Important Questions', 50, 50)
  doc.moveDown(1)
  
  const unitDist = analysis.analysisData?.unitDistribution || {}
  const priorityByUnit: Record<string, any[]> = {}
  
  analysis.priorityItems.forEach((item: any) => {
    item.units.forEach((unit: string) => {
      if (!priorityByUnit[unit]) priorityByUnit[unit] = []
      priorityByUnit[unit].push(item)
    })
  })
  
  // Sort units by question count
  const sortedUnits = Object.entries(unitDist).sort(([,a], [,b]) => b - a)
  
  sortedUnits.forEach(([unit, count]) => {
    if (doc.y > doc.page.height - 100) doc.addPage()
    
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text(unit)
    doc.fontSize(10).fillColor('#64748b').text(`${count} questions in analysis`)
    doc.moveDown(0.5)
    
    const items = priorityByUnit[unit] || []
    items.slice(0, 10).forEach((item, idx) => {
      const badge = item.priority === 'HIGH' ? '🔴' : item.priority === 'MEDIUM' ? '🟡' : '⚪'
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica').text(`${idx + 1}. ${badge} ${item.questionText.slice(0, 120)}${item.questionText.length > 120 ? '...' : ''}`)
      doc.moveDown(0.3)
    })
    
    doc.moveDown(0.5)
  })
}

function addRepeatedQuestions(doc: PDFKit.PDFDocument, analysis: any) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Repeated Questions & Similar Variations', 50, 50)
  doc.moveDown(0.5)
  
  doc.fontSize(10).fillColor('#64748b').text(
    `Exact Repeats: ${analysis.exactRepeats}  |  Semantic Similarities: ${analysis.semanticRepeats}`
  )
  doc.moveDown(1)
  
  // Show exact repeat items
  const exactRepeats = analysis.priorityItems.filter((p: any) => p.isExactRepeat)
  if (exactRepeats.length > 0) {
    doc.fontSize(14).fillColor('#dc2626').font('Helvetica-Bold').text('Exact Repeats (Identical Questions)')
    doc.moveDown(0.5)
    
    exactRepeats.forEach((item, index) => {
      if (doc.y > doc.page.height - 100) doc.addPage()
      
      doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`${index + 1}. ${item.questionText}`)
      doc.moveDown(0.2)
      
      const meta = []
      meta.push(`Frequency: ${item.frequency}`)
      meta.push(`Papers: ${item.papersCount}`)
      if (item.firstYear && item.lastYear) meta.push(`Years: ${item.firstYear}–${item.lastYear}`)
      if (item.avgMarks > 0) meta.push(`Avg Marks: ${item.avgMarks.toFixed(1)}`)
      
      doc.fontSize(9).fillColor('#64748b').text(meta.join('  |  '))
      doc.moveDown(0.8)
    })
  }
  
  doc.moveDown(1)
  
  // Semantic repeats
  if (analysis.semanticRepeats > 0) {
    doc.fontSize(14).fillColor('#ea580c').font('Helvetica-Bold').text('Semantically Similar Questions')
    doc.fontSize(9).fillColor('#64748b').text('Questions with >85% semantic similarity (identified via embeddings)')
    doc.moveDown(0.5)
    
    const semanticItems = analysis.priorityItems.filter((p: any) => !p.isExactRepeat && p.frequency > 1)
    semanticItems.slice(0, 10).forEach((item, index) => {
      if (doc.y > doc.page.height - 100) doc.addPage()
      
      doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`${index + 1}. ${item.questionText}`)
      doc.moveDown(0.2)
      
      const meta = []
      meta.push(`Concept Group: ${item.concept}`)
      meta.push(`Frequency: ${item.frequency}`)
      meta.push(`Papers: ${item.papersCount}`)
      
      doc.fontSize(9).fillColor('#64748b').text(meta.join('  |  '))
      doc.moveDown(0.6)
    })
  }
}

function addImportantConcepts(doc: PDFKit.PDFDocument, analysis: any) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Important Concepts & Definitions', 50, 50)
  doc.moveDown(1)
  
  // Collect unique concepts from priority items
  const concepts = new Map<string, { frequency: number; priority: string; units: string[]; topics: string[] }>()
  
  analysis.priorityItems.forEach((item: any) => {
    const key = item.concept
    if (!concepts.has(key)) {
      concepts.set(key, { frequency: 0, priority: item.priority, units: [], topics: [] })
    }
    const c = concepts.get(key)!
    c.frequency += item.frequency
    c.units.push(...item.units)
    c.topics.push(...item.topics)
    // Upgrade priority if any item is higher
    if (item.priority === 'HIGH' && c.priority !== 'HIGH') c.priority = 'HIGH'
    else if (item.priority === 'MEDIUM' && c.priority === 'LOW') c.priority = 'MEDIUM'
  })
  
  // Sort by priority then frequency
  const sortedConcepts = Array.from(concepts.entries()).sort(([,a], [,b]) => {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
    return b.frequency - a.frequency
  })
  
  sortedConcepts.forEach(([concept, data], index) => {
    if (doc.y > doc.page.height - 100) doc.addPage()
    
    const badge = data.priority === 'HIGH' ? '🔴 HIGH' : data.priority === 'MEDIUM' ? '🟡 MEDIUM' : '⚪ LOW'
    
    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(`${index + 1}. ${concept}`)
    doc.fontSize(10).fillColor(data.priority === 'HIGH' ? '#dc2626' : data.priority === 'MEDIUM' ? '#ea580c' : '#64748b')
      .font('Helvetica-Bold').text(`Priority: ${badge}  |  Total Frequency: ${data.frequency}`)
    
    if (data.units.length) {
      doc.fontSize(9).fillColor('#64748b').text(`Units: ${[...new Set(data.units)].join(', ')}`)
    }
    if (data.topics.length) {
      doc.fontSize(9).fillColor('#64748b').text(`Topics: ${[...new Set(data.topics)].slice(0, 5).join(', ')}`)
    }
    
    doc.moveDown(0.8)
  })
}

function addWebResearchFindings(doc: PDFKit.PDFDocument, webResearch: any) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Additional Subject Research (Web-Based)', 50, 50)
  doc.moveDown(0.5)
  
  doc.fontSize(10).fillColor('#64748b').font('Helvetica-Oblique').text(
    'The following concepts were identified through web research of academic syllabi, textbooks, and educational resources. ' +
    'These supplement the historical question paper analysis.'
  )
  doc.moveDown(1)
  
  if (webResearch.syllabusTopics.length > 0) {
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text('Standard Syllabus Topics')
    doc.moveDown(0.5)
    webResearch.syllabusTopics.forEach((topic: string, i: number) => {
      doc.fontSize(11).fillColor('#0f172a').text(`${i + 1}. ${topic}`)
      doc.moveDown(0.3)
    })
    doc.moveDown(1)
  }
  
  if (webResearch.importantConcepts.length > 0) {
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text('Fundamental Concepts (from Web Research)')
    doc.moveDown(0.5)
    webResearch.importantConcepts.forEach((concept: string, i: number) => {
      doc.fontSize(11).fillColor('#0f172a').text(`${i + 1}. ${concept}`)
      doc.moveDown(0.3)
    })
    doc.moveDown(1)
  }
  
  if (webResearch.missingTopics.length > 0) {
    doc.fontSize(14).fillColor('#dc2626').font('Helvetica-Bold').text('Potentially Missing Topics')
    doc.fontSize(9).fillColor('#64748b').text('Topics in standard syllabi but not well-represented in analyzed papers')
    doc.moveDown(0.5)
    webResearch.missingTopics.forEach((topic: string, i: number) => {
      doc.fontSize(11).fillColor('#dc2626').text(`${i + 1}. ${topic}`)
      doc.moveDown(0.3)
    })
    doc.moveDown(1)
  }
  
  if (webResearch.sources.length > 0) {
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text('Academic Sources Referenced')
    doc.moveDown(0.5)
    webResearch.sources.forEach((source: any, i: number) => {
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(`${i + 1}. ${source.title}`)
      doc.fontSize(9).fillColor('#0ea5e9').text(source.url, { link: source.url, underline: true })
      doc.fontSize(9).fillColor('#64748b').text(`Type: ${source.type}  |  Relevance: ${Math.round(source.relevance * 100)}%`)
      doc.moveDown(0.5)
    })
  }
}

function addRecommendations(doc: PDFKit.PDFDocument, analysis: any, papers: any[]) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('Examination Preparation Recommendations', 50, 50)
  doc.moveDown(1)
  
  const recommendations = [
    {
      title: 'Focus on High-Priority Topics',
      items: analysis.priorityItems
        .filter((p: any) => p.priority === 'HIGH')
        .slice(0, 5)
        .map((p: any) => `${p.concept} (${p.reason})`)
    },
    {
      title: 'Review Repeated Questions',
      items: analysis.exactRepeats > 0 
        ? analysis.priorityItems.filter((p: any) => p.isExactRepeat).slice(0, 3).map((p: any) => 
            `${p.concept} — appeared ${p.frequency} times across ${p.papersCount} papers`
          )
        : ['No exact repeats found in analyzed papers']
    },
    {
      title: 'Unit-Wise Preparation Strategy',
      items: Object.entries(analysis.analysisData?.unitDistribution || {})
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([unit, count]) => `${unit}: ${count} questions — allocate proportional study time`)
    },
    {
      title: 'Question Type Practice',
      items: Object.entries(analysis.analysisData?.questionTypeDistribution || {})
        .map(([type, count]) => `${type}: ${count} questions — practice ${type.toLowerCase().replace('_', ' ')} format`)
    },
    {
      title: 'Time Management',
      items: [
        `Total questions in analysis: ${analysis.totalQuestions}`,
        `Average marks per question: ${(analysis.priorityItems.reduce((s: number, p: any) => s + (p.avgMarks || 0), 0) / analysis.priorityItems.length).toFixed(1)}`,
        'Practice writing answers within time limits',
        'Focus on high-mark questions (10+ marks) for detailed preparation',
      ]
    },
    {
      title: 'Important Note',
      items: [
        'This analysis is based on historical question papers and web research only.',
        'Predicted questions are for preparation guidance and do not guarantee examination content.',
        'Always refer to the official syllabus and recent course materials.',
        'Balance preparation across all syllabus topics, not just high-priority ones.',
      ]
    }
  ]
  
  recommendations.forEach(rec => {
    if (doc.y > doc.page.height - 100) doc.addPage()
    
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text(rec.title)
    doc.moveDown(0.5)
    
    rec.items.forEach((item, i) => {
      doc.fontSize(10).fillColor('#334155').font('Helvetica').text(`• ${item}`, { width: doc.page.width - 120 })
      doc.moveDown(0.3)
    })
    
    doc.moveDown(0.8)
  })
}

function addReferences(doc: PDFKit.PDFDocument, sources: any[], papers: any[]) {
  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('References & Source Citations', 50, 50)
  doc.moveDown(1)
  
  // Question Papers
  doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text('Question Papers Analyzed')
  doc.moveDown(0.5)
  
  papers.forEach((paper, i) => {
    doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(`${i + 1}. ${paper.title}`)
    const details = []
    details.push(`Type: ${paper.paperType}`)
    if (paper.examinationYear) details.push(`Year: ${paper.examinationYear}`)
    if (paper.marks) details.push(`Marks: ${paper.marks}`)
    if (paper.semester) details.push(`Semester: ${paper.semester}`)
    if (paper.unit) details.push(`Unit: ${paper.unit}`)
    doc.fontSize(9).fillColor('#64748b').text(details.join('  |  '))
    doc.moveDown(0.5)
  })
  
  doc.moveDown(1)
  
  // Web Sources
  if (sources.length > 0) {
    doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text('Academic & Web Sources')
    doc.moveDown(0.5)
    
    sources.forEach((source, i) => {
      doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text(`${i + 1}. ${source.title}`)
      doc.fontSize(9).fillColor('#0ea5e9').text(source.url, { link: source.url, underline: true })
      doc.fontSize(9).fillColor('#64748b').text(`Type: ${source.type}  |  Relevance: ${Math.round(source.relevance * 100)}%`)
      doc.moveDown(0.5)
    })
  }
}

function addSection(doc: PDFKit.PDFDocument, title: string, items: string[]) {
  doc.fontSize(14).fillColor('#0ea5e9').font('Helvetica-Bold').text(title)
  doc.moveDown(0.5)
  
  items.forEach((item, i) => {
    doc.fontSize(10).fillColor('#334155').font('Helvetica').text(`${i + 1}. ${item}`, { width: doc.page.width - 100 })
    doc.moveDown(0.3)
  })
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const pageCount = doc.bufferedPageRange().count
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)
    doc.fontSize(8).fillColor('#94a3b8').text(
      `Page ${i + 1} of ${pageCount}`,
      50,
      doc.page.height - 40,
      { align: 'center', width: doc.page.width - 100 }
    )
  }
}