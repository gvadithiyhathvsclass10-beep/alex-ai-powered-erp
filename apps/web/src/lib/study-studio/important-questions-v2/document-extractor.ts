/**
 * Document Extractor Adapter for V2 Important Questions
 * Wraps existing extractContent service with V2 interface
 */

import { extractContent, validateUploadedFile, getMaxUploadSizeBytes } from '@/lib/document-processing/extractors';
import type { DocumentExtractor, ExtractedDocument, SourceDocument } from './types';

/**
 * Create document extractor using existing extraction pipeline
 */
export function createDocumentExtractor(): DocumentExtractor {
  return {
    async extract(input: { bytes: Uint8Array; fileName: string; mimeType: string }): Promise<ExtractedDocument> {
      const { bytes, fileName, mimeType } = input;

      // Validate file
      const maxSize = getMaxUploadSizeBytes();
      validateUploadedFile(fileName, mimeType, Buffer.from(bytes), maxSize);

      // Extract content using existing pipeline
      const documentType = resolveDocumentTypeFromMime(mimeType);
      const extracted = await extractContent(Buffer.from(bytes), documentType, mimeType);

      // Build source document metadata
      const document: SourceDocument = {
        id: '', // Will be filled after DB insert
        fileName,
        mimeType,
        pageCount: extracted.pages.length,
      };

      // Convert pages to V2 format
      const pages = extracted.pages.map((page, index) => ({
        page: index + 1,
        text: page.text,
        // Note: existing extractor doesn't track OCR per page, but we can infer from metadata
        ocrUsed: extracted.metadata?.extractor === 'tesseract.js' || extracted.metadata?.extractor === 'pdftotext',
      }));

      return {
        document,
        text: extracted.text,
        pages,
      };
    },
  };
}

/** Map MIME type to Prisma DocumentType */
function resolveDocumentTypeFromMime(mimeType: string) {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  const mimeToType: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/plain': 'TXT',
    'text/markdown': 'MARKDOWN',
    'text/x-markdown': 'MARKDOWN',
    'application/rtf': 'DOC', // RTF handled as DOC
    'application/vnd.oasis.opendocument.text': 'DOC', // ODT handled as DOC
  };
  return (mimeToType[normalized] as any) || 'OTHER';
}

/**
 * Extract text from stored document (for reprocessing)
 */
export async function extractFromStorage(
  storageBucket: string,
  storagePath: string,
  mimeType: string,
  fileName: string
): Promise<ExtractedDocument> {
  const { downloadFile } = await import('@/lib/storage/client');
  const buffer = await downloadFile(storageBucket, storagePath);
  return createDocumentExtractor().extract({ bytes: new Uint8Array(buffer), fileName, mimeType });
}