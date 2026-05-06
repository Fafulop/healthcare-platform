/**
 * Authentication helpers for API routes
 * Validates JWT tokens from admin/doctor apps using NextAuth secret
 */

import { prisma } from '@healthcare/database';
import jwt from 'jsonwebtoken';

/**
 * Thrown for authentication/authorization failures.
 * Routes catch this to return the correct HTTP status (401/403)
 * instead of a misleading 500.
 */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

interface JWTPayload {
  email: string;
  sub?: string;  // NextAuth includes user ID as 'sub'
  iat?: number;
  exp?: number;
  jti?: string;
  sessionVersion?: number;
}

/**
 * Extract and validate JWT token from request
 * Returns user info if valid, throws error if invalid
 */
export async function validateAuthToken(
  request: Request,
  options?: { skipVersionCheck?: boolean }
): Promise<{
  email: string;
  role: string;
  userId: string;
  doctorId: string | null;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);  // Remove 'Bearer ' prefix

  try {
    // Verify JWT signature using NextAuth secret (try AUTH_SECRET first for NextAuth v5, fallback to NEXTAUTH_SECRET)
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is not configured');
    }

    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JWTPayload;

    if (!payload.email) {
      throw new AuthError('Token missing email claim');
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        email: true,
        role: true,
        doctorId: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      throw new AuthError('User not found in database');
    }

    // Reject sessions that predate a kill-all-sessions action.
    // Tokens issued before the feature have no sessionVersion — treat as 0.
    // skipVersionCheck is used by kill-sessions itself to avoid a deadlock.
    if (!options?.skipVersionCheck && (payload.sessionVersion ?? 0) !== user.sessionVersion) {
      throw new AuthError('Session has been invalidated - please log in again');
    }

    return {
      email: user.email,
      role: user.role,
      userId: user.id,
      doctorId: user.doctorId,
    };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Session expired - please log in again');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid token signature');
    }
    throw new AuthError(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Require ADMIN role for API endpoint
 */
export async function requireAdminAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (user.role !== 'ADMIN') {
    throw new AuthError('Admin access required', 403);
  }

  return user;
}

/**
 * Require DOCTOR or ADMIN role for API endpoint
 * ADMIN users have access to all doctor-related endpoints for management
 */
export async function requireDoctorAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (!['DOCTOR', 'ADMIN'].includes(user.role)) {
    throw new AuthError('Doctor or Admin access required', 403);
  }

  return user;
}

/**
 * Require any authenticated user (ADMIN or DOCTOR)
 */
export async function requireStaffAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (!['ADMIN', 'DOCTOR'].includes(user.role)) {
    throw new AuthError('Staff access required', 403);
  }

  return user;
}

/**
 * Get authenticated doctor's profile
 * Requires user to be a DOCTOR or ADMIN with a linked doctor profile
 */
export async function getAuthenticatedDoctor(request: Request) {
  const user = await requireDoctorAuth(request);

  // Both DOCTOR and ADMIN require a linked doctor profile
  if (!user.doctorId) {
    throw new AuthError('No doctor profile linked to this account', 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: user.doctorId },
    select: {
      id: true,
      slug: true,
      doctorFullName: true,
      primarySpecialty: true,
    },
  });

  if (!doctor) {
    throw new AuthError('Doctor profile not found', 403);
  }

  return {
    user,
    doctor,
  };
}

/**
 * Get authenticated doctor for Stripe operations.
 * Restricts to DOCTOR role only — admins cannot perform financial operations
 * on behalf of doctors to prevent privilege escalation.
 */
export async function getAuthenticatedDoctorStripe(request: Request) {
  const user = await validateAuthToken(request);

  if (user.role !== 'DOCTOR') {
    throw new AuthError('Solo doctores pueden realizar operaciones de pago', 403);
  }

  if (!user.doctorId) {
    throw new AuthError('No doctor profile linked to this account', 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: user.doctorId },
    select: {
      id: true,
      slug: true,
      doctorFullName: true,
      primarySpecialty: true,
    },
  });

  if (!doctor) {
    throw new AuthError('Doctor profile not found', 403);
  }

  return { user, doctor };
}
