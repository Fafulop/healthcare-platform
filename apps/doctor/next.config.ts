import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pdfjs-dist NO se empaqueta: carga su "fake worker" con un `import()` dinámico
  // de `pdf.worker.mjs` que el bundler no resuelve. Sin esto funciona con tsx en
  // local y truena con `Cannot find module` en la ruta desplegada.
  // Lo usa src/lib/informe-medico/add-fields.ts (alta de un formato plano).
  serverExternalPackages: ["pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/appointments/:path*",
        destination: "/dashboard/appointments/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
