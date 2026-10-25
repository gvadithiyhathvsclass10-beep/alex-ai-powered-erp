import { requireAuth } from '@/lib/auth'
import { getDropboxAuthorizeUrl } from '@/lib/dropbox'
import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()
    const state = `${user.id}.${randomBytes(24).toString('hex')}`
    const response = NextResponse.redirect(getDropboxAuthorizeUrl(state))
    response.cookies.set('dropbox_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' })
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dropbox is not configured' }, { status: 503 })
  }
}
