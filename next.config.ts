import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.3 + Vercel's deploy adapter skips next-server.js.nft.json when
  // standalone is set (vercel/next.js#96646). Keep standalone for Docker only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  serverExternalPackages: [
    "kokoro-js",
    "@huggingface/transformers",
    "onnxruntime-node",
    "onnxruntime-web",
    "sharp",
  ],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
