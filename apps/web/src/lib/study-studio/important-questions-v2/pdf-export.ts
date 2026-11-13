/**
 * PDF Export for V2 Important Questions
 * Uses pdf-lib for server-side PDF generation
 * Only generates from persisted, owner-authorized results
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AnalysisResult } from './types';

/**
 * Generate PDF report from analysis result
 * Caller must fetch the saved, owner-authorized result first
 */
export async function renderAnalysisPdf(result: AnalysisResult): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let page = pdf.addPage([595.28, 841.89]); // A4
  let y = page.getHeight() - margin;

  const add = (text: string, size = 10, isBold = false) => {
    const lines = wrap(text, 92);
    for (const line of lines) {
      if (y < margin + 24) {
        page = pdf.addPage([595.28, 841.89]);
        y = page.getHeight() - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: isBold ? bold : font,
        color: rgb(0.12, 0.16, 0.23),
      });
      y -= size + 5;
    }
  };

  // Title page
  add(result.title, 19, true);
  add(`Created: ${new Date(result.createdAt).toLocaleString()} | Papers: ${result.summary.papersAnalyzed} | Questions: ${result.summary.totalQuestions}`, 9);
  y -= 10;

  // Overview
  add('OVERVIEW', 13, true);
  add(`Exact repeat groups: ${result.summary.exactRepeatGroups} | Semantic groups: ${result.summary.semanticRepeatGroups} | Concept groups: ${result.summary.conceptGroups}`);
  y -= 8;

  // Ranked questions
  add('RANKED QUESTIONS', 13, true);
  for (const q of result.rankedQuestions) {
    add(`${q.priority} · Score ${q.score} · ${q.question}`, 11, true);
    for (const why of q.rationale) {
      add(`Evidence: ${why}`, 9);
    }
    for (const o of q.occurrences) {
      add(`Source: ${o.sourceFileName}${o.page ? ` · page ${o.page}` : ''}${o.questionNumber ? ` · question ${o.questionNumber}` : ''}${o.marks ? ` · ${o.marks} marks` : ''}`, 8);
    }
    y -= 7;
  }

  // Repeat groups
  if (result.repeatGroups.length > 0) {
    add('REPEAT GROUPS', 13, true);
    for (const g of result.repeatGroups) {
      add(`${g.kind} · ${g.frequency} occurrences · confidence ${Math.round(g.confidence * 100)}%`, 10, true);
      add(g.canonicalQuestion, 9);
      add(g.explanation, 8);
      for (const id of g.occurrenceIds) {
        const q = result.questions.find(x => x.id === id);
        if (q) {
          add(`• ${q.sourceFileName}${q.page ? ` page ${q.page}` : ''}: ${q.text}`, 8);
        }
      }
      y -= 6;
    }
  }

  // Unit coverage
  if (result.unitCoverage.length > 0) {
    add('UNIT COVERAGE', 13, true);
    for (const u of result.unitCoverage) {
      add(`${u.unit}: ${u.questionCount} questions, ${u.totalMarks} explicitly extracted marks. Topics: ${u.topics.join(', ') || 'Not classified'}`, 9);
    }
  }

  // Topic frequency & study order
  if (result.studyOrder.length > 0) {
    add('TOPIC FREQUENCY & STUDY ORDER', 13, true);
    for (const s of result.studyOrder) {
      add(`${s.rank}. ${s.topic} — ${s.reason}`, 9);
    }
  }

  // Source documents
  add('SOURCE DOCUMENTS', 13, true);
  for (const d of result.documents) {
    add(`${d.fileName}${d.academicYear ? ` · ${d.academicYear}` : ''}${d.examYear ? ` · ${d.examYear}` : ''}`, 9);
  }

  // Limitations
  if (result.limitations.length) {
    add('LIMITATIONS', 13, true);
    for (const l of result.limitations) {
      add(l, 9);
    }
  }

  return pdf.save();
}

/** Word-wrap text to fit within character limit */
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}