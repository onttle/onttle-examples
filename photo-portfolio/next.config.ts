import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

// No `images` config: photos are plain <img srcset> built from Onttle's thumbnails, not next/image.
// Onttle does the resizing, and its signed URLs expire, so they must not be stored in an image cache.
const nextConfig: NextConfig = {
  basePath: BASE_PATH,
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
