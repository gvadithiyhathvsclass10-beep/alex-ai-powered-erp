import { NextResponse } from 'next/server'
import { LOCAL_AUTH_COOKIE, getAuthCookieOptions } from '@/lib/local-auth'

export async function GET(request: Request) {
  const baseUrl = request.url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = NextResponse.redirect(new URL('/login', baseUrl))
  const cookieOptions = getAuthCookieOptions({ headers: { get: (name: string) => request.headers.get(name) } })
  response.cookies.set(LOCAL_AUTH_COOKIE, '', { ...cookieOptions, maxAge: 0 })
  return response
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true })
  const cookieOptions = getAuthCookieOptions({ headers: { get: (name: string) => request.headers.get(name) } })
  response.cookies.set(LOCAL_AUTH_COOKIE, '', { ...cookieOptions, maxAge: 0 })
  return response
}