import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  response.cookies.set(LOCAL_AUTH_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}