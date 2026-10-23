<<<<<<< HEAD
export { middleware, config, isPublicApiRoute, addSecurityHeaders } from '@/middleware'
=======
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getLocalUserId, LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

const PUBLIC_API_ROUTES = [
  '/api/auth/',
  '/api/health',
]

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://integrate.api.nvidia.com https://api.anthropic.com https://api.mistral.ai wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return response
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  
  const sessionCookie = request.cookies.get(LOCAL_AUTH_COOKIE)?.value
  const userId = getLocalUserId(sessionCookie)
  const isAuthenticated = !!userId

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/auth/")

  const isDashboardPage = request.nextUrl.pathname.startsWith("/dashboard")
  const isPublicPage = request.nextUrl.pathname === '/' || isAuthPage
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/")

  if (!isApiRoute && !isPublicPage && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  if (isAuthPage && isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  if (isApiRoute && !isPublicApiRoute(request.nextUrl.pathname) && !isAuthenticated) {
    return addSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
