import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lot documents (up to 4 MB) are uploaded through a server action; Vercel
  // caps a request at 4.5 MB.
  experimental: {
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
