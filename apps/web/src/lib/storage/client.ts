import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile, unlink, readdir } from 'node:fs/promises'
import path from 'node:path'

const localStorageRoot = path.join(process.cwd(), 'storage')
const useLocalStorage = () => (process.env.STORAGE_MODE || 'local') === 'local'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const storageClient = createClient(supabaseUrl, supabaseKey)

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean }
) {
  if (useLocalStorage()) { const target = pathModule(localStorageRoot, bucket, path); await mkdir(pathModule(localStorageRoot, bucket), { recursive: true }); await writeFile(target, Buffer.from(await file.arrayBuffer())); return { path: `${bucket}/${path}` } as any }
  const { data, error } = await storageClient.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options?.contentType,
      upsert: options?.upsert ?? false,
    })

  if (error) throw error
  return data
}

export async function downloadFile(bucket: string, path: string) {
  if (useLocalStorage()) return new Blob([await readFile(pathModule(localStorageRoot, bucket, path))])
  const { data, error } = await storageClient.storage.from(bucket).download(path)
  if (error) throw error
  return data
}

export async function deleteFile(bucket: string, paths: string[]) {
  if (useLocalStorage()) { await Promise.all(paths.map(p => unlink(pathModule(localStorageRoot, bucket, p)).catch(() => undefined))); return [] as any }
  const { data, error } = await storageClient.storage.from(bucket).remove(paths)
  if (error) throw error
  return data
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  if (useLocalStorage()) return `/api/documents/local/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
  const { data, error } = await storageClient.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function listFiles(bucket: string, folder: string) {
  if (useLocalStorage()) return (await readdir(pathModule(localStorageRoot, bucket, folder), { withFileTypes: true })).map(entry => ({ name: entry.name })) as any
  const { data, error } = await storageClient.storage.from(bucket).list(folder)
  if (error) throw error
  return data
}

export function getPublicUrl(bucket: string, path: string) {
  if (useLocalStorage()) return `/api/documents/local/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
  const { data } = storageClient.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

function pathModule(...parts: string[]) { return path.resolve(...parts) }
