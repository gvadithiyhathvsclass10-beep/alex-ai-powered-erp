import 'server-only'

import path from 'node:path'
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as signS3Url } from '@aws-sdk/s3-request-presigner'

type UploadOptions = {
  contentType?: string
  [key: string]: unknown
}

type UploadResult = {
  path: string
  size: number
}

const mode = () => (process.env.STORAGE_MODE || 'local').toLowerCase()
const isS3Mode = () => ['s3', 'r2', 'cloudflare-r2'].includes(mode())

export function setStorageAdapter(_adapter: unknown): void {
  // Compatibility hook for tests that reset the singleton based on env changes.
}

export function getLocalStorageRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_ROOT || process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), 'storage')
  )
}

function normalizeStorageKey(bucket: string, key: string): string {
  const cleanBucket = bucket.replace(/^\/+|\/+$/g, '')
  const cleanKey = key.replace(/^\/+/, '')
  if (!cleanBucket || !cleanKey) return cleanKey
  const prefixed = `${cleanBucket}/`
  return cleanKey.startsWith(prefixed) ? cleanKey.slice(prefixed.length) : cleanKey
}

function safePath(...parts: string[]): string {
  const root = path.resolve(parts[0])
  const target = path.resolve(root, ...parts.slice(1))
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('path traversal detected: invalid storage path')
  }
  return target
}

function localFilePath(bucket: string, key: string): string {
  const root = getLocalStorageRoot()
  const normalizedKey = normalizeStorageKey(bucket, key)
  return safePath(root, bucket, normalizedKey)
}

function s3Bucket(): string {
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET
  if (!bucket) {
    throw new Error('S3_BUCKET (or R2_BUCKET) must be configured when STORAGE_MODE=s3/r2')
  }
  return bucket
}

function s3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'auto'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3/R2 storage requires S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY'
    )
  }

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
}

// In S3/R2 mode one physical bucket is used, with the logical app bucket
// (e.g. "documents") prepended to the object key.
function objectKey(bucket: string, key: string): string {
  const cleanBucket = bucket.replace(/^\/+|\/+$/g, '')
  const cleanKey = normalizeStorageKey(bucket, key)
  if (!cleanBucket || !cleanKey || cleanKey.split('/').includes('..')) {
    throw new Error('Invalid storage bucket or path')
  }
  return `${cleanBucket}/${cleanKey}`
}

export async function uploadFile(
  bucket: string,
  key: string,
  data: Buffer | Uint8Array,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const normalizedKey = normalizeStorageKey(bucket, key)
  if (!bucket || !normalizedKey || normalizedKey.split('/').includes('..')) {
    throw new Error('Invalid storage bucket or path')
  }

  if (isS3Mode()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: objectKey(bucket, normalizedKey),
        Body: data,
        ContentType: options.contentType || 'application/octet-stream',
      })
    )
    return { path: normalizedKey, size: data.byteLength }
  }

  const target = localFilePath(bucket, normalizedKey)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, data)
  return { path: normalizedKey, size: data.byteLength }
}

export async function fileExists(bucket: string, key: string): Promise<boolean> {
  const normalizedKey = normalizeStorageKey(bucket, key)
  if (isS3Mode()) {
    try {
      await s3Client().send(
        new HeadObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, normalizedKey) })
      )
      return true
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
      const name = (error as { name?: string })?.name
      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') return false
      throw error
    }
  }

  try {
    await access(localFilePath(bucket, normalizedKey), constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function downloadFile(bucket: string, key: string): Promise<Buffer> {
  const normalizedKey = normalizeStorageKey(bucket, key)
  if (isS3Mode()) {
    const response = await s3Client().send(
      new GetObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, normalizedKey) })
    )
    if (!response.Body) throw new Error(`Stored file has no body: ${normalizedKey}`)
    return Buffer.from(await response.Body.transformToByteArray())
  }

  return readFile(localFilePath(bucket, normalizedKey))
}

export async function getSignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const normalizedKey = normalizeStorageKey(bucket, key)
  if (isS3Mode()) {
    return signS3Url(
      s3Client(),
      new GetObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, normalizedKey) }),
      { expiresIn: Math.max(1, Math.min(expiresInSeconds, 604800)) }
    )
  }

  const segments = [bucket, ...normalizedKey.split('/')].map(segment => encodeURIComponent(segment))
  return `/api/documents/local/${segments.join('/')}`
}

export async function deleteFile(
  bucket: string,
  keys: string | string[]
): Promise<void> {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(key => normalizeStorageKey(bucket, key))
  if (list.length === 0) return

  if (isS3Mode()) {
    await s3Client().send(
      new DeleteObjectsCommand({
        Bucket: s3Bucket(),
        Delete: {
          Objects: list.map(key => ({ Key: objectKey(bucket, key) })),
          Quiet: true,
        },
      })
    )
    return
  }

  await Promise.all(
    list.map(async key => {
      try {
        await unlink(localFilePath(bucket, key))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    })
  )
}
