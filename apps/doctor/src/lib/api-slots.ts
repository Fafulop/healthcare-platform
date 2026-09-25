/**
 * Llamada SERVER-SIDE a `GET apps/api /api/appointments/slots`, AUTENTICADA con el token de quien
 * hace la petición.
 *
 * Por qué existe (2026-09-25): ese endpoint era PÚBLICO — sin sesión devolvía nombre, correo,
 * teléfono, notas, precio y `confirmationCode` de cada cita activa de cualquier doctor, y con ese
 * código se puede CANCELAR la cita sin sesión. Estas tres rutas del doctor (calendario de
 * Pendientes, crear y editar tarea) lo llamaban sin token, y eran lo que lo mantenía abierto.
 * Ahora el endpoint exige sesión y aquí se manda el token del usuario (mismo acuñador que el
 * agente: `mintApiToken`), así que apps/api aplica también los toggles del member (`citas`).
 *
 * Devuelve `null` si no se pudo acuñar el token (secreto sin configurar): el llamador lo trata
 * como "sin citas que avisar", igual que un error de red.
 */
import type { MedicalAuthContext } from '@/lib/medical-auth';
import { mintApiToken } from '@/lib/agenda-agent/api-token';

export async function fetchSlotsDelDoctor(
  ctx: MedicalAuthContext, startDate: string, endDate: string,
): Promise<Response | null> {
  const token = mintApiToken({ email: ctx.email, userId: ctx.userId, sessionVersion: ctx.sessionVersion });
  if (!token) {
    console.error('[api-slots] AUTH_SECRET/NEXTAUTH_SECRET sin configurar: no se piden los slots');
    return null;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
  const qs = new URLSearchParams({ doctorId: ctx.doctorId, startDate, endDate });
  return fetch(`${apiUrl}/api/appointments/slots?${qs}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}
