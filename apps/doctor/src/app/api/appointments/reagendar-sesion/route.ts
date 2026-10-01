import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { AppError, handleApiError } from '@/lib/api-error-handler';
import { leerBody, puedeVer } from '@/lib/visitas';
import {
  auditarEfectosDeLigar, citaEfectiva, escribirSesion, motivoNoSeMueve, planLigarCitaASesion,
} from '@/lib/tratamientos';

/**
 * POST /api/appointments/reagendar-sesion — { deBookingId, aBookingId }
 *
 * TRATAMIENTOS: reagendar (en la agenda y en el asistente) CANCELA la cita vieja y CREA otra. Sin
 * esto, la sesión de tratamiento se quedaba en la cita cancelada («Por agendar — su cita se
 * canceló») y la nueva no era de nadie. Lo llaman los dos caminos de reagendar DESPUÉS de que el
 * reagendado salió bien: nunca lo deshace ni lo bloquea. (Hacerlo en el servidor, dentro del
 * reagendado mismo, es de T4 — 03-PLAN §5.)
 *
 * Cuelga de `appointments` ⇒ exige `citas`: un ayudante que puede reagendar también lleva la sesión.
 * Por eso es ESTRICTA — sólo el caso limpio, y nada clínico se mueve:
 *   · la cita vieja está CANCELADA y la nueva nació como reagendado (`isRescheduled`), está ACTIVA
 *     (pendiente o confirmada) y es del mismo paciente: no sirve para mover una sesión entre dos
 *     citas vivas ni hacia una cita vieja ya completada;
 *   · la sesión no está cancelada y NO guarda visita (si la tiene —p. ej. abierta de antemano con
 *     plantillas—, decidir qué pasa con ella es del doctor, en el tratamiento);
 *   · se escribe sólo si la sesión SIGUE en la cita vieja (si otra petición la cambió, 409).
 * Si no se cumple, `{ movida: false, motivo }` y no toca nada. El nombre del tratamiento sólo viaja
 * a quien puede ver expedientes.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireDoctorAuth(request);
    const body = await leerBody(request);
    const de = body.deBookingId;
    const a = body.aBookingId;
    if (typeof de !== 'string' || !de || typeof a !== 'string' || !a || de === a) {
      throw new AppError('deBookingId y aBookingId inválidos', 400);
    }

    const s = await prisma.tratamientoSesion.findFirst({
      where: { doctorId: ctx.doctorId, bookingId: de },
      select: {
        id: true, patientId: true, numero: true, visitaId: true, cancelada: true, tratamientoId: true, bookingId: true,
        tratamiento: { select: { nombre: true, sesionesPlaneadas: true } },
        booking: { select: { patientId: true, status: true } },
      },
    });
    // Sin sesión (lo común), o con una cita que ya no es de su paciente (G1): no hay qué llevar.
    if (!s || !citaEfectiva(s)) {
      return NextResponse.json({ success: true, movida: false });
    }

    const verNombre = puedeVer(ctx, 'expedientes');
    const sesion = {
      numero: s.numero, sesionesPlaneadas: s.tratamiento.sesionesPlaneadas,
      ...(verNombre ? { nombre: s.tratamiento.nombre } : {}),
    };
    const noSeMueve = (motivo: 'cita_no_cancelada' | 'no_es_reagendado' | NonNullable<ReturnType<typeof motivoNoSeMueve>>) =>
      NextResponse.json({ success: true, movida: false, motivo, sesion });

    if (s.booking?.status !== 'CANCELLED') return noSeMueve('cita_no_cancelada');
    const nueva = await prisma.booking.findFirst({
      where: { id: a, doctorId: ctx.doctorId },
      select: { isRescheduled: true, status: true },
    });
    if (!nueva?.isRescheduled || (nueva.status !== 'PENDING' && nueva.status !== 'CONFIRMED')) {
      return noSeMueve('no_es_reagendado');
    }
    const motivo = motivoNoSeMueve(s);
    if (motivo) return noSeMueve(motivo);

    // Mismas reglas que «Ligar una cita…» (mismo paciente, activa, de ninguna otra sesión). Sin
    // visita propia no hay visita que mover (`moverVisita` queda null).
    const plan = await planLigarCitaASesion(ctx, s, a, null);
    await escribirSesion(
      s.id, { bookingId: a, visitaId: plan.visitaDeSesion }, plan, a,
      { bookingId: de, visitaId: null, cancelada: false },
    );

    await logAudit({
      patientId: s.patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role, request,
      action: 'link_sesion_cita', resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: {
        tratamientoId: s.tratamientoId, numero: s.numero, bookingId: { from: de, to: a },
        ...(plan.visitaDeSesion ? { visitaId: { from: null, to: plan.visitaDeSesion } } : {}),
        motivo: 'cita reagendada',
      },
    });
    await auditarEfectosDeLigar(ctx, request, s.patientId, plan, a);

    return NextResponse.json({ success: true, movida: true, sesion });
  } catch (error) {
    return handleApiError(error, 'POST /api/appointments/reagendar-sesion');
  }
}
