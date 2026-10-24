/**
 * Cloudflare Worker - Frontend Proxy for ALEX
 * 
 * This worker proxies requests from Cloudflare Pages (frontend) to Render (backend API).
 * It handles CORS, adds security headers, and forwards the correct origin.
 * 
 * Deploy with: wrangler deploy --config wrangler.toml
 * Configure RENDER_API_URL in wrangler.toml vars or Cloudflare dashboard.
 */

// Default fallback - will be overridden by environment variable
const DEFAULT_RENDER_API_URL = 'https://alex-api.onrender.com'

export default {
  async fetch(request, env) {
    const RENDER_API_URL = env.RENDER_API_URL || DEFAULT_RENDER_API_URL
    
    const incoming = new URL(request.url)
    const target = new URL(incoming.pathname + incoming.search, RENDER_API_URL)
    
    const headers = new Headers(request.headers)
    
    // Forward original host and protocol for backend to generate correct URLs
    headers.set('x-forwarded-host', incoming.host)
    headers.set('x-forwarded-proto', 'https')
    headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '')
    
    // Remove headers that shouldn't be forwarded
    headers.delete('host')
    headers.delete('content-length')
    
    // Handle preflight CORS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': incoming.origin || '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        }
      })
    }
    
    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      })
      
      // Create new response with CORS headers
      const responseHeaders = new Headers(response.headers)
      responseHeaders.set('Access-Control-Allow-Origin', incoming.origin || '*')
      responseHeaders.set('Access-Control-Allow-Credentials', 'true')
      responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      responseHeaders.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Content-Type, Authorization')
      
      // Security headers
      responseHeaders.set('X-Content-Type-Options', 'nosniff')
      responseHeaders.set('X-Frame-Options', 'DENY')
      responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch (error) {
      console.error('[Cloudflare Worker] Proxy error:', error)
      return new Response(JSON.stringify({ error: 'Backend unavailable' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': incoming.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      })
    }
  },
}
