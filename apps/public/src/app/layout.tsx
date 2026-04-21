import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Suspense } from "react";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

export const metadata: Metadata = {
  metadataBase: new URL('https://tusalud.pro'),
  title: {
    default: 'TuSalud.pro | Encuentra tu Doctor en México',
    template: '%s | TuSalud.pro',
  },
  description: 'Encuentra y agenda citas con médicos especialistas en México. Consulta perfiles, servicios, opiniones de pacientes y ubicación de consultorio.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Preconnect to critical origins (max 4 — more than that hurts performance) */}
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
      <body className="antialiased" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif', paddingBottom: '3rem' }}>
        {/* Google Analytics 4 */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  send_page_view: true
                });
                ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
              `}
            </Script>
          </>
        )}

        {/* Track route changes */}
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>

        {children}

        {/* <CookieBanner /> — disabled, re-enable by importing CookieBanner from "@/components/CookieBanner" */}

        <footer style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
            © {new Date().getFullYear()} tusalud.pro &nbsp;·&nbsp;{" "}
            <Link href="/privacidad" style={{ color: '#6b7280', textDecoration: 'underline' }}>Aviso de Privacidad</Link>
            &nbsp;·&nbsp;{" "}
            <Link href="/terminos" style={{ color: '#6b7280', textDecoration: 'underline' }}>Términos de Servicio</Link>
            &nbsp;·&nbsp;{" "}
            <Link href="/eliminacion-de-datos" style={{ color: '#6b7280', textDecoration: 'underline' }}>Eliminación de Datos</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
