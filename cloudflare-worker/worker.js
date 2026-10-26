/**
 * ALEX Cloudflare Worker - Reverse Proxy to Render Backend
 *
 * This worker forwards all requests to the Render backend service.
 * It handles CORS, header forwarding, and proper error responses.
 *
 * Deploy with: wrangler deploy --config wrangler.toml
 */

const RENDER_API_URL = "https://alex-web.onrender.com"; // UPDATE: Set via wrangler secret or vars

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-CSRF-Token",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

function handleCors(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  return null;
}

function buildTargetUrl(request) {
  const incomingUrl = new URL(request.url);
  // Remove the worker's domain prefix, keep the path and query
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, RENDER_API_URL);
  return targetUrl;
}

function forwardHeaders(request) {
  const headers = new Headers(request.headers);
  const incomingUrl = new URL(request.url);

  // Forward original host for proper redirect handling
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");

  // Remove headers that should not be forwarded
  headers.delete("host");
  headers.delete("connection");
  headers.delete("upgrade");
  headers.delete("cf-ray");
  headers.delete("cf-ipcountry");
  headers.delete("cf-connecting-ip");

  return headers;
}

export default {
  async fetch(request, env, ctx) {
    // Allow overriding the target URL via environment variable
    const targetBase = env.RENDER_API_URL || RENDER_API_URL;

    // Handle CORS preflight
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    // Skip proxying for worker health check
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname === "/__health") {
      return new Response(JSON.stringify({ status: "ok", target: targetBase }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const targetUrl = new URL(url.pathname + url.search, targetBase);
    const headers = forwardHeaders(request);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
        cf: {
          // Cache static assets at Cloudflare edge
          cacheTtl: url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/static/")
            ? 31536000
            : 0,
          cacheEverything: false,
        },
      });

      // Build response with CORS headers
      const responseHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      // Handle redirects properly
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = responseHeaders.get("location");
        if (location) {
          // Rewrite location to point to worker domain if it points to render
          const locationUrl = new URL(location, targetBase);
          if (locationUrl.hostname === new URL(targetBase).hostname) {
            locationUrl.hostname = url.hostname;
            locationUrl.protocol = url.protocol;
            responseHeaders.set("location", locationUrl.toString());
          }
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("[Worker] Proxy error:", error);

      return new Response(
        JSON.stringify({
          error: "Bad Gateway",
          message: "Failed to reach backend service",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
  },
};