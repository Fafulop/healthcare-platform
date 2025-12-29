import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh",
        pathname: "/f/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/doctors/:path*",
        destination: "/doctores/:path*",
        permanent: true, // 301 redirect for SEO
      },
    ];
  },
};

export default nextConfig;
