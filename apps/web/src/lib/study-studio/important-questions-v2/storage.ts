/**
 * Storage Adapter for V2 Important Questions
 * Wraps existing storage client (uses standard document storage like Research Notebook)
 */

import { uploadFile, downloadFile, deleteFile } from '@/lib/storage/client';
import type { StorageAdapter } from './types';

/** Bucket name for important questions documents - uses standard documents bucket */
const IMPORTANT_QUESTIONS_BUCKET = 'documents';

/**
 * Create storage adapter using existing storage client
 * Uses standard document storage path like Research Notebook
 */
export function createStorageAdapter(): StorageAdapter {
  return {
    async put(input: { ownerId: string; fileName: string; mimeType: string; bytes: Uint8Array }) {
      const { ownerId, fileName, mimeType, bytes } = input;
      // Sanitize filename for storage path (standard document path like Research Notebook)
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageKey = `documents/${ownerId}/${Date.now()}-${safeName}`;

      await uploadFile(IMPORTANT_QUESTIONS_BUCKET, storageKey, Buffer.from(bytes), {
        contentType: mimeType,
      });

      return { storageKey };
    },

    async get(storageKey: string) {
      const buffer = await downloadFile(IMPORTANT_QUESTIONS_BUCKET, storageKey);
      return new Uint8Array(buffer);
    },

    async remove(storageKey: string) {
      await deleteFile(IMPORTANT_QUESTIONS_BUCKET, storageKey);
    },
  };
}

/**
 * Get the bucket name for important questions
 */
export function getImportantQuestionsBucket(): string {
  return IMPORTANT_QUESTIONS_BUCKET;
}