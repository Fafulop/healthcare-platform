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
import { DEFAULT_TIER, tierAllows, type PermissionKey, type PermissionSet } from './permissions';

export interface EffectiveAccess {
  /** Doctor the user acts on (ACTIVE membership first, legacy users.doctor_id fallback). */
  doctorId: string | null;
  /** true for OWNER memberships and for the legacy-column fallback. */
  isOwner: boolean;
  /** null for owners (= everything). For members: the stored toggle set (fail-closed reads via hasPermission). */
  permissions: PermissionSet | null;
  /** No ACTIVE membership but a REVOKED one exists → "acceso revocado" screen, never doctor onboarding. */
  membershipRevoked: boolean;
  /** TIER de la CUENTA (Doctor.tier) del doctor resuelto, leído FRESCO de la BD
   * (G4). Techo de funciones sobre owner Y member — ver tierAllows / TIERS
   * 01-DISENO §2. Default FULL (fail-open) si no hay doctor o el dato falta.
   * Es `string` CRUDO (no la unión DoctorTier) a propósito: un tier futuro
   * (String column, sin migración) debe fluir sin tocar este archivo; tierAllows
   * ya hace fail-open ante un valor que no reconoce. */
  tier: string;
}

export const NO_ACCESS: EffectiveAccess = {
  doctorId: null,
  isOwner: false,
  permissions: null,
  membershipRevoked: false,
  tier: DEFAULT_TIER,
};

interface MembershipRow {
  doctorId: string;
  role: string;
  status: string;
  permissions: unknown;
  /** Doctor.tier via la relación `doctor` del membership (incluir en el select). */
  doctor?: { tier?: string | null } | null;
}

/**
 * Pure computation over already-loaded membership rows — lets
 * validateAuthToken keep its single user query (include memberships) while the
 * session() callback uses the querying wrapper below.
 */
export function computeEffectiveAccess(
  memberships: MembershipRow[],
  legacyDoctorId: string | null | undefined,
  /** Doctor.tier del legacy link (users.doctor_id) — solo se usa en el fallback
   * owner. El tier del path de membership sale de active.doctor.tier. */
  legacyTier?: string | null
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
      // Crudo de la BD; falsy (null/''/undefined) ⇒ DEFAULT_TIER (fail-open).
      tier: active.doctor?.tier || DEFAULT_TIER,
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
      tier: legacyTier || DEFAULT_TIER,
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
      // doctor.tier: techo del tier leído FRESCO (G4) en la misma query.
      select: {
        doctorId: true,
        role: true,
        status: true,
        permissions: true,
        doctor: { select: { tier: true } },
      },
    });
    // Legacy owner path (no membership row): su tier vive en users.doctor_id →
    // Doctor.tier. Solo se consulta si hará falta el fallback (sin ACTIVE).
    const legacyTier =
      legacyDoctorId && !memberships.some((m) => m.status === 'ACTIVE')
        ? (await prisma.doctor.findUnique({ where: { id: legacyDoctorId }, select: { tier: true } }))?.tier
        : undefined;
    return computeEffectiveAccess(memberships, legacyDoctorId, legacyTier);
  } catch (error) {
    // Table missing / transient DB error: owners fail OPEN to their legacy
    // link (never lock every doctor out); users without one fail CLOSED.
    console.error('[membership] resolveEffectiveAccess failed:', error);
    return computeEffectiveAccess([], legacyDoctorId);
  }
}

/**
 * Techo del tier para un doctorId, consultado directo — el TERCER sitio de
 * enforcement (01-DISENO §5.3, hueco G3): flujos PÚBLICOS (fiscal-form) y de
 * FONDO (worker SAT) que NO pasan por los dos choke points de auth. Fail-open a
 * FULL ante doctor ausente o error de BD (no bloquear por dato faltante).
 */
export async function doctorTierAllows(
  prisma: PrismaClient,
  doctorId: string,
  key: PermissionKey
): Promise<boolean> {
  try {
    const doc = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { tier: true } });
    return tierAllows(doc?.tier, key);
  } catch (error) {
    console.error('[membership] doctorTierAllows failed:', error);
    return true; // fail-open
  }
}
