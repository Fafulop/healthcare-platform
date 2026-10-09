import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import {
  bloquesDeCita, contarHijos, diaISO, diasDeCitas, leerBody, parseComentario, parseFecha, rechazarVisitaFuturaSinCita,
  unicaPorCita, validarCitaParaVisita,
} from '@/lib/visitas';
import {
  aplicarEnSesion, auditarCambioDeSesion, auditarSeguimiento, parseSeguimiento, sesionAlLigarCitaAVisita,
  sesionesDeVisitas, unirComoSeguimiento,
} from '@/lib/tratamientos';

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
    const [conteos, citas, dias, sesiones] = await Promise.all([
      contarHijos(patientId, ids),
      bloquesDeCita(ctx, bookingIds),
      diasDeCitas(ctx.doctorId, bookingIds),
      // T7: «Sesión N de M — X» en la tarjeta de Visitas del perfil.
      sesionesDeVisitas(ctx.doctorId, patientId, visitas),
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
        sesion: sesiones.get(v.id) ?? null,
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
// Body: { fecha?: 'YYYY-MM-DD', comentario?: string, bookingId?: string,
//         seguimiento?: { tratamientoId } | { visitaId } }  ← T7 «Es seguimiento de…» (DISEÑO §7)
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
    // 07-PLAN P2: sin cita, sólo hoy o antes (también con `paraSesion` y con seguimiento). Con cita
    // sí puede ser futura: es abrir la visita antes (V4, decisión 4).
    if (!bookingId) rechazarVisitaFuturaSinCita(fecha);
    const seguimiento = parseSeguimiento(body.seguimiento);
    // TRATAMIENTOS v2 · V4 — «Abrir visita» de una sesión SIN cita: la visita nace ligada a ESA sesión
    // en la misma transacción (con cita no hace falta: `bookingId` ya la liga, G3). Excluyente con cita
    // y con «Es seguimiento».
    const paraSesion = typeof body.paraSesion === 'string' && body.paraSesion ? body.paraSesion : null;
    if (paraSesion && (bookingId || seguimiento)) {
      throw new AppError('paraSesion no se combina con cita ni con seguimiento', 400);
    }

    // Tratamientos G3: si la cita es de una sesión, la sesión guarda esta visita (P2 revisado).
    // Se lee dentro de la tx para que un choque con otra petición salga como lo que es.
    // T7: con «Es seguimiento», la visita entra al tratamiento EN LA MISMA transacción: o nacen las
    // dos cosas, o ninguna (un 409 del seguimiento no deja una visita suelta).
    const { visita, enSesion, seguimientoHecho } = await prisma
      .$transaction(async (tx) => {
        const cambio = bookingId
          ? await sesionAlLigarCitaAVisita(tx, ctx.doctorId, patientId, bookingId, null)
          : null;
        if (cambio && seguimiento) {
          throw new AppError('Esta cita ya es de una sesión de tratamiento: la visita entra sola a ese tratamiento', 409);
        }
        const v = await tx.visita.create({
          data: { patientId, doctorId: ctx.doctorId, fecha: fecha!, comentario, bookingId, origen: 'manual' },
          select: { id: true, fecha: true, comentario: true, origen: true, bookingId: true, createdAt: true, updatedAt: true },
        });
        if (cambio) await aplicarEnSesion(tx, cambio, bookingId!, v.id);
        if (paraSesion) {
          // Escritura condicionada: sólo una sesión de ESTE paciente, de un tratamiento ACTIVO (atender
          // una sesión nueva, como agendarla), no cancelada, SIN visita y SIN cita que cuente — la misma
          // regla que `estadoDeSesion`: cita cancelada/no asistió, de otro paciente o de ninguno (`not`
          // no casa NULL, por eso va aparte). Si no casa, 409 y la visita no nace (rollback).
          const { count } = await tx.tratamientoSesion.updateMany({
            where: {
              id: paraSesion, doctorId: ctx.doctorId, patientId, cancelada: false, visitaId: null,
              tratamiento: { estado: 'activo' },
              OR: [
                { bookingId: null },
                { booking: { status: { in: ['CANCELLED', 'NO_SHOW'] } } },
                { booking: { patientId: { not: patientId } } },
                { booking: { patientId: null } },
              ],
            },
            data: { visitaId: v.id },
          });
          if (count === 0) {
            throw new AppError('Esa sesión ya tiene visita o cita, se canceló, o su tratamiento no está activo: recarga el tratamiento', 409);
          }
        }
        const hecho = seguimiento
          ? await unirComoSeguimiento(tx, ctx.doctorId, patientId, seguimiento, { id: v.id, bookingId, fecha: v.fecha })
          : null;
        return { visita: v, enSesion: cambio, seguimientoHecho: hecho };
      })
      .catch(unicaPorCita);

    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_visita', resourceType: 'visita', resourceId: visita.id,
      changes: {
        fecha: diaISO(visita.fecha), bookingId, conComentario: !!comentario,
        ...(enSesion ? { sesionDeTratamiento: enSesion.sesionId } : {}),
        ...(paraSesion ? { sesionDeTratamiento: paraSesion, abiertaDesdeSesion: true } : {}),
        ...(seguimientoHecho ? { seguimiento: { tratamientoId: seguimientoHecho.tratamientoId, numero: seguimientoHecho.numero } } : {}),
      },
      request,
    });
    if (enSesion) await auditarCambioDeSesion(ctx, request, patientId, enSesion, bookingId!, visita.id);
    if (paraSesion) {
      // El vínculo se audita también bajo la SESIÓN (como `link_sesion_visita` del camino con cita).
      await logAudit({
        patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
        action: 'link_sesion_visita', resourceType: 'tratamiento_sesion', resourceId: paraSesion,
        changes: { visitaId: { to: visita.id }, motivo: 'visita abierta desde la sesión' },
        request,
      });
    }
    if (seguimientoHecho) await auditarSeguimiento(ctx, request, patientId, seguimientoHecho, visita.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...visita, fecha: diaISO(visita.fecha),
          // T7: a qué tratamiento entró (para el aviso del modal).
          ...(seguimientoHecho ? {
            seguimiento: {
              tratamientoId: seguimientoHecho.tratamientoId, numero: seguimientoHecho.numero,
              tratamientoCreado: seguimientoHecho.creado?.nombre ?? null,
            },
          } : {}),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/visitas');
  }
}
