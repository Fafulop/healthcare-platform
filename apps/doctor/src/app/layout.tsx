import type { Metadata } from "next";
import { SessionProvider } from "./providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doctor Portal - Healthcare Platform",
  description: "Portal for doctors to manage their profiles and appointments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
