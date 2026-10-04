import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure API routes with dynamic content are not cached
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
