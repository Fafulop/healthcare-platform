import { NextRequest } from 'next/server';
import { auth } from '@healthcare/auth';
import { prisma } from '@healthcare/database';

export interface MedicalAuthContext {
  userId: string;
  email: string;
  role: string;
  doctorId: string;
}

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

  // Get doctor ID from session
  const doctorId = user.doctorId as string;

  if (!doctorId) {
    throw new Error('No doctor profile linked to user');
  }

  return {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    doctorId
  };
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
