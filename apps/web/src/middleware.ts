import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getLocalUserId, LOCAL_AUTH_COOKIE, getAuthCookieOptions } from '@/lib/local-auth'
import { getCsrfToken, validateCsrfToken, CSRF_COOKIE_NAME } from '@/lib/csrf'

export const runtime = 'nodejs'

const PUBLIC_API_ROUTES = [
  '/api/auth/',
  '/api/health',
]

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

export function getAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const appOrigin = getAppOrigin()
  
  // Allow requests with no origin/referer (e.g., server-to-server, health checks)
  if (!origin && !referer) {
    return true
  }
  
  const checkOrigin = origin || referer
  if (!checkOrigin) return true
  
  try {
    const originUrl = new URL(checkOrigin)
    const appUrl = new URL(appOrigin)
    
    // Allow same origin
    if (originUrl.origin === appUrl.origin) {
      return true
    }
    
    // Allow Cloudflare proxy origins (Cloudflare adds cf-connecting-ip, etc.)
    // Check if the origin is a known Cloudflare domain for this app
    if (originUrl.hostname.endsWith('.cloudflareaccess.com') || 
        originUrl.hostname.endsWith('.pages.dev') ||
        originUrl.hostname.endsWith('.web.app')) {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  const isProduction = process.env.NODE_ENV === 'production'
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://integrate.api.nvidia.com https://api.anthropic.com https://api.mistral.ai https://api.groq.com https://openrouter.ai https://api.together.xyz wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  
  if (!isProduction) {
    cspDirectives[1] = "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
  }
  
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))
  return response
}

function cloneRequestUrl(nextUrl: NextRequest['nextUrl'] | URL): URL {
  if (typeof (nextUrl as NextRequest['nextUrl']).clone === 'function') {
    return (nextUrl as NextRequest['nextUrl']).clone()
  }
  return new URL(nextUrl.toString())
}

function getRequestHeaders(request: NextRequest): { get: (name: string) => string | null } {
  return {
    get: (name: string) => request.headers.get(name)
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  
  const sessionCookie = request.cookies.get(LOCAL_AUTH_COOKIE)?.value
  const userId = getLocalUserId(sessionCookie)
  const isAuthenticated = !!userId

  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/")

  const isPublicPage =
    pathname === '/' ||
    pathname.startsWith('/roadmap') ||
    isAuthPage
  const isApiRoute = pathname.startsWith("/api/")

  // Redirect unauthenticated users from protected pages
  if (!isApiRoute && !isPublicPage && !isAuthenticated) {
    const url = cloneRequestUrl(request.nextUrl)
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  // Redirect authenticated users from auth pages
  if (isAuthPage && isAuthenticated) {
    const url = cloneRequestUrl(request.nextUrl)
    url.pathname = "/dashboard"
    return addSecurityHeaders(NextResponse.redirect(url))
  }

  // Protect API routes
  if (isApiRoute && !isPublicApiRoute(pathname) && !isAuthenticated) {
    return addSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  // CSRF protection for state-changing API requests
  if (isApiRoute && isAuthenticated && STATE_CHANGING_METHODS.includes(request.method)) {
    if (!validateOrigin(request)) {
      return addSecurityHeaders(NextResponse.json({ error: "Invalid origin" }, { status: 403 }))
    }

    // Skip CSRF for auth and health endpoints
    if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/health')) {
      return addSecurityHeaders(response)
    }

    const csrfToken = request.headers.get('x-csrf-token') || request.cookies.get(CSRF_COOKIE_NAME)?.value
    if (!csrfToken || !validateCsrfToken(csrfToken, userId)) {
      return addSecurityHeaders(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }))
    }
  }

  // Set CSRF cookie for authenticated API requests
  if (isApiRoute && isAuthenticated && !request.cookies.get(CSRF_COOKIE_NAME)) {
    const newToken = getCsrfToken(userId)
    const cookieOptions = getAuthCookieOptions({ headers: { get: (name: string) => request.headers.get(name) } })
    response.cookies.set(CSRF_COOKIE_NAME, newToken, cookieOptions)
  }

  // Set CORS headers for API routes
  if (isApiRoute) {
    const origin = request.headers.get('origin')
    const appOrigin = getAppOrigin()
    
    if (origin) {
      try {
        const originUrl = new URL(origin)
        const appUrl = new URL(appOrigin)
        
        // Allow same origin or Cloudflare proxy origins
        if (originUrl.origin === appUrl.origin || 
            originUrl.hostname.endsWith('.cloudflareaccess.com') || 
            originUrl.hostname.endsWith('.pages.dev') ||
            originUrl.hostname.endsWith('.web.app')) {
          response.headers.set('Access-Control-Allow-Origin', origin)
          response.headers.set('Access-Control-Allow-Credentials', 'true')
          response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
          response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Content-Type, Authorization')
        }
      } catch {
        // Invalid origin, don't set CORS headers
      }
    }
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
  }

  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}