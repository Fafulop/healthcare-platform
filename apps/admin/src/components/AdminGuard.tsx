"use client";

import { useSession } from "next-auth/react";
import { usePathname, redirect } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const PUBLIC_PATHS = ["/login"];

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      redirect("/login");
    }
  }, [status, session?.user?.role]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") return null;

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;
  return <AdminProtected>{children}</AdminProtected>;
}
