import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { leerBody } from '@/lib/visitas';
import { SESIONES_MAX, cargarTratamiento, parseNotas, sesionesParaRespuesta } from '@/lib/tratamientos';

// VISITAS fase 2 T2 — docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §3. Permiso: `expedientes` (heredado).

type Params = { params: Promise<{ id: string; tratamientoId: string }> };

// POST — agrega UNA sesión «por agendar» con el siguiente número (P3: borrar deja hueco, no se
// renumera). Body opcional: { notas? }. Ligar cita o visita va por el PATCH de la sesión.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, tratamientoId } = await params;
    const body = await leerBody(request).catch(() => ({} as Record<string, unknown>));

    const tratamiento = await cargarTratamiento(ctx.doctorId, patientId, tratamientoId);
    if (!tratamiento) {
      return NextResponse.json({ error: 'Tratamiento not found' }, { status: 404 });
    }
    const notas = parseNotas(body.notas) ?? null;

    // G9: dos «+ Agregar sesión» a la vez leen el mismo máximo y chocan en (tratamiento, numero).
    // Se reintenta UNA vez releyendo el máximo; si vuelve a chocar, 409 legible.
    const crear = async () => {
      // El tope cuenta sesiones que EXISTEN, no el número más alto (P3: borrar deja huecos).
      const agg = await prisma.tratamientoSesion.aggregate({
        where: { tratamientoId }, _max: { numero: true }, _count: { _all: true },
      });
      if (agg._count._all >= SESIONES_MAX) {
        throw new AppError(`Un tratamiento tiene a lo más ${SESIONES_MAX} sesiones`, 409);
      }
      const numero = (agg._max.numero ?? 0) + 1;
      return prisma.tratamientoSesion.create({
        data: { tratamientoId, patientId, doctorId: ctx.doctorId, numero, notas },
        select: { id: true, numero: true },
      });
    };
    const esChoque = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
    let sesion;
    try {
      sesion = await crear();
    } catch (e) {
      if (!esChoque(e)) throw e;
      sesion = await crear().catch((e2) => {
        if (esChoque(e2)) throw new AppError('Otra sesión se agregó al mismo tiempo; recarga e intenta de nuevo', 409);
        throw e2;
      });
    }

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_sesion', resourceType: 'tratamiento_sesion', resourceId: sesion.id,
      changes: { tratamientoId, numero: sesion.numero, conNotas: !!notas },
      request,
    });

    const [data] = await sesionesParaRespuesta(ctx, patientId, { id: sesion.id });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/tratamientos/[tratamientoId]/sesiones');
  }
}
