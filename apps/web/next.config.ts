import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  cacheComponents: false,
  partialPrefetching: false,
<<<<<<< HEAD
  typescript: {
    // Ignore build errors caused by pre-existing TypeScript stack overflow
    // in complex Prisma types (TypeScript 5.9.3 + Prisma 5.22)
    // See: https://github.com/prisma/prisma/issues/25000
    ignoreBuildErrors: true,
  },
  // The dashboard shell historically linked to feature URLs under
  // `/dashboard/*`, while the App Router feature pages live at the root
  // (`/assistant`, `/documents`, etc.) inside the dashboard route group.
  // Use `:path+` (one or more segments) so `/dashboard` itself routes to
  // `(dashboard)/dashboard/page.tsx` instead of rewriting to `/`.
  async rewrites() {
    return [{
      source: "/dashboard/:path+",
      destination: "/:path+",
=======
  // The dashboard shell historically linked to feature URLs under
  // `/dashboard/*`, while the App Router feature pages live at the root
  // (`/assistant`, `/documents`, etc.) inside the dashboard route group.
  // Keep the public links stable by internally mapping those URLs.
  async rewrites() {
    return [{
      source: "/dashboard/:path*",
      destination: "/:path*",
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
