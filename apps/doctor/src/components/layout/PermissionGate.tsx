"use client";

/**
 * Page-level gate for secondary users (PR B). Maps the current dashboard
 * pathname to its toggle (shared PAGE_PERMISSION_MAP) and replaces the page
 * with a "sin acceso" screen when the member lacks it. UI courtesy — the
 * API-side check is the real boundary; this just avoids a page of dead 403s
 * when a member navigates by URL.
 */

import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { pagePermissionKey } from "@healthcare/database";
import { usePermissions } from "@/lib/permissions-client";

export default function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, isOwner, can } = usePermissions();

  // Owners (and while loading — owner is the default) render everything.
  if (loading || isOwner) return <>{children}</>;

  const key = pagePermissionKey(pathname ?? "");
  if (!key || can(key)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <ShieldOff className="w-7 h-7 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Sin acceso a esta sección
      </h2>
      <p className="text-sm text-gray-500 max-w-sm">
        El dueño de la cuenta no te ha dado acceso a esta sección. Si crees que
        es un error, pídele que lo active en su panel de Equipo.
      </p>
    </div>
  );
}
