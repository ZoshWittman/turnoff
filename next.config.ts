import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.3 + Vercel's deploy adapter skips next-server.js.nft.json when
  // standalone is set (vercel/next.js#96646). Keep standalone for Docker only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  serverExternalPackages: [
    "@mintplex-labs/piper-tts-web",
    "onnxruntime-web",
    "onnxruntime-node",
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
      };
    }
    return config;
  },
};

export default nextConfig;
