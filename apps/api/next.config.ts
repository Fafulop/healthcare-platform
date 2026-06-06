import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API-only app, no pages or UI
  reactStrictMode: true,
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Keep native Node.js modules out of webpack bundling
  // pdfkit uses fs.readFileSync for built-in fonts; exceljs also uses native modules
  serverExternalPackages: ['pdfkit', 'exceljs'],
};

export default nextConfig;
