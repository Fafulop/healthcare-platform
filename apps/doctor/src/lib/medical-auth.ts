import { NextRequest } from 'next/server';
import { auth } from '@healthcare/auth';
import { prisma, checkRoutePermission, type PermissionSet } from '@healthcare/database';

export interface MedicalAuthContext {
  userId: string;
  email: string;
  role: string;
  /** EFFECTIVE doctor (membership-first resolution in the session callback). */
  doctorId: string;
  /** true for portal owners; false for secondary users (members). */
  isOwner: boolean;
  /** null for owners (= everything). Members: toggle set (fail-closed reads). */
  permissions: PermissionSet | null;
  /** For minting API tokens server-side (agenda-agent tools) — must match the
   * user's current sessionVersion or apps/api rejects the token. */
  sessionVersion: number;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Validates that the request is from an authenticated doctor
 * Returns doctorId for scoping queries
 */
export async function requireDoctorAuth(
  request: NextRequest
): Promise<MedicalAuthContext> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error('Authentication required');
  }

  const user = session.user as any;

  // Check role is DOCTOR or ADMIN
  // ADMIN users can access medical records for support/management purposes
  if (!['DOCTOR', 'ADMIN'].includes(user.role)) {
    throw new Error('Doctor or Admin role required');
  }

  // Get EFFECTIVE doctor ID from session (membership-first, see nextauth-config)
  const doctorId = user.doctorId as string;

  if (!doctorId) {
    throw new Error('No doctor profile linked to user');
  }

  const isOwner = (user.isOwner as boolean | undefined) ?? true; // legacy sessions = owner
  const permissions = (user.permissions as PermissionSet | null | undefined) ?? null;

  // MEMBER enforcement (PR B): owners/admins bypass entirely. Fail-closed for
  // members — an internal route missing from the map is blocked.
  if (!isOwner && user.role !== 'ADMIN') {
    const pathname = request.nextUrl.pathname;
    const method = request.method.toUpperCase();
    const decision = checkRoutePermission(pathname, method, permissions);

    if (!decision.allowed) {
      throw new Error('PERMISSION_BLOCKED');
    }

    // Fire-and-forget audit of member WRITES (route identity only, never body).
    if (MUTATING_METHODS.has(method)) {
      prisma.memberAuditLog
        .create({
          data: {
            doctorId,
            userId: user.id as string,
            method,
            path: pathname.slice(0, 300),
            toggleKey: decision.toggle,
          },
        })
        .catch((e) => console.error('[medical-auth] member audit write failed:', e));
    }
  }

  return {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    doctorId,
    isOwner,
    permissions,
    sessionVersion: (user.sessionVersion as number | undefined) ?? 0
  };
}

export interface AnyAuthContext {
  userId: string;
  email: string;
  role: string;
  /** null for a user with no doctor at all — the exact case my-invites exists for. */
  doctorId: string | null;
}

/**
 * ANY authenticated user, doctorId optional (NUEVOS USUARIOS PR D). Unlike
 * requireDoctorAuth this does NOT throw for a doctorId-less user — that is
 * precisely the state of someone checking their own pending team invites
 * before they belong to any portal. Never runs member route enforcement
 * (there is no doctor to scope it against).
 */
export async function requireAnyAuth(request: NextRequest): Promise<AnyAuthContext> {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Authentication required');
  }
  const user = session.user as any;
  return {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    doctorId: (user.doctorId as string | undefined) ?? null,
  };
}

/**
 * Owner-only endpoints (Equipo tab backend). isOwner, NOT the `perfil` toggle
 * — a member with Editar Perfil ON must still be unable to manage the team
 * (00-REQUISITOS §3.4, self-privilege-escalation guard).
 */
export async function requireOwnerAuth(request: NextRequest): Promise<MedicalAuthContext> {
  const ctx = await requireDoctorAuth(request);
  if (!ctx.isOwner) {
    throw new Error('PERMISSION_BLOCKED');
  }
  return ctx;
}

/**
 * Log audit entry for patient data access
 */
export async function logAudit(params: {
  patientId: string;
  doctorId: string;
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: any;
  request: NextRequest;
}) {
  try {
    await prisma.patientAuditLog.create({
      data: {
        patientId: params.patientId,
        doctorId: params.doctorId,
        userId: params.userId,
        userRole: params.userRole,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        changes: params.changes,
        ipAddress: params.request.headers.get('x-forwarded-for') ||
                   params.request.headers.get('x-real-ip') ||
                   'unknown',
        userAgent: params.request.headers.get('user-agent') || undefined,
      }
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging shouldn't break the request
  }
}
