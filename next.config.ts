import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js cannot infer these runtime file paths because the analysis route
  // resolves them dynamically. Keep the bundled mock/test catalog available
  // on Vercel, while excluding local job state from every server function.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/next/dist/lib/framework/*.js"],
    "/api/analysis-jobs": ["./测试视频/*.mp4", "./prompts/*.txt"],
  },
  outputFileTracingExcludes: {
    "/*": ["./tmp/**/*", "./work/**/*", "./outputs/**/*"],
  },
};

export default nextConfig;
