import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.3 + Vercel's deploy adapter skips next-server.js.nft.json when
  // standalone is set (vercel/next.js#96646). Keep standalone for Docker only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
};

export default nextConfig;
