/**
 * Piezas comunes de `/api/patient-import/*`.
 *
 * Lo importante de aquí es `resolveTargetDoctorId`: es el único lugar donde se
 * decide A QUÉ DOCTOR se le va a escribir. Si esa decisión estuviera copiada
 * en las dos rutas, un día una de las dos dejaría de comprobar el rol.
 */

import type { PrismaClient } from '@healthcare/database';
import { AuthError } from '@/lib/auth';
import type { ExistingData } from '@healthcare/database';

/** 8 MB. Un .xlsx de 2 000 renglones de texto pesa muy por debajo de esto. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

interface AuthedUser {
  userId: string;
  role: string;
  doctorId?: string | null;
  isOwner?: boolean;
}

/**
 * Decide el doctor destino.
 *
 * - ADMIN puede escribirle a CUALQUIER doctor, pero tiene que decir a cuál:
 *   nunca se adivina.
 * - Un DOCTOR solo puede escribirse a sí mismo. Si manda un `doctorId` que no
 *   es el suyo, es un intento de escribir en el expediente de otro y se corta
 *   con 403 — no se ignora en silencio.
 */
export async function resolveTargetDoctorId(
  user: AuthedUser,
  requestedDoctorId: string | null,
): Promise<string> {
  if (user.role === 'ADMIN') {
    if (!requestedDoctorId) {
      throw new AuthError('Falta indicar a qué doctor se importa.', 400);
    }
    return requestedDoctorId;
  }

  // Hueco #8. El prefijo `patient-import` ya está mapeado como OWNER_ONLY en
  // route-permissions, pero esto se vuelve a comprobar aquí a propósito: es un
  // camino de ESCRITURA masiva sobre expedientes, y no debe depender de que
  // una sola capa siga bien configurada. Una cuenta de apoyo puede tener el
  // expediente abierto y aun así no debe poder cargar la base entera.
  if (user.isOwner === false) {
    throw new AuthError(
      'Solo el titular de la cuenta puede importar pacientes.',
      403,
    );
  }

  const own = user.doctorId;
  if (!own) {
    throw new AuthError('Tu usuario no está ligado a un doctor.', 403);
  }
  if (requestedDoctorId && requestedDoctorId !== own) {
    throw new AuthError('No puedes importar al expediente de otro doctor.', 403);
  }
  return own;
}

/** Rol que se deja escrito en el audit log. */
export function auditRoleFor(user: AuthedUser): string {
  return user.role === 'ADMIN' ? 'admin' : 'doctor';
}

/**
 * Lo que el doctor YA tiene, para que el validador pueda avisar de duplicados.
 * Se traen solo las llaves, no los pacientes completos.
 */
export async function loadExisting(
  prisma: PrismaClient,
  doctorId: string,
): Promise<ExistingData> {
  const rows = await prisma.patient.findMany({
    where: { doctorId },
    select: { internalId: true, firstName: true, lastName: true, dateOfBirth: true },
  });

  const internalIds = new Set<string>();
  const identityKeys = new Set<string>();

  for (const r of rows) {
    internalIds.add(r.internalId);
    identityKeys.add(
      `${normalize(r.firstName)}|${normalize(r.lastName)}|${r.dateOfBirth.toISOString().slice(0, 10)}`,
    );
  }

  return { internalIds, identityKeys };
}

/** Tiene que coincidir con el `normKey` del validador. */
function normalize(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
