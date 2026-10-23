<<<<<<< HEAD
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
}

const mode = () => (process.env.STORAGE_MODE || 'local').toLowerCase()
const isS3Mode = () => ['s3', 'r2', 'cloudflare-r2'].includes(mode())

export function getLocalStorageRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_ROOT || process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), 'storage')
  )
}

function safePath(...parts: string[]): string {
  const root = path.resolve(...parts.slice(0, 1))
  const target = path.resolve(root, ...parts.slice(1))
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Invalid storage path')
  }
  return target
}

function localFilePath(bucket: string, key: string): string {
  const root = getLocalStorageRoot()
  return safePath(root, bucket, key)
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
  const cleanKey = key.replace(/^\/+/, '')
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
  if (!bucket || !key || key.split('/').includes('..')) {
    throw new Error('Invalid storage bucket or path')
  }

  if (isS3Mode()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: objectKey(bucket, key),
        Body: data,
        ContentType: options.contentType || 'application/octet-stream',
      })
    )
    return { path: key }
  }

  const target = localFilePath(bucket, key)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, data)
  return { path: key }
}

export async function fileExists(bucket: string, key: string): Promise<boolean> {
  if (isS3Mode()) {
    try {
      await s3Client().send(
        new HeadObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, key) })
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
    await access(localFilePath(bucket, key), constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function downloadFile(bucket: string, key: string): Promise<Buffer> {
  if (isS3Mode()) {
    const response = await s3Client().send(
      new GetObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, key) })
    )
    if (!response.Body) throw new Error(`Stored file has no body: ${key}`)
    return Buffer.from(await response.Body.transformToByteArray())
  }

  return readFile(localFilePath(bucket, key))
}

export async function getSignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (isS3Mode()) {
    return signS3Url(
      s3Client(),
      new GetObjectCommand({ Bucket: s3Bucket(), Key: objectKey(bucket, key) }),
      { expiresIn: Math.max(1, Math.min(expiresInSeconds, 604800)) }
    )
  }

  const segments = [bucket, ...key.split('/')].map(segment => encodeURIComponent(segment))
  return `/api/documents/local/${segments.join('/')}`
}

export async function deleteFile(
  bucket: string,
  keys: string | string[]
): Promise<void> {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean)
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
=======
import { mkdir, writeFile, readFile, unlink, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const localStorageRoot = path.join(process.cwd(), 'storage')
const useLocalStorage = () => (process.env.STORAGE_MODE || 'local') === 'local'

export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface UploadResult {
  path: string
  size: number
  checksum: string
}

export interface FileInfo {
  name: string
  path: string
  size: number
  lastModified: Date
}

export interface StorageAdapter {
  upload(bucket: string, path: string, file: Buffer | File | Blob, options?: UploadOptions): Promise<UploadResult>
  download(bucket: string, path: string): Promise<Buffer>
  delete(bucket: string, paths: string[]): Promise<void>
  getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string>
  list(bucket: string, prefix: string): Promise<FileInfo[]>
  exists(bucket: string, path: string): Promise<boolean>
}

class LocalStorageAdapter implements StorageAdapter {
  private root: string

  constructor(root: string) {
    this.root = root
  }

  private resolvePath(bucket: string, filePath: string): string {
    const fullPath = path.resolve(this.root, bucket, filePath)
    const bucketRoot = path.resolve(this.root, bucket)
    if (!fullPath.startsWith(bucketRoot + path.sep) && fullPath !== bucketRoot) {
      throw new Error('Invalid path: path traversal attempt')
    }
    return fullPath
  }

  async upload(bucket: string, filePath: string, file: Buffer | File | Blob, options?: UploadOptions): Promise<UploadResult> {
    const target = this.resolvePath(bucket, filePath)
    await mkdir(path.dirname(target), { recursive: true })
    
    let buffer: Buffer
    if (file instanceof Buffer) {
      buffer = file
    } else if (file instanceof Blob) {
      buffer = Buffer.from(await file.arrayBuffer())
    } else {
      throw new Error('Invalid file type')
    }

    const checksum = createHash('sha256').update(buffer).digest('hex')
    await writeFile(target, buffer)
    
    return { path: `${bucket}/${filePath}`, size: buffer.length, checksum }
  }

  async download(bucket: string, filePath: string): Promise<Buffer> {
    const target = this.resolvePath(bucket, filePath)
    return readFile(target)
  }

  async delete(bucket: string, paths: string[]): Promise<void> {
    await Promise.all(paths.map(p => 
      unlink(this.resolvePath(bucket, p)).catch(() => undefined)
    ))
  }

  async getSignedUrl(bucket: string, filePath: string, expiresIn = 3600): Promise<string> {
    return `/api/documents/local/${encodeURIComponent(bucket)}/${encodeURIComponent(filePath)}`
  }

  async list(bucket: string, prefix: string): Promise<FileInfo[]> {
    const dir = this.resolvePath(bucket, prefix)
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const results = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name)
        const stats = await stat(fullPath)
        return {
          name: entry.name,
          path: `${bucket}/${prefix}/${entry.name}`.replace(/\/+/g, '/'),
          size: stats.size,
          lastModified: stats.mtime,
        }
      }))
      return results
    } catch {
      return []
    }
  }

  async exists(bucket: string, filePath: string): Promise<boolean> {
    try {
      const target = this.resolvePath(bucket, filePath)
      await stat(target)
      return true
    } catch {
      return false
    }
  }
}

