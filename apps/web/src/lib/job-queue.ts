import { createClient } from 'redis'

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL

let redisClient: ReturnType<typeof createClient> | null = null
let redisConnected = false

export async function getRedisClient() {
  if (!REDIS_URL) {
    throw new Error('REDIS_URL is required for async job processing')
  }
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL })
    redisClient.on('error', (err: Error) => {
      console.error('[JobQueue] Redis error:', err)
      redisConnected = false
    })
    redisClient.on('connect', () => {
      redisConnected = true
    })
    await redisClient.connect()
  }
  return redisClient
}

export function isRedisConnected(): boolean {
  return redisConnected
}

export const JOB_QUEUE_KEY = 'alex:job:queue'
export const JOB_STATUS_PREFIX = 'alex:job:status:'
export const JOB_RESULT_PREFIX = 'alex:job:result:'

export interface JobPayload {
  id: string
  type: 'document_process' | 'document_reprocess'
  documentId: string
  userId: string
  fileName: string
  mimeType: string
  documentType: string
  storageBucket: string
  storagePath: string
  subjectId?: string
  projectId?: string
  notebookId?: string
  retryCount: number
  maxRetries: number
  createdAt: number
}

export interface JobInput {
  type: JobPayload['type']
  documentId: string
  userId: string
  fileName: string
  mimeType: string
  documentType: string
  storageBucket: string
  storagePath: string
  subjectId?: string
  projectId?: string
  notebookId?: string
  maxRetries?: number
}

export async function enqueueJob(job: JobInput): Promise<string> {
  const client = await getRedisClient()
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  const jobPayload: JobPayload = {
    ...job,
    id: jobId,
    retryCount: 0,
    maxRetries: job.maxRetries ?? 3,
    createdAt: Date.now(),
  }

  // Store job status as pending
  await client.set(`${JOB_STATUS_PREFIX}${jobId}`, JSON.stringify({
    status: 'pending',
    jobId,
    documentId: jobPayload.documentId,
    createdAt: jobPayload.createdAt,
  }))

  // Push to queue
  await client.lPush(JOB_QUEUE_KEY, JSON.stringify(jobPayload))

  return jobId
}

/**
 * Internal function to re-enqueue a job with incremented retry count.
 * Used by the worker for retry logic.
 */
export async function reEnqueueJob(job: JobPayload): Promise<string> {
  const client = await getRedisClient()
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  const jobPayload: JobPayload = {
    ...job,
    id: jobId,
    retryCount: job.retryCount + 1,
    createdAt: Date.now(),
  }

  // Store job status as pending
  await client.set(`${JOB_STATUS_PREFIX}${jobId}`, JSON.stringify({
    status: 'pending',
    jobId,
    documentId: jobPayload.documentId,
    createdAt: jobPayload.createdAt,
  }))

  // Push to queue
  await client.lPush(JOB_QUEUE_KEY, JSON.stringify(jobPayload))

  return jobId
}

export async function getJobStatus(jobId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  jobId: string
  documentId?: string
  createdAt?: number
  error?: string
  result?: any
} | null> {
  const client = await getRedisClient()
  const statusData = await client.get(`${JOB_STATUS_PREFIX}${jobId}`)
  if (!statusData) return null
  const status = JSON.parse(statusData)

  const resultData = await client.get(`${JOB_RESULT_PREFIX}${jobId}`)
  if (resultData) {
    return { ...status, ...JSON.parse(resultData) }
  }

  return status
}

export async function setJobStatus(
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data?: { error?: string; result?: any }
) {
  const client = await getRedisClient()
  const existing = await client.get(`${JOB_STATUS_PREFIX}${jobId}`)
  const current = existing ? JSON.parse(existing) : {}

  const update = {
    ...current,
    status,
    updatedAt: Date.now(),
    ...(data?.error ? { error: data.error } : {}),
    ...(data?.result ? { result: data.result } : {}),
  }

  await client.set(`${JOB_STATUS_PREFIX}${jobId}`, JSON.stringify(update))

  if (data?.result) {
    await client.set(`${JOB_RESULT_PREFIX}${jobId}`, JSON.stringify({ result: data.result }))
  }
}

export async function dequeueJob(): Promise<JobPayload | null> {
  const client = await getRedisClient()
  const data = await client.rPop(JOB_QUEUE_KEY)
  if (!data) return null
  return JSON.parse(data) as JobPayload
}

export async function getQueueLength(): Promise<number> {
  const client = await getRedisClient()
  return await client.lLen(JOB_QUEUE_KEY)
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    redisConnected = false
  }
}