import { decrypt, encrypt } from '@/lib/encryption'

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

const DROPBOX_SCOPES = 'files.content.read files.metadata.read'

function resolveRedirectUri() {
  const explicit = process.env.DROPBOX_REDIRECT_URI?.trim()
  if (explicit) return explicit

  const candidates = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL]

  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue

    try {
      return new URL('/api/storage/dropbox/callback', trimmed).toString()
    } catch {
      continue
    }
  }

  throw new Error('Dropbox redirect URI is not configured. Set DROPBOX_REDIRECT_URI or NEXT_PUBLIC_APP_URL.')
}

function config() {
  const appKey = process.env.DROPBOX_APP_KEY?.trim()
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim()

  if (!appKey || !appSecret) {
    throw new Error('Dropbox integration is not configured. Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET.')
  }

  return { appKey, appSecret }
}

async function safeDecrypt(value?: string | null): Promise<string> {
  if (!value) return ''

  try {
    return await decrypt(value)
  } catch {
    return value
  }
}

export function getDropboxAuthorizeUrl(state: string) {
  const { appKey } = config()
  const redirectUri = resolveRedirectUri()

  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
    scope: DROPBOX_SCOPES,
  })

  return `https://www.dropbox.com/oauth2/authorize?${params}`
}

export async function exchangeDropboxCode(code: string) {
  const { appKey, appSecret } = config()
  const redirectUri = resolveRedirectUri()
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    client_secret: appSecret,
    redirect_uri: redirectUri,
  })

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const message = await response.text().catch(() => 'Dropbox authorization failed')
    throw new Error(message || 'Dropbox authorization failed')
  }

  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}

export async function refreshDropboxToken(refreshToken: string) {
  const { appKey, appSecret } = config()
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: appKey,
    client_secret: appSecret,
  })

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error('Dropbox token refresh failed')
  }

  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
}

export async function dropboxRpc<T>(token: string, endpoint: string, input: unknown): Promise<T> {
  const response = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Dropbox request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function dropboxUpload(token: string, path: string, body: Buffer, contentType: string) {
  const response = await fetch(`${CONTENT}/files/upload`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
      'content-length': String(body.length),
    },
    body: body as unknown as BodyInit,
  })

  if (!response.ok) {
    throw new Error(`Dropbox upload failed: ${response.status}`)
  }

  return response.json()
}

export async function getDropboxToken(encryptedAccessToken: string, encryptedRefreshToken?: string | null, expiresAt?: Date | null) {
  const accessToken = await safeDecrypt(encryptedAccessToken)

  if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
    return { accessToken, refreshed: false, expiresAt }
  }

  const refreshToken = encryptedRefreshToken ? await safeDecrypt(encryptedRefreshToken) : null
  if (!refreshToken) {
    return { accessToken, refreshed: false, expiresAt }
  }

  const refreshed = await refreshDropboxToken(refreshToken)
  const nextExpiresAt = new Date(Date.now() + (refreshed.expires_in || 14_400) * 1000)

  return {
    accessToken: refreshed.access_token,
    refreshed: true,
    expiresAt: nextExpiresAt,
    encryptedAccessToken: await encrypt(refreshed.access_token),
    encryptedRefreshToken: refreshed.refresh_token ? await encrypt(refreshed.refresh_token) : encryptedRefreshToken,
  }
}

export async function dropboxDownload(token: string, path: string): Promise<Buffer> {
  const response = await fetch(`${CONTENT}/files/download`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  })

  if (!response.ok) {
    throw new Error(`Dropbox download failed: ${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}
