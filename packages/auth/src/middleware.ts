import { auth } from "./nextauth-config";

/**
 * Require any authenticated user
 */
export async function requireAuth() {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  return session;
}

/**
 * Require ADMIN role
 */
export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }

  return session;
}

/**
 * Require DOCTOR role
 */
export async function requireDoctor() {
  const session = await requireAuth();

  if (session.user.role !== "DOCTOR") {
    throw new Error("Forbidden: Doctor access required");
  }

  return session;
}

/**
 * Require either ADMIN or DOCTOR (any staff member)
 */
export async function requireStaff() {
  const session = await requireAuth();

  if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
    throw new Error("Forbidden: Staff access required");
  }

  return session;
}

/**
 * Check if user owns the doctor profile
 * Admins can access any doctor, doctors can only access their own
 */
export async function requireDoctorOwnership(doctorId: string) {
  const session = await requireAuth();

  // Admins can access any doctor
  if (session.user.role === "ADMIN") {
    return session;
  }

  // Doctors can only access their own profile
  if (session.user.role === "DOCTOR") {
    if (session.user.doctorId !== doctorId) {
      throw new Error("Forbidden: Can only access your own profile");
    }
  }

  return session;
}
