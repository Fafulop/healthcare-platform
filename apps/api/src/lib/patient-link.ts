// Shared pre-check for booking routes: a provided patientId must reference a
// Patient record of the SAME doctor the booking belongs to. The four creation
// routes stored patientId blindly (GAP-1, PR 3 audit 2026-07-06) — a
// stale/forged id would link the booking to another doctor's expediente.
// One definition for all callers (same pattern as booking-overlap.ts); the
// patient-link PATCH (bookings/[id]) uses it too.
//
// Unauthenticated callers (the two public booking routes accept them) get a
// UNIFORM 404 for both "doesn't exist" and "wrong doctor" — distinct responses
// would give anonymous callers an existence/ownership oracle for patient ids.

import { prisma } from '@healthcare/database';

/** Returns null when the link is valid (or absent); otherwise the HTTP error to return. */
export async function validatePatientLink(
  patientId: unknown,
  doctorId: string,
  authenticatedCaller = true
): Promise<{ status: number; error: string } | null> {
  if (!patientId) return null;
  // JSON body input — a non-string here is a malformed request, not a Prisma error
  if (typeof patientId !== 'string') {
    return { status: 400, error: 'patientId inválido' };
  }
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { doctorId: true },
  });
  if (!patient || patient.doctorId !== doctorId) {
    if (!authenticatedCaller) {
      return { status: 404, error: 'Paciente no encontrado' };
    }
    return !patient
      ? { status: 404, error: 'Paciente no encontrado' }
      : { status: 403, error: 'No autorizado — el expediente no pertenece a este doctor' };
  }
  return null;
}
