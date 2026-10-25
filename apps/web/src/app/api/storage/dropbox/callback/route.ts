import { prisma } from '@/lib/prisma'
import { exchangeDropboxCode, dropboxRpc } from '@/lib/dropbox'
import { encrypt } from '@/lib/encryption'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = request.cookies.get('dropbox_oauth_state')?.value
  if (!code || !state || !expected || state !== expected) return NextResponse.json({ error: 'Invalid Dropbox authorization state' }, { status: 400 })
  const userId = state.split('.')[0]
  try {
    const tokens = await exchangeDropboxCode(code)
    const account = await dropboxRpc<{ email?: string; name?: { display_name?: string } }>(tokens.access_token, 'users/get_current_account', {})
    await prisma.dropboxConnection.upsert({
      where: { userId },
      create: { userId, accountEmail: account.email, accountName: account.name?.display_name, accessToken: await encrypt(tokens.access_token), refreshToken: tokens.refresh_token ? await encrypt(tokens.refresh_token) : null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null },
      update: { accountEmail: account.email, accountName: account.name?.display_name, accessToken: await encrypt(tokens.access_token), refreshToken: tokens.refresh_token ? await encrypt(tokens.refresh_token) : undefined, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null },
    })
    const response = NextResponse.redirect(new URL('/settings?tab=storage&dropbox=connected', request.url))
    response.cookies.delete('dropbox_oauth_state')
    return response
  } catch (error) {
    return NextResponse.redirect(new URL(`/settings?tab=storage&dropbox=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'connection failed')}`, request.url))
  }
}
