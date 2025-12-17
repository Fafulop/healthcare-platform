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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
