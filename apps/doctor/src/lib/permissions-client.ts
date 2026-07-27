"use client";

/**
 * Client-side permission helpers for secondary users (PR B) and account tiers
 * (TIERS T4). UI COURTESY ONLY — the real boundary is the server-side check at
 * the two auth choke points; this just avoids dead ends in the UI.
 *
 * TWO ceilings, and the UI must tell them APART because they get opposite
 * treatments (01-DISENO §6):
 *   - MEMBER toggles  → HIDE (the owner chose not to grant it; an upsell would
 *     be noise, and naming what is hidden leaks the owner's configuration).
 *   - ACCOUNT tier    → SHOW WITH A LOCK + upgrade CTA (the account could have
 *     it; that is the whole point of a plan).
 */

import { useSession } from "next-auth/react";
import { hasPermission, tierAllows, type PermissionKey } from "@healthcare/database";

export interface ClientPermissions {
  /** true while the session is loading — callers should render nothing gated yet. */
  loading: boolean;
  isOwner: boolean;
  /** Account tier (courtesy copy from the session; the server reads it fresh). */
  tier: string;
  /** Effective access: BOTH ceilings. False for a tier-locked owner too. */
  can: (key: PermissionKey) => boolean;
  /**
   * True when the ONLY thing standing between this user and the feature is the
   * account's plan ⇒ render a lock + upgrade CTA instead of hiding.
   *
   * Deliberately false when the member also lacks the toggle: they would still
   * not get the feature after an upgrade, they cannot buy one, and telling them
   * "upgrade your plan" would both mislead and expose what the owner switched
   * off. Those keep the existing HIDE behaviour.
   */
  lockedByTier: (key: PermissionKey) => boolean;
}

export function usePermissions(): ClientPermissions {
  const { data: session, status } = useSession();

  const loading = status === "loading";
  // Legacy/absent field ⇒ owner (matches server fallback: current sessions
  // minted before PR A have no isOwner and belong to owners).
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner ?? true;
  const permissions = (session?.user as { permissions?: unknown } | undefined)?.permissions ?? null;
  // Absent ⇒ FULL, same fail-open as the server (01-DISENO §3.1): never lock
  // someone out of a paid feature because a field is missing.
  const tier = (session?.user as { tier?: string } | undefined)?.tier ?? "FULL";

  /** What the member's toggles alone allow (owner = everything). */
  const grantedToUser = (key: PermissionKey) => isOwner || hasPermission(permissions, key);

  return {
    loading,
    isOwner,
    tier,
    can: (key: PermissionKey) => tierAllows(tier, key) && grantedToUser(key),
    lockedByTier: (key: PermissionKey) => !tierAllows(tier, key) && grantedToUser(key),
  };
}
