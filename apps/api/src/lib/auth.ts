/**
 * Authentication helpers for API routes
 * Validates tokens from admin/doctor apps
 */

import { prisma } from '@healthcare/database';

interface AuthPayload {
  email: string;
  role: string;
  timestamp: number;
}

/**
 * Extract and validate auth token from request
 * Returns user info if valid, throws error if invalid
 */
export async function validateAuthToken(request: Request): Promise<{ email: string; role: string; userId: string }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  let payload: AuthPayload;
  try {
    // Decode the base64 token
    const decoded = atob(token);
    payload = JSON.parse(decoded);
  } catch (error) {
    throw new Error('Invalid token format');
  }

  // Validate payload structure
  if (!payload.email || !payload.role || !payload.timestamp) {
    throw new Error('Invalid token payload');
  }

  // Check token age (max 5 minutes old)
  const tokenAge = Date.now() - payload.timestamp;
  if (tokenAge > 5 * 60 * 1000) {
    throw new Error('Token expired');
  }

  // Verify user exists in database and has correct role
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== payload.role) {
    throw new Error('Role mismatch - invalid token');
  }

  return {
    email: user.email,
    role: user.role,
    userId: user.id,
  };
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
