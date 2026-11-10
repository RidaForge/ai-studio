import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep a running dev server's HMR/client-reference manifests separate from production builds.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
