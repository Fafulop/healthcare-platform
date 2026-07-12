import type { Metadata } from "next";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "./api/uploadthing/core";
import { SessionProvider } from "./providers/SessionProvider";
import { AgentProvider } from "@/contexts/AgentContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doctor Portal - Healthcare Platform",
  description: "Portal for doctors to manage their profiles and appointments",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Doctor Portal",
  },
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50">
        <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        {/* AgentProvider is state-only and INERT on mount (no fetches) — the
            root also wraps /login and /consent; the panel UI renders inside
            DashboardLayout. Root-level so the conversation survives navigation
            between the sibling route trees (appointments/dashboard). */}
        <SessionProvider>
          <AgentProvider>{children}</AgentProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
