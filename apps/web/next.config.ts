import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  cacheComponents: false,
  partialPrefetching: false,
  // The dashboard shell historically linked to feature URLs under
  // `/dashboard/*`, while the App Router feature pages live at the root
  // (`/assistant`, `/documents`, etc.) inside the dashboard route group.
  // Keep the public links stable by internally mapping those URLs.
  async rewrites() {
    return [{
      source: "/dashboard/:path*",
      destination: "/:path*",
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
