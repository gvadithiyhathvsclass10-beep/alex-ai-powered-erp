import { prisma } from '@/lib/prisma'
import { exchangeDropboxCode, dropboxRpc } from '@/lib/dropbox'
import { encrypt } from '@/lib/encryption'
import { NextRequest, NextResponse } from 'next/server'

function getPublicOrigin(): string {
  // Use configured public origin; never trust request.url in production
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit
  const fallback = process.env.NEXTAUTH_URL?.trim()
  if (fallback) return fallback
  // Development fallback only
  return 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = request.cookies.get('dropbox_oauth_state')?.value
  if (!code || !state || !expected || state !== expected) return NextResponse.json({ error: 'Invalid Dropbox authorization state' }, { status: 400 })
  
  const stateParts = state.split('.')
  if (stateParts.length < 2) return NextResponse.json({ error: 'Invalid Dropbox authorization state' }, { status: 400 })
  const userId = stateParts[0]
  
  const publicOrigin = getPublicOrigin()
  
  try {
    const tokens = await exchangeDropboxCode(code)
    const account = await dropboxRpc<{ email?: string; name?: { display_name?: string } }>(tokens.access_token, 'users/get_current_account', {})
    
    // Verify the connected account email matches the expected user (additional security)
    // Note: In a production app, you might want to verify the user is authenticated here
    // For now we trust the state parameter which was set by the authenticated user
    
    await prisma.dropboxConnection.upsert({
      where: { userId },
      create: { userId, accountEmail: account.email, accountName: account.name?.display_name, accessToken: await encrypt(tokens.access_token), refreshToken: tokens.refresh_token ? await encrypt(tokens.refresh_token) : null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null },
      update: { accountEmail: account.email, accountName: account.name?.display_name, accessToken: await encrypt(tokens.access_token), refreshToken: tokens.refresh_token ? await encrypt(tokens.refresh_token) : null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null },
    })
    const response = NextResponse.redirect(new URL('/dashboard/drive?dropbox=connected', publicOrigin))
    response.cookies.delete('dropbox_oauth_state')
    return response
  } catch (error) {
    // Log server-side for diagnostics without exposing secrets
    console.error('[Dropbox callback] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.redirect(new URL(`/dashboard/drive?dropbox=error&message=${encodeURIComponent('Dropbox connection failed. Please try again.')}`, publicOrigin))
  }
}
