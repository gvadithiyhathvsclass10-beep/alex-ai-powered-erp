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