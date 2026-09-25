import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import {
  bloquesDeCita, contarHijos, diaISO, diasDeCitas, leerBody, parseComentario, parseFecha, unicaPorCita,
  validarCitaParaVisita,
} from '@/lib/visitas';

// VISITAS D2 — docs/DESDE JUNIO/VISITAS/02-PLAN-fase-1.md §5.2. Permiso: `expedientes` (heredado).

// GET /api/medical-records/patients/:id/visitas — las visitas del paciente, la más reciente primero
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: ctx.doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const visitas = await prisma.visita.findMany({
      where: { patientId, doctorId: ctx.doctorId },
      select: { id: true, fecha: true, comentario: true, origen: true, bookingId: true, createdAt: true, updatedAt: true },
    });

    const ids = visitas.map((v) => v.id);
    const bookingIds = visitas.flatMap((v) => (v.bookingId ? [v.bookingId] : []));
    const [conteos, citas, dias] = await Promise.all([
      contarHijos(patientId, ids),
      bloquesDeCita(ctx, bookingIds),
      diasDeCitas(ctx.doctorId, bookingIds),
    ]);

    // Con cita, la fecha es la de la CITA (se lee); el orden va por esa fecha, no por el respaldo.
    const data = visitas
      .map((v) => ({
        id: v.id,
        fecha: diaISO((v.bookingId && dias.get(v.bookingId)) || v.fecha),
        comentario: v.comentario,
        origen: v.origen,
        conteo: conteos.get(v.id),
        cita: v.bookingId ? citas.get(v.bookingId) ?? { id: v.bookingId } : null,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/visitas');
  }
}

// POST /api/medical-records/patients/:id/visitas — visita MANUAL
// Body: { fecha?: 'YYYY-MM-DD', comentario?: string, bookingId?: string }
// `fecha` es requerida SIN cita. Con cita, el día de la cita manda (y ligar exige `citas`).
// Una `fecha` que venga mal formada es 400 siempre, aunque venga cita.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await leerBody(request);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: ctx.doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    let fecha: Date | null = null;
    if (body.fecha !== undefined && body.fecha !== null) {
      fecha = parseFecha(body.fecha);
      if (!fecha) throw new AppError('fecha inválida (YYYY-MM-DD)', 400);
    }
    const comentario = parseComentario(body.comentario) ?? null;
    let bookingId: string | null = null;
    if (body.bookingId !== undefined && body.bookingId !== null) {
      const { fechaCita } = await validarCitaParaVisita(ctx, patientId, body.bookingId);
      bookingId = body.bookingId as string;
      if (fechaCita) fecha = fechaCita;
    }
    if (!fecha) throw new AppError('fecha es requerida (YYYY-MM-DD)', 400);

    const visita = await prisma.visita
      .create({
        data: { patientId, doctorId: ctx.doctorId, fecha, comentario, bookingId, origen: 'manual' },
        select: { id: true, fecha: true, comentario: true, origen: true, bookingId: true, createdAt: true, updatedAt: true },
      })
      .catch(unicaPorCita);

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_visita', resourceType: 'visita', resourceId: visita.id,
      changes: { fecha: diaISO(visita.fecha), bookingId, conComentario: !!comentario },
      request,
    });

    return NextResponse.json(
      { success: true, data: { ...visita, fecha: diaISO(visita.fecha) } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/visitas');
  }
}
