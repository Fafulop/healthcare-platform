import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doctor Profile | Medical Services",
  description: "Find and book appointments with qualified medical professionals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Preconnect to critical origins - reduces LCP by establishing connections early */}
        <link rel="preconnect" href="https://healthcareapi-production-fb70.up.railway.app" />
        <link rel="preconnect" href="https://utfs.io" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Preload critical fonts - improves FCP */}
        <link
          rel="preload"
          href="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://fonts.gstatic.com/s/vollkorn/v22/0yb9GDoxxrvAnPhYGxksckM2WMCpRjDj-DJGWmmZqQ.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Vollkorn:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
