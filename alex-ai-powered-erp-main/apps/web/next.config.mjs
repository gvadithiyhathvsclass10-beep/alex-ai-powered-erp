const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  cacheComponents: false,
  partialPrefetching: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/dashboard/:path+",
        destination: "/:path+",
      },
    ];
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
