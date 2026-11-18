import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // example.onttle.com/blog 아래에서 서비스 (게이트웨이가 /blog/* 를 이 앱으로 프록시)
  basePath: "/blog",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Onttle 파일 API가 돌려주는 s3_path 도메인만 허용
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
