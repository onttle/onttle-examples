import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served under example.onttle.com/blog (the gateway proxies /blog/* to this app)
  basePath: "/blog",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Allow only the s3_path domain returned by the Onttle files API
    remotePatterns: [{ protocol: "https", hostname: "file.onttle.com" }],
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
