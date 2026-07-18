/**
 * Shared shape + validation for the doctor's receta credentials:
 * [{ titulo, cedula }] — médico general + especialidad(es)/subespecialidad,
 * each with its own cédula profesional.
 *
 * Used by:
 * - PUT /api/prescription-template (saving the profile identity, mi-perfil → Receta)
 * - POST /api/medical-records/patients/[id]/prescriptions (snapshot at creation)
 */

export interface PrescriptionCredential {
  titulo: string; // e.g. "Médico Cirujano", "Especialidad en Cardiología"
  cedula: string;
}

export const MAX_CREDENTIALS = 8;

export function validateCredentials(raw: unknown): { credentials?: PrescriptionCredential[]; error?: string } {
  if (!Array.isArray(raw)) return { error: 'credentials debe ser una lista' };
  if (raw.length > MAX_CREDENTIALS) return { error: `Máximo ${MAX_CREDENTIALS} cédulas` };
  const credentials: PrescriptionCredential[] = [];
  for (const item of raw) {
    const titulo = typeof item?.titulo === 'string' ? item.titulo.trim() : '';
    const cedula = typeof item?.cedula === 'string' ? item.cedula.trim() : '';
    if (!titulo || !cedula) return { error: 'Cada cédula requiere título y número' };
    if (titulo.length > 120 || cedula.length > 40) return { error: 'Título o cédula demasiado largos' };
    credentials.push({ titulo, cedula });
  }
  return { credentials };
}
