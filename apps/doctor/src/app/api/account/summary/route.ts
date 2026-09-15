/**
 * GET /api/account/summary — el estado de la CUENTA: qué plan tiene y cuánto
 * lleva consumido de sus cupos. Alimenta /dashboard/cuenta.
 *
 * TIERS C1. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §4.
 *
 * 🔴 LAS DOS CUENTAS SON LAS MISMAS QUE COBRAN.
 * `patient.count` con `PATIENT_STATUS_COUNTED_AGAINST_QUOTA` y
 * `storedFile.aggregate` son literalmente las consultas que hacen
 * `assertPatientQuota` y `assertStorageQuota` al rechazar una escritura. Eso es
 * deliberado y es el punto entero de esta ruta: el número que el doctor VE
 * tiene que ser el número que lo RECHAZA, o la pantalla le estaría discutiendo
 * al servidor. No "parecido", el mismo.
 *
 * Owner-only (`requireOwnerAuth`): es información comercial del dueño, y la
 * regla del route map (`{ prefix: 'account', key: 'OWNER_ONLY' }`) es además lo
 * que impide que esta ruta quede bajo el techo de un tier — si cayera, una
 * cuenta FREE no podría abrir la pantalla que le explica qué le falta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, maxPatientsFor, storageBytesFor, PATIENT_STATUS_COUNTED_AGAINST_QUOTA } from '@healthcare/database';
import { requireOwnerAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const { doctorId, tier } = await requireOwnerAuth(request);

    const [pacientesActivos, agregadoArchivos] = await Promise.all([
      prisma.patient.count({
        where: { doctorId, status: PATIENT_STATUS_COUNTED_AGAINST_QUOTA },
      }),
      prisma.storedFile.aggregate({ where: { doctorId }, _sum: { sizeBytes: true } }),
    ]);

    return NextResponse.json({
      // El tier CRUDO de la BD, no normalizado: si alguna vez hay un valor no
      // canónico, la pantalla tiene que poder notarlo en vez de pintarlo como
      // si fuera bueno (`tierAllows` es fail-open y se comportaría como PRO).
      tier,
      pacientes: {
        usados: pacientesActivos,
        // null ⇒ sin tope. No es lo mismo que 0, y la UI los pinta distinto.
        tope: maxPatientsFor(tier),
      },
      almacenamiento: {
        // `_sum` es null cuando no hay ninguna fila — que es el estado normal
        // de casi todas las cuentas, no un error (el ledger empezó a contar el
        // 2026-09-13 y no hubo backfill).
        usadoBytes: agregadoArchivos._sum.sizeBytes ?? 0,
        topeBytes: storageBytesFor(tier),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