class S3StorageAdapter implements StorageAdapter {
  private endpoint: string
  private accessKeyId: string
  private secretAccessKey: string
  private bucket: string
  private region: string
  private s3Client: any = null

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT || ''
    this.accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
    this.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''
    this.bucket = process.env.S3_BUCKET || ''
    this.region = process.env.S3_REGION || 'us-east-1'
  }

  private async getClient() {
    if (!this.s3Client) {
      const { S3Client } = await import('@aws-sdk/client-s3')
      this.s3Client = new S3Client({
        endpoint: this.endpoint,
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
        forcePathStyle: !!this.endpoint,
      })
    }
    return this.s3Client
  }

  private getKey(bucket: string, filePath: string): string {
    return `${bucket}/${filePath}`
  }

  async upload(bucket: string, filePath: string, file: Buffer | File | Blob, options?: UploadOptions): Promise<UploadResult> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()
    
    let buffer: Buffer
    if (file instanceof Buffer) {
      buffer = file
    } else if (file instanceof Blob) {
      buffer = Buffer.from(await file.arrayBuffer())
    } else {
      throw new Error('Invalid file type')
    }

    const checksum = createHash('sha256').update(buffer).digest('hex')
    const key = this.getKey(bucket, filePath)

    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    }))

    return { path: key, size: buffer.length, checksum }
  }

  async download(bucket: string, filePath: string): Promise<Buffer> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()
    const key = this.getKey(bucket, filePath)

    const response = await client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))

    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async delete(bucket: string, paths: string[]): Promise<void> {
    const { S3Client, DeleteObjectsCommand } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()
    
    await client.send(new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: paths.map(p => ({ Key: this.getKey(bucket, p) })),
        Quiet: true,
      },
    }))
  }

  async getSignedUrl(bucket: string, filePath: string, expiresIn = 3600): Promise<string> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const client = await this.getClient()
    const key = this.getKey(bucket, filePath)

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(client, command, { expiresIn })
  }

  async list(bucket: string, prefix: string): Promise<FileInfo[]> {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()
    const keyPrefix = this.getKey(bucket, prefix)

    const response = await client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: keyPrefix,
    }))

    return (response.Contents || []).map((obj: { Key?: string; Size?: number; LastModified?: Date }) => ({
      name: path.basename(obj.Key || ''),
      path: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }))
  }

  async exists(bucket: string, filePath: string): Promise<boolean> {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await this.getClient()
    const key = this.getKey(bucket, filePath)

    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch {
      return false
    }
  }
}

let storageAdapter: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (storageAdapter) return storageAdapter
  
  if (useLocalStorage()) {
    storageAdapter = new LocalStorageAdapter(localStorageRoot)
  } else {
    storageAdapter = new S3StorageAdapter()
  }
  return storageAdapter
}

export function setStorageAdapter(adapter: StorageAdapter) {
  storageAdapter = adapter
}

export const uploadFile = getStorage().upload.bind(getStorage())
export const downloadFile = getStorage().download.bind(getStorage())
export const deleteFile = getStorage().delete.bind(getStorage())
export const getSignedUrl = getStorage().getSignedUrl.bind(getStorage())
export const listFiles = getStorage().list.bind(getStorage())
export const fileExists = getStorage().exists.bind(getStorage())
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
