import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API-only app, no pages or UI
  reactStrictMode: true,
  // Disable x-powered-by header for security
  poweredByHeader: false,
};

export default nextConfig;
