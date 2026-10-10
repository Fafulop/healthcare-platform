import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import {
  bloquesDeCita, contarHijos, diaISO, diasDeCitas, leerBody, parseComentario, parseFecha, rechazarSiHayCitaEseDia,
  rechazarVisitaFuturaSinCita, totalHijos,
} from '@/lib/visitas';
import { auditarSeguimiento, parseSeguimiento, sesionDeVisita, unirComoSeguimiento } from '@/lib/tratamientos';

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
    const [consultas, fotos, recetas, notas, informes, citas, sesion] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where, orderBy: { encounterDate: 'asc' },
        select: { id: true, encounterDate: true, encounterType: true, chiefComplaint: true, status: true, templateId: true, template: { select: { name: true } } },
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
      // Tratamientos T3: «Sesión 3 de 6 — Injerto capilar» en la pantalla de la visita.
      sesionDeVisita(ctx.doctorId, patientId, visitaId, visita.bookingId),
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
        sesion,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/visitas/[visitaId]');
  }
}

// PATCH — { comentario?: string|null, fecha?: 'YYYY-MM-DD' }
// La fecha sólo se edita SIN cita: con cita, manda el día de la cita. Ya no se liga ni se desliga una
// cita (08-PLAN F1): `bookingId` distinto del que tiene → 400.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId, visitaId } = await params;
    const body = await leerBody(request);

    const visita = await cargarVisita(ctx.doctorId, patientId, visitaId);
    if (!visita) {
      return NextResponse.json({ error: 'Visita not found' }, { status: 404 });
    }

    // 08-PLAN F2 — «¿Es seguimiento?» para una visita que YA existe (la de una cita nace al agendarla):
    // la misma regla que al crearla (`unirComoSeguimiento`). Sólo si aún no es de un tratamiento (por sí
    // o por su cita). Va sola: no se mezcla con fecha ni comentario.
    if (body.seguimiento !== undefined) {
      const seguimiento = parseSeguimiento(body.seguimiento);
      if (!seguimiento) throw new AppError('seguimiento inválido', 400);
      if (await sesionDeVisita(ctx.doctorId, patientId, visitaId, visita.bookingId)) {
        throw new AppError('Esta visita ya es de un tratamiento', 409);
      }
      const hecho = await prisma.$transaction((tx) => unirComoSeguimiento(
        tx, ctx.doctorId, patientId, seguimiento,
        { id: visitaId, bookingId: visita.bookingId, fecha: visita.fecha },
      ));
      await auditarSeguimiento(ctx, request, patientId, hecho, visitaId);
      return NextResponse.json({
        success: true,
        data: {
          id: visitaId,
          seguimiento: {
            tratamientoId: hecho.tratamientoId, numero: hecho.numero, tratamientoCreado: hecho.creado?.nombre ?? null,
          },
        },
      });
    }

    const data: Prisma.VisitaUncheckedUpdateInput = {};

    const comentario = parseComentario(body.comentario);
    if (comentario !== undefined) data.comentario = comentario;

    const bookingFinal = visita.bookingId;
    // 08-PLAN F1 (2026-10-09): ya NO se liga ni se desliga una cita a mano — visita y cita son el
    // mismo evento: la de una cita nace con ella; una suelta crea su cita («También en la agenda»).
    // Re-enviar la MISMA cita (un formulario que manda todo) no es ligar: se ignora.
    if (body.bookingId !== undefined && body.bookingId !== visita.bookingId) {
      throw new AppError('Ya no se liga ni se desliga una cita a una visita', 400);
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
        // Sin cita, la fecha de la visita se corrige libremente: sus plantillas tienen la suya (2026-10-02).
        data.fecha = fecha;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    // 07-PLAN P2 + 08-PLAN F1: una visita SIN cita que cambia de fecha: sólo hoy o antes, y no el día de
    // una cita viva del paciente. Editar sólo el comentario de una visita vieja así no se bloquea.
    if (!bookingFinal && data.fecha !== undefined) {
      rechazarVisitaFuturaSinCita(data.fecha as Date);
      await rechazarSiHayCitaEseDia(ctx.doctorId, patientId, data.fecha as Date);
    }

    // 08-PLAN F1: sin ligar/desligar ya no hay sesión que reacomodar (G3): sólo comentario y fecha.
    const updated = await prisma.visita.update({ where: { id: visitaId }, data, select: VISITA_SELECT });

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'update_visita', resourceType: 'visita', resourceId: visitaId,
      changes: {
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
    // VENTAS PACIENTE paso 3: `sales.visita_id` is a plain link (no FK), so deleting the visita
    // would leave its sales pointing at nothing. Money is never dropped silently.
    const ventas = await prisma.sale.count({ where: { visitaId, doctorId: ctx.doctorId } });
    if (ventas > 0) {
      return NextResponse.json(
        { error: `La visita tiene ${ventas === 1 ? 'una venta' : `${ventas} ventas`}: no se puede borrar` },
        { status: 409 },
      );
    }

    // Si una sesión de tratamiento la guarda, la FK la suelta (SET NULL) y la sesión vuelve a «por
    // agendar»: se audita en la SESIÓN también, como cualquier otro cambio de su visita.
    const sesion = await prisma.tratamientoSesion.findFirst({
      where: { visitaId, doctorId: ctx.doctorId },
      select: { id: true, tratamientoId: true, numero: true },
    });

    await prisma.visita.delete({ where: { id: visitaId } });

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'delete_visita', resourceType: 'visita', resourceId: visitaId,
      changes: {
        fecha: diaISO(visita.fecha), bookingId: visita.bookingId, origen: visita.origen,
        ...(sesion ? { sesionDeTratamiento: sesion.id } : {}),
      },
      request,
    });
    if (sesion) {
      await logAudit({
        patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
        action: 'link_sesion_visita', resourceType: 'tratamiento_sesion', resourceId: sesion.id,
        changes: {
          tratamientoId: sesion.tratamientoId, numero: sesion.numero,
          visitaId: { from: visitaId, to: null }, motivo: 'se borró la visita',
        },
        request,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/visitas/[visitaId]');
  }
}
