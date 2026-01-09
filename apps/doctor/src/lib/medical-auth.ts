import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
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
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token) {
    throw new Error('Authentication required');
  }

  // Check role is DOCTOR
  if (token.role !== 'DOCTOR') {
    throw new Error('Doctor role required');
  }

  // Get doctor ID from token
  const doctorId = token.doctorId as string;

  if (!doctorId) {
    throw new Error('No doctor profile linked to user');
  }

  return {
    userId: token.sub as string,
    email: token.email as string,
    role: token.role as string,
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
