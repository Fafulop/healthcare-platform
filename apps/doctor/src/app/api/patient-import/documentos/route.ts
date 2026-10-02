import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { MAX_POR_TANDA, guardarTanda, texto } from '@/lib/importar-documentos';

/**
 * POST /api/patient-import/documentos — PACIENTE MIGRATION I1: guarda una TANDA de documentos
 * importados (docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md §7).
 *
 * Sólo el TITULAR (el prefijo `patient-import` es OWNER_ONLY en el mapa de rutas, y aquí se revisa
 * otra vez). Body: { batchId, elementos: Elemento[] } con a lo más 25 elementos. Cada elemento es:
 *   · un ARCHIVO ya subido por las rutas de siempre (`medicalDocuments` PDF / `medicalImages`):
 *     va al Docs y Galería del paciente («Historial importado», «Sin visita»);
 *   · una NOTA: el texto de un Word, sacado en el navegador (el Word no se sube).
 * Cada elemento se guarda solo (uno que falla no tumba a los demás) y la respuesta dice, por `ref`,
 * si quedó `guardado`, `ya_importado` (G1: se re-corrió el lote) o `error` con su motivo — la
 * pantalla reintenta sólo esos. Bitácora por elemento con el `batchId` (para deshacer el lote).
 */

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireDoctorAuth(request);
    if (!ctx.isOwner) throw new AppError('Sólo el titular de la cuenta puede importar', 403);

    const body = await request.json().catch(() => null);
    const batchId = texto(body?.batchId, 100);
    const elementos: unknown[] = Array.isArray(body?.elementos) ? body.elementos : [];
    if (!batchId) throw new AppError('batchId requerido', 400);
    if (elementos.length === 0 || elementos.length > MAX_POR_TANDA) {
      throw new AppError(`Entre 1 y ${MAX_POR_TANDA} elementos por tanda`, 400);
    }

    const resultados = await guardarTanda(
      prisma, { doctorId: ctx.doctorId, userId: ctx.userId }, batchId, elementos,
      (a) => logAudit({ ...a, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role, request }),
    );

    return NextResponse.json({ success: true, data: { resultados } });
  } catch (error) {
    return handleApiError(error, 'POST /api/patient-import/documentos');
  }
}
