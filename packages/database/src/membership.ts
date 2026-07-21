/**
 * Effective-access resolution: which doctor does this user act on, and with
 * which permissions. THE narrow waist of the secondary-users feature — the two
 * auth choke points (NextAuth session() callback and apps/api
 * validateAuthToken) resolve through here and nothing else does.
 *
 * Fail-direction rule (02-METODO §2.9): resolution trouble for an OWNER fails
 * OPEN to their own data (legacy users.doctor_id fallback — otherwise a missed
 * backfill row logs a doctor out of their portal); anything ambiguous for a
 * MEMBER fails CLOSED (no doctor resolved).
 *
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §3
 */

import type { PrismaClient } from '@prisma/client';
import type { PermissionSet } from './permissions';

export interface EffectiveAccess {
  /** Doctor the user acts on (ACTIVE membership first, legacy users.doctor_id fallback). */
  doctorId: string | null;
  /** true for OWNER memberships and for the legacy-column fallback. */
  isOwner: boolean;
  /** null for owners (= everything). For members: the stored toggle set (fail-closed reads via hasPermission). */
  permissions: PermissionSet | null;
  /** No ACTIVE membership but a REVOKED one exists → "acceso revocado" screen, never doctor onboarding. */
  membershipRevoked: boolean;
}

export const NO_ACCESS: EffectiveAccess = {
  doctorId: null,
  isOwner: false,
  permissions: null,
  membershipRevoked: false,
};

interface MembershipRow {
  doctorId: string;
  role: string;
  status: string;
  permissions: unknown;
}

/**
 * Pure computation over already-loaded membership rows — lets
 * validateAuthToken keep its single user query (include memberships) while the
 * session() callback uses the querying wrapper below.
 */
export function computeEffectiveAccess(
  memberships: MembershipRow[],
  legacyDoctorId: string | null | undefined
): EffectiveAccess {
  const active = memberships.find((m) => m.status === 'ACTIVE');

  if (active) {
    const isOwner = active.role === 'OWNER';
    return {
      doctorId: active.doctorId,
      isOwner,
      // OWNER permissions are ignored by design (owner has everything);
      // member sets default to {} (deny-all) if the column is malformed.
      permissions: isOwner
        ? null
        : ((active.permissions ?? {}) as PermissionSet),
      membershipRevoked: false,
    };
  }

  // Owner fail-OPEN fallback: a linked doctor user without a (backfilled)
  // membership row still resolves to their own portal.
  if (legacyDoctorId) {
    return {
      doctorId: legacyDoctorId,
      isOwner: true,
      permissions: null,
      membershipRevoked: false,
    };
  }

  const revoked = memberships.some((m) => m.status === 'REVOKED');
  return { ...NO_ACCESS, membershipRevoked: revoked };
}

/** Query + compute in one call (used by the session() callback: one indexed
 * lookup per request — doctor_members(user_id) partial unique index). */
export async function resolveEffectiveAccess(
  prisma: PrismaClient,
  userId: string,
  legacyDoctorId: string | null | undefined
): Promise<EffectiveAccess> {
  try {
    const memberships = await prisma.doctorMember.findMany({
      where: { userId },
      select: { doctorId: true, role: true, status: true, permissions: true },
    });
    return computeEffectiveAccess(memberships, legacyDoctorId);
  } catch (error) {
    // Table missing / transient DB error: owners fail OPEN to their legacy
    // link (never lock every doctor out); users without one fail CLOSED.
    console.error('[membership] resolveEffectiveAccess failed:', error);
    return computeEffectiveAccess([], legacyDoctorId);
  }
}
