import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import {
  bloquesDeCita, contarHijos, diaISO, diasDeCitas, leerBody, parseComentario, parseFecha, totalHijos,
  unicaPorCita, validarCitaParaVisita,
} from '@/lib/visitas';

// VISITAS D2 — docs/DESDE JUNIO/VISITAS/02-PLAN-fase-1.md §5.2. Permiso: `expedientes` (heredado).

type Params = { params: Promise<{ id: string; visitaId: string }> };

const VISITA_SELECT = {
  id: true, fecha: true, comentario: true, origen: true, bookingId: true, createdAt: true, updatedAt: true,
} as const;

async function cargarVisita(doctorId: string, patientId: string, visitaId: string) {
  return prisma.visita.findFirst({ where: { id: visitaId, patientId, doctorId }, select: VISITA_SELECT });
}

// GET — la visita con lo que contiene (y su cita, recortada por permiso)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, visitaId } = await params;

    const visita = await cargarVisita(ctx.doctorId, patientId, visitaId);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }

    const where = { visitaId, patientId, doctorId: ctx.doctorId };
    const [consultas, fotos, recetas, notas, informes, citas] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where, orderBy: { encounterDate: 'asc' },
        select: { id: true, encounterDate: true, encounterType: true, chiefComplaint: true, status: true, templateId: true },
      }),
      prisma.patientMedia.findMany({
        where, orderBy: { captureDate: 'asc' },
        select: {
          id: true, mediaType: true, fileName: true, fileUrl: true, thumbnailUrl: true, mimeType: true,
          category: true, captureDate: true, description: true, encounterId: true,
        },
      }),
      prisma.prescription.findMany({
        where, orderBy: { prescriptionDate: 'asc' },
        select: { id: true, prescriptionDate: true, status: true, diagnosis: true, encounterId: true },
      }),
      prisma.patientNote.findMany({
        where, orderBy: { updatedAt: 'desc' },
        select: { id: true, content: true, createdAt: true, updatedAt: true },
      }),
      prisma.medicalReport.findMany({
        where, orderBy: { createdAt: 'asc' },
        select: { id: true, formId: true, status: true, encounterId: true, createdAt: true, issuedAt: true },
      }),
      bloquesDeCita(ctx, visita.bookingId ? [visita.bookingId] : []),
    ]);
    // Con cita, la fecha es la de la CITA (se lee, DISEÑO §3), no el respaldo guardado.
    const dia = visita.bookingId ? (await diasDeCitas(ctx.doctorId, [visita.bookingId])).get(visita.bookingId) : undefined;

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'view_visita', resourceType: 'visita', resourceId: visitaId, request,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...visita,
        fecha: diaISO(dia ?? visita.fecha),
        cita: visita.bookingId ? citas.get(visita.bookingId) ?? { id: visita.bookingId } : null,
        consultas, fotos, recetas, notas, informes,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/visitas/[visitaId]');
  }
}

// PATCH — { comentario?: string|null, fecha?: 'YYYY-MM-DD', bookingId?: string|null }
// La fecha sólo se edita SIN cita: con cita, manda el día de la cita. Ligar exige `citas`.
// La visita AUTOMÁTICA de una cita (origen 'cita') no cambia de cita: ES la de esa cita, y
// soltarla a mano la dejaría duplicada en cuanto la sincronización de apps/api la re-creara.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, visitaId } = await params;
    const body = await leerBody(request);

    const visita = await cargarVisita(ctx.doctorId, patientId, visitaId);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }

    const data: Prisma.VisitaUncheckedUpdateInput = {};

    const comentario = parseComentario(body.comentario);
    if (comentario !== undefined) data.comentario = comentario;

    let bookingFinal = visita.bookingId;
    // Re-enviar la MISMA cita (un formulario que manda todo) no es ligar: no se valida ni se toca.
    if (body.bookingId !== undefined && body.bookingId !== visita.bookingId) {
      if (visita.origen === 'cita' && visita.bookingId && body.bookingId !== visita.bookingId) {
        throw new AppError('Es la visita automática de su cita: no se desliga ni se mueve', 409);
      }
      if (body.bookingId === null) {
        bookingFinal = null;
      } else {
        const { fechaCita } = await validarCitaParaVisita(ctx, patientId, body.bookingId, visitaId);
        bookingFinal = body.bookingId as string;
        if (fechaCita) data.fecha = fechaCita;
      }
      data.bookingId = bookingFinal;
    }

    if (body.fecha !== undefined) {
      const fecha = parseFecha(body.fecha);
      if (!fecha) throw new AppError('fecha inválida (YYYY-MM-DD)', 400);
      if (bookingFinal) {
        // Con cita, la fecha es la de la cita. Re-enviar la que ya se muestra no es cambiarla.
        const diaCita = (await diasDeCitas(ctx.doctorId, [bookingFinal])).get(bookingFinal);
        const mostrada = diaISO((data.fecha as Date | undefined) ?? diaCita ?? visita.fecha);
        if (diaISO(fecha) !== mostrada) {
          throw new AppError('La visita tiene cita: su fecha es la de la cita', 409);
        }
      } else {
        data.fecha = fecha;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const updated = await prisma.visita
      .update({ where: { id: visitaId }, data, select: VISITA_SELECT })
      .catch(unicaPorCita);

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'update_visita', resourceType: 'visita', resourceId: visitaId,
      changes: {
        ...(data.bookingId !== undefined ? { bookingId: { from: visita.bookingId, to: updated.bookingId } } : {}),
        ...(data.fecha !== undefined ? { fecha: { from: diaISO(visita.fecha), to: diaISO(updated.fecha) } } : {}),
        ...(data.comentario !== undefined ? { comentario: 'editado' } : {}),
      },
      request,
    });

    return NextResponse.json({ success: true, data: { ...updated, fecha: diaISO(updated.fecha) } });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/medical-records/patients/[id]/visitas/[visitaId]');
  }
}

// DELETE — sólo si está VACÍA (sin consultas, fotos, recetas, notas ni informes). Nada clínico se
// borra junto con una visita. El comentario no cuenta: borrarlo es la acción misma.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, visitaId } = await params;

    const visita = await cargarVisita(ctx.doctorId, patientId, visitaId);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }

    const conteo = (await contarHijos(patientId, [visitaId])).get(visitaId)!;
    if (totalHijos(conteo) > 0) {
      return NextResponse.json(
        { error: 'La visita tiene contenido; muévelo o bórralo primero', conteo },
        { status: 409 },
      );
    }

    await prisma.visita.delete({ where: { id: visitaId } });

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'delete_visita', resourceType: 'visita', resourceId: visitaId,
      changes: { fecha: diaISO(visita.fecha), bookingId: visita.bookingId, origen: visita.origen },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/visitas/[visitaId]');
  }
}
