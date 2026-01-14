/**
 * Authentication helpers for API routes
 * Validates JWT tokens from admin/doctor apps using NextAuth secret
 */

import { prisma } from '@healthcare/database';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  email: string;
  sub?: string;  // NextAuth includes user ID as 'sub'
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Extract and validate JWT token from request
 * Returns user info if valid, throws error if invalid
 */
export async function validateAuthToken(request: Request): Promise<{
  email: string;
  role: string;
  userId: string;
  doctorId: string | null;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);  // Remove 'Bearer ' prefix

  // Debug logging
  console.log('[AUTH DEBUG] Token received (first 50 chars):', token.substring(0, 50) + '...');
  console.log('[AUTH DEBUG] AUTH_SECRET exists:', !!process.env.AUTH_SECRET);
  console.log('[AUTH DEBUG] NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);

  try {
    // Verify JWT signature using NextAuth secret (try AUTH_SECRET first for NextAuth v5, fallback to NEXTAUTH_SECRET)
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is not configured');
    }

    console.log('[AUTH DEBUG] Using secret (first 20 chars):', secret.substring(0, 20) + '...');

    // Try to decode without verification first to see the structure
    const decoded = jwt.decode(token, { complete: true });
    console.log('[AUTH DEBUG] Token header:', decoded?.header);
    console.log('[AUTH DEBUG] Token payload email:', (decoded?.payload as any)?.email);

    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JWTPayload;

    console.log('[AUTH DEBUG] Token verified successfully for:', payload.email);

    if (!payload.email) {
      throw new Error('Token missing email claim');
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        email: true,
        role: true,
        doctorId: true,
      },
    });

    if (!user) {
      throw new Error('User not found in database');
    }

    return {
      email: user.email,
      role: user.role,
      userId: user.id,
      doctorId: user.doctorId,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Session expired - please log in again');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token signature');
    }
    throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Require ADMIN role for API endpoint
 */
export async function requireAdminAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }

  return user;
}

/**
 * Require DOCTOR role for API endpoint
 */
export async function requireDoctorAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (user.role !== 'DOCTOR') {
    throw new Error('Doctor access required');
  }

  return user;
}

/**
 * Require any authenticated user (ADMIN or DOCTOR)
 */
export async function requireStaffAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (!['ADMIN', 'DOCTOR'].includes(user.role)) {
    throw new Error('Staff access required');
  }

  return user;
}

/**
 * Get authenticated doctor's profile
 * Requires user to be a DOCTOR and have a linked doctor profile
 */
export async function getAuthenticatedDoctor(request: Request) {
  const user = await requireDoctorAuth(request);

  if (!user.doctorId) {
    throw new Error('No doctor profile linked to this account');
  }

  // Get the doctor profile
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
    throw new Error('Doctor profile not found');
  }

  return {
    user,
    doctor,
  };
}
