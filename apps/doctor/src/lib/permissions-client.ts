"use client";

/**
 * Client-side permission helpers for secondary users (PR B). UI COURTESY ONLY —
 * the real boundary is the server-side check at the two auth choke points; this
 * just hides what the member can't use anyway.
 */

import { useSession } from "next-auth/react";
import { hasPermission, type PermissionKey } from "@healthcare/database";

export interface ClientPermissions {
  /** true while the session is loading — callers should render nothing gated yet. */
  loading: boolean;
  isOwner: boolean;
  can: (key: PermissionKey) => boolean;
}

export function usePermissions(): ClientPermissions {
  const { data: session, status } = useSession();

  const loading = status === "loading";
  // Legacy/absent field ⇒ owner (matches server fallback: current sessions
  // minted before PR A have no isOwner and belong to owners).
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner ?? true;
  const permissions = (session?.user as { permissions?: unknown } | undefined)?.permissions ?? null;

  return {
    loading,
    isOwner,
    can: (key: PermissionKey) => isOwner || hasPermission(permissions, key),
  };
}
