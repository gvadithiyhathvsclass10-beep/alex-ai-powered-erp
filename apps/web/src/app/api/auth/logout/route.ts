<<<<<<< HEAD
import { NextResponse } from 'next/server'
import { LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

export async function GET(request: Request) {
  const baseUrl = request.url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = NextResponse.redirect(new URL('/login', baseUrl))
  response.cookies.set(LOCAL_AUTH_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
=======
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  response.cookies.set(LOCAL_AUTH_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}