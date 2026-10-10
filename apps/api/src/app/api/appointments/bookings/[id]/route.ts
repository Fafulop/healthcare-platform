// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status
// DELETE /api/appointments/bookings/[id] - Delete booking record

import { NextResponse } from 'next/server';
import { prisma, syncVisitaForBooking, visitaVacia } from '@healthcare/database';
import { sendPatientSMS, isSMSEnabled } from '@/lib/sms';
import { validateAuthToken, AuthError } from '@/lib/auth';
import {
  logBookingConfirmed,
  logBookingCancelled,
  logBookingCompleted,
  logBookingNoShow,
  logBookingDeleted,
} from '@/lib/activity-logger';
import { createSlotEvent, updateSlotEvent, deleteEvent, resolveTokens } from '@/lib/google-calendar';
import { getCalendarTokens } from '@/lib/appointments-utils';
import { findBookingOverlap } from '@/lib/booking-overlap';
import { createCitaLedgerEntry } from '@/lib/practice-utils';
import { timeToMinutes, minutesToTime } from '@/lib/availability-calculator';
import { sendAppointmentCancellationEmail } from '@/lib/gmail';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';
import { validatePatientLink, patientLinkGoneResponse } from '@/lib/patient-link';
import { desactivarLinks, desactivarLinksDeCita, hayQueDecirlo, linksVivosDeCita, type ResultadoDesactivar } from '@/lib/desactivar-link';

// Booking state machine transitions
// H-030: the agenda shows these messages to the doctor — states by their Spanish names.
const ESTADO_ES: Record<string, string> = {
  PENDING: 'pendiente', CONFIRMED: 'agendada', CANCELLED: 'cancelada', COMPLETED: 'completada', NO_SHOW: '«No asistió»',
};
// Own keys only: a status like 'constructor' must not pick up Object.prototype.
const estadoEs = (s: string) => (Object.prototype.hasOwnProperty.call(ESTADO_ES, s) ? ESTADO_ES[s] : s);

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  CANCELLED: [], // Terminal state
  COMPLETED: [], // Terminal state
  NO_SHOW: [], // Terminal state
};

// GET - Get booking by ID or confirmation code
//
// SECURITY (2026-09-25): this used to be fully PUBLIC and returned the whole row (patient
// name/email/phone/WhatsApp, notes, price, confirmationCode, reviewToken) for any booking id —
// and the confirmationCode is what an anonymous PATCH needs to CANCEL the booking.
//   - No session: lookup by CONFIRMATION CODE only, and only what the public cancel page renders
//     (apps/public/src/app/cancel-booking). Knowing the code already proves you are the patient.
//   - Session: the full row, by id or code, only for the booking's own doctor (or an ADMIN).
const DOCTOR_PUBLIC_SELECT = {
  doctorFullName: true,
  primarySpecialty: true,
  clinicAddress: true,
  clinicPhone: true,
  clinicWhatsapp: true,
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let auth: Awaited<ReturnType<typeof validateAuthToken>> | null = null;
    if (request.headers.get('authorization')) {
      try {
        auth = await validateAuthToken(request);
      } catch (err) {
        const status = err instanceof AuthError ? err.status : 401;
        return NextResponse.json(
          { success: false, error: status === 403 ? 'Forbidden' : 'Unauthorized' },
          { status }
        );
      }
    }

    if (!auth) {
      const booking = await prisma.booking.findUnique({
        where: { confirmationCode: id },
        select: {
          id: true,
          status: true,
          finalPrice: true,
          date: true,
          startTime: true,
          endTime: true,
          slot: { select: { date: true, startTime: true, endTime: true, duration: true } },
          doctor: { select: DOCTOR_PUBLIC_SELECT },
        },
      });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: booking });
    }

    // Try to find by ID first, then by confirmation code
    const include = { slot: true, doctor: { select: DOCTOR_PUBLIC_SELECT } } as const;
    let booking = await prisma.booking.findUnique({ where: { id }, include });
    if (!booking) {
      booking = await prisma.booking.findUnique({ where: { confirmationCode: id }, include });
    }

    // Another doctor's booking answers exactly like a missing one (no existence oracle).
    if (!booking || (auth.role !== 'ADMIN' && booking.doctorId !== auth.doctorId)) {
      return NextResponse.json(
        { success: false, error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'No se pudo cargar la cita',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update booking status OR extendedBlockMinutes OR patientId
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status: newStatus, extendedBlockMinutes, patientId, confirmationCode: bodyConfirmationCode, finalPrice, income, facturaSolicitada } = body;

    // ── Patient link update (no status change, no block change) ───────────────
    if (patientId !== undefined && newStatus === undefined && extendedBlockMinutes === undefined) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
      }

      // If linking (not unlinking), verify patient belongs to this doctor
      const patientLinkError = await validatePatientLink(patientId, booking.doctorId);
      if (patientLinkError) {
        return NextResponse.json(
          { success: false, error: patientLinkError.error },
          { status: patientLinkError.status }
        );
      }

      let updated;
      try {
        updated = await prisma.booking.update({
          where: { id },
          data: { patientId: patientId ?? null },
          select: { id: true, patientId: true },
        });
      } catch (err) {
        // GAP-1 race: patient deleted between the pre-check and the update
        const patientGone = patientLinkGoneResponse(err);
        if (patientGone) return patientGone;
        throw err;
      }

      // Propagate patientId to any existing formLink for this booking (fire-and-forget)
      prisma.appointmentFormLink.updateMany({
        where: { bookingId: id },
        data: { patientId: patientId ?? null },
      }).catch((err) => console.error('[formLink] patientId propagation failed:', err));

      // H7: keep the booking's income traceable — backfill the ledger entry's patient
      // identity on (re)link so patient-scoped queries and SAT RFC-matching see it.
      // On unlink only detach patientId (counterparty stays: it was true at income time).
      // Only booking-born entries (origin cita/webhook_pago) are touched — never SAT/manual.
      (async () => {
        const entry = await prisma.ledgerEntry.findUnique({
          where: { bookingId: id },
          select: { id: true, origin: true },
        });
        if (!entry || (entry.origin !== 'cita' && entry.origin !== 'webhook_pago')) return;
        if (patientId) {
          const patient = await prisma.patient.findUnique({
            where: { id: String(patientId) },
            select: { rfc: true, razonSocial: true },
          });
          // Full identity REWRITE (mirror of completeBooking), never a partial merge:
          // on a relink, leaving the previous patient's RFC behind would attach the new
          // patient's income to the old patient's CFDIs in SAT matching.
          await prisma.ledgerEntry.update({
            where: { id: entry.id },
            data: {
              patientId: String(patientId),
              counterpartyRfc: patient?.rfc ? patient.rfc.trim().toUpperCase().slice(0, 13) : null,
              counterpartyName:
                (patient?.razonSocial?.trim() || booking.patientName || '').slice(0, 300) || null,
            },
          });
        } else {
          await prisma.ledgerEntry.update({
            where: { id: entry.id },
            data: { patientId: null },
          });
        }
      })().catch((err) => console.error('[ledger] patient backfill failed:', err));

      // VISITAS D1b → 08-PLAN F2: re-ligar / desligar el expediente reconcilia la visita de la cita
      // (una cita viva o concluida recién ligada RECIBE su visita; una de otro paciente se suelta). Falla
      // ABIERTO: ligar el expediente nunca depende de la visita. En transacción: soltar/borrar la
      // visita vieja y crear la nueva van juntos o no va ninguno. Corre aunque el paciente no
      // cambie: re-enviar el mismo id REPARA una visita que falló al concluir.
      let visitaWarning = false;
      try {
        // `quien`: si la cita pasó a OTRO paciente, la sesión de tratamiento del anterior la suelta
        // (T4 G1b) y eso se audita a nombre de quien re-ligó.
        const r = await prisma.$transaction((tx) => syncVisitaForBooking(tx, id, {
          quien: { userId: auth.userId ?? 'unknown', userRole: callerRole },
        }));
        if (r.status === 'no_fecha') {
          console.warn(`[visitas] cita ${id} re-ligada SIN visita: ${r.status}`);
          visitaWarning = true;
        }
      } catch (err) {
        console.error('[visitas] visita sync on patient link failed (link saved anyway):', err);
        visitaWarning = true;
      }

      return NextResponse.json({ success: true, data: updated, ...(visitaWarning ? { visitaWarning: true } : {}) });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Extended block update (no status change) ──────────────────────────────
    if (extendedBlockMinutes !== undefined && newStatus === undefined) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { slot: true },
      });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
      }
      if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Solo se puede modificar el bloqueo en citas activas' },
          { status: 400 }
        );
      }

      const raw = extendedBlockMinutes === null ? null : Number(extendedBlockMinutes);
      // Treat 0 as clearing the block (same as null)
      const value = raw === 0 ? null : raw;
      if (value !== null && (isNaN(value) || value < 0)) {
        return NextResponse.json({ success: false, error: 'Valor de bloqueo inválido' }, { status: 400 });
      }

      // The extended block must not swallow an adjacent active booking — the booking
      // creation routes treat extendedBlockMinutes as a hard conflict window, so an
      // overlapping extension would manufacture the state they exist to prevent.
      if (value !== null) {
        const bStart = booking.slot?.startTime ?? booking.startTime;
        const bEnd = booking.slot?.endTime ?? booking.endTime;
        const bDate = booking.slot?.date ?? booking.date;
        if (bStart && bEnd && bDate) {
          const startMin = timeToMinutes(bStart);
          const blockEndMin = Math.max(timeToMinutes(bEnd), startMin + value);
          const conflict = await findBookingOverlap(prisma, {
            doctorId: booking.doctorId,
            date: bDate,
            startTime: bStart,
            endTime: minutesToTime(Math.min(blockEndMin, 24 * 60 - 1)),
            excludeBookingId: booking.id,
          });
          if (conflict) {
            return NextResponse.json(
              {
                success: false,
                error: `El bloqueo extendido se traslapa con otra cita (${conflict.startTime}–${conflict.endTime}). Reduce el bloqueo o mueve la otra cita.`,
              },
              { status: 409 }
            );
          }
        }
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { extendedBlockMinutes: value },
      });

      // GCal sync — update event end time to reflect the new block duration
      const gcalEventId = booking.slot?.googleEventId ?? booking.googleEventId;
      if (gcalEventId) {
        const startTime = booking.slot?.startTime ?? booking.startTime ?? '';
        const slotEndTime = booking.slot?.endTime ?? booking.endTime ?? '';
        const dateStr = booking.slot
          ? booking.slot.date.toISOString().split('T')[0]
          : booking.date?.toISOString().split('T')[0] ?? '';

        // Compute effective end time: startTime + extendedBlockMinutes, or revert to slot endTime
        let effectiveEndTime = slotEndTime;
        if (value !== null && startTime) {
          const [h, m] = startTime.split(':').map(Number);
          const totalMins = h * 60 + m + value;
          effectiveEndTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
        }

        getCalendarTokens(booking.doctorId).then(tokens => {
          if (!tokens) return;
          updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId, {
            id: booking.slot?.id ?? booking.id,
            date: dateStr,
            startTime,
            endTime: effectiveEndTime,
            isOpen: booking.slot?.isOpen ?? false,
            patientName: booking.patientName,
            bookingStatus: booking.status as 'PENDING' | 'CONFIRMED',
            patientPhone: booking.patientPhone,
            patientEmail: booking.patientEmail,
            patientNotes: booking.notes ?? undefined,
            finalPrice: booking.slot ? booking.slot.finalPrice.toNumber() : Number(booking.finalPrice),
          }).catch((err) => console.error('[GCal sync] updateSlotEvent (extendedBlock):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (extendedBlock):', err));
      }

      return NextResponse.json({ success: true, data: updated });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Price update ──────────────────────────────────────────────────────────
    if (finalPrice !== undefined && newStatus === undefined && extendedBlockMinutes === undefined && patientId === undefined) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
      }

      const newPrice = parseFloat(String(finalPrice));
      if (isNaN(newPrice) || newPrice < 0) {
        return NextResponse.json({ success: false, error: 'Precio inválido' }, { status: 400 });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { finalPrice: newPrice },
        select: { id: true, finalPrice: true },
      });

      return NextResponse.json({ success: true, data: updated });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── ¿Necesita factura? (casilla por cita) ─────────────────────────────────
    // Sin restricción de estado a propósito: una cita puede necesitar factura antes
    // (el paciente avisa al agendar) o después (lo pide al salir). Solo marca intención;
    // no toca dinero, ni el expediente, ni emite nada.
    if (
      facturaSolicitada !== undefined &&
      newStatus === undefined &&
      extendedBlockMinutes === undefined &&
      patientId === undefined &&
      finalPrice === undefined
    ) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Cita no encontrada' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
      }

      if (typeof facturaSolicitada !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'facturaSolicitada debe ser booleano' },
          { status: 400 }
        );
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { facturaSolicitada },
        select: { id: true, facturaSolicitada: true },
      });

      return NextResponse.json({ success: true, data: updated });
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: 'Falta el estado' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Try to authenticate. Doctors/admins can perform any valid transition.
    // Unauthenticated requests (patient self-cancellation) are only allowed for CANCELLED
    // status and must include the matching confirmationCode as proof of ownership.
    let callerRole: string | null = null;
    let callerDoctorId: string | null = null;
    let callerUserId: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
      callerDoctorId = auth.doctorId;
      callerUserId = auth.userId ?? null;
    } catch {}

    // Get current booking with slot
    const currentBooking = await prisma.booking.findUnique({
      where: { id },
      // `patient.email` porque el EXPEDIENTE manda sobre la copia de la cita para cualquier
      // envío al paciente (bitácora #30, decisión 2026-07-29) — aquí lo usa el correo de
      // CANCELACIÓN, que leía `patientEmail` a secas y por eso se saltaba las citas cuyo correo
      // solo vive en el expediente.
      include: { slot: true, patient: { select: { email: true } } },
    });

    if (!currentBooking) {
      return NextResponse.json(
        { success: false, error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    // Authorization
    if (!callerRole) {
      // Unauthenticated — only patient self-cancellation allowed, requires confirmationCode
      if (newStatus !== 'CANCELLED') {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
      }
      if (!bodyConfirmationCode || bodyConfirmationCode !== currentBooking.confirmationCode) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
      }
    } else if (callerRole === 'DOCTOR') {
      if (currentBooking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
      }
    } else if (callerRole !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No tienes permiso sobre esta cita' }, { status: 403 });
    }

    const currentStatus = currentBooking.status;

    // Validate state transition
    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transición no permitida: una cita ${estadoEs(currentStatus)} no puede pasar a ${estadoEs(newStatus)}`,
        },
        { status: 400 }
      );
    }

    const isTerminalStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(newStatus);
    const wasNotTerminal = !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(currentStatus);

    if (isTerminalStatus && wasNotTerminal) {
      // Cancel/complete/no-show: update booking status.
      // Gap A: if the booking was on a private slot (isPublic: false), clean up the now-orphaned slot.
      // We null out slotId first to prevent the cascade FK from deleting this booking record,
      // then delete the slot. This preserves the booking history (CANCELLED record stays).
      const isPrivateSlot = currentBooking.slot?.isPublic === false;

      let updatedBooking: any;
      if (isPrivateSlot) {
        // Private slot cleanup: null out slotId first to prevent cascade from deleting this booking,
        // then delete the now-orphaned slot. Applies to all terminal states (CANCELLED, COMPLETED, NO_SHOW).
        [updatedBooking] = await prisma.$transaction([
          prisma.booking.update({
            where: { id },
            data: {
              status: newStatus,
              slotId: null,
              ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
            },
          }),
          prisma.appointmentSlot.delete({ where: { id: currentBooking.slot!.id } }),
        ]);
      } else {
        // COMPLETED or NO_SHOW on a public slot: close the slot so it stops appearing in availability.
        // CANCELLED on a public slot: leave isOpen as-is so other patients can still book it.
        if ((newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') && currentBooking.slotId) {
          [updatedBooking] = await prisma.$transaction([
            prisma.booking.update({
              where: { id },
              data: { status: newStatus },
            }),
            prisma.appointmentSlot.update({
              where: { id: currentBooking.slotId },
              data: { isOpen: false },
            }),
          ]);
        } else {
          updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
              status: newStatus,
              ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
            },
          });
        }
      }

      // Resolve date/time from slot (slot-based) or directly from booking (freeform)
      const bookingDateStr = currentBooking.slot
        ? currentBooking.slot.date.toISOString().split('T')[0]
        : currentBooking.date?.toISOString().split('T')[0] ?? '';
      const bookingStartTime = currentBooking.slot?.startTime ?? currentBooking.startTime ?? '';

      // Log activity
      const bookingLogParams = {
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: bookingDateStr,
        time: bookingStartTime,
        confirmationCode: currentBooking.confirmationCode ?? undefined,
      };
      if (newStatus === 'CANCELLED') logBookingCancelled(bookingLogParams);
      else if (newStatus === 'COMPLETED') logBookingCompleted(bookingLogParams);
      else if (newStatus === 'NO_SHOW') logBookingNoShow(bookingLogParams);

      // Send cancellation email to patient (fire-and-forget)
      const destinatarioCancelacion =
        currentBooking.patient?.email?.trim() || currentBooking.patientEmail?.trim() || '';
      if (newStatus === 'CANCELLED' && destinatarioCancelacion) {
        (async () => {
          try {
            const doctor = await prisma.doctor.findUnique({
              where: { id: currentBooking.doctorId },
              select: {
                doctorFullName: true,
                primarySpecialty: true,
                clinicPhone: true,
                clinicAddress: true,
                user: {
                  select: {
                    email: true,
                    googleAccessToken: true,
                    googleRefreshToken: true,
                    googleTokenExpiry: true,
                  },
                },
              },
            });
            if (!doctor?.user?.googleAccessToken || !doctor.user.email) {
              console.warn('[Email] cancellation email skipped — doctor has no Google tokens for booking', id);
              return;
            }
            const { accessToken, refreshToken } = await resolveTokens(doctor.user);
            await sendAppointmentCancellationEmail(
              {
                patientName: currentBooking.patientName,
                patientEmail: destinatarioCancelacion,
                doctorName: doctor.doctorFullName,
                specialty: doctor.primarySpecialty,
                date: bookingDateStr,
                startTime: bookingStartTime,
                endTime: currentBooking.slot?.endTime ?? currentBooking.endTime ?? '',
                clinicPhone: doctor.clinicPhone,
                clinicAddress: doctor.clinicAddress,
              },
              accessToken,
              refreshToken,
              doctor.doctorFullName,
              doctor.user.email
            );
          } catch (err) {
            console.error('[Email] sendCancellationEmail failed:', err);
          }
        })();
      }

      // GCal sync — freeform bookings use booking.googleEventId; slot-based use slot.googleEventId
      const gcalEventId = currentBooking.slot?.googleEventId ?? currentBooking.googleEventId;

      if (newStatus === 'CANCELLED' && gcalEventId) {
        // Clear stale googleEventId from the public slot so a future booking creates a fresh event
        if (currentBooking.slotId && currentBooking.slot?.isPublic !== false) {
          prisma.appointmentSlot.update({
            where: { id: currentBooking.slotId },
            data: { googleEventId: null },
          }).catch((err) => console.error('[GCal sync] clear stale googleEventId (booking CANCELLED):', err));
        }
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId)
            .catch((err) => console.error('[GCal sync] deleteEvent (booking CANCELLED):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CANCELLED):', err));
      }

      if ((newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') && gcalEventId) {
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          const slot = currentBooking.slot;
          updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId, {
            id: slot?.id ?? currentBooking.id,
            date: bookingDateStr,
            startTime: bookingStartTime,
            endTime: slot?.endTime ?? currentBooking.endTime ?? '',
            isOpen: slot?.isOpen ?? false,
            patientName: currentBooking.patientName,
            bookingStatus: newStatus as 'COMPLETED' | 'NO_SHOW',
            patientPhone: currentBooking.patientPhone,
            patientEmail: currentBooking.patientEmail,
            patientNotes: currentBooking.notes ?? undefined,
            finalPrice: slot ? slot.finalPrice.toNumber() : Number(currentBooking.finalPrice),
          }).catch((err) => console.error('[GCal sync] updateSlotEvent (booking COMPLETED/NO_SHOW):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking COMPLETED/NO_SHOW):', err));
      }

      // ── Income as a server-side internal effect of completion ────────────────
      // Completing a cita is a `citas`-permitted action; recording its income must
      // proceed even for a secondary user without `flujo` (00-REQUISITOS §3.6). This
      // used to be a SECOND client POST to /practice-management/ledger (flujo-gated),
      // which 403'd for such members and silently dropped the income. Best-effort:
      // a failure here never fails the completion — same soft-warning semantics the
      // clients had, just surfaced via `ledgerWarning` instead of a failed request.
      let ledgerEntryId: number | undefined;
      let ledgerAlreadyExisted = false;
      let ledgerWarning = false;
      // TRATAMIENTOS v2 · V2 (2026-10-02): ya no hay paquetes — la cita de una sesión se cobra como
      // cualquier otra (su precio lo pre-llena la sesión, V1). El $0 «cubierta por el paquete» de T6
      // queda sólo en los movimientos viejos. Un solo movimiento por cita (`bookingId` es único).
      const montoNormal = income && typeof income.price === 'number' && income.price > 0 ? income.price : 0;
      if (newStatus === 'COMPLETED' && montoNormal > 0) {
        try {
          const result = await createCitaLedgerEntry({
            doctorId: currentBooking.doctorId,
            bookingId: currentBooking.id,
            amount: montoNormal,
            formaDePago: typeof income?.formaDePago === 'string' ? income.formaDePago : 'efectivo',
          });
          ledgerEntryId = result.id;
          ledgerAlreadyExisted = result.alreadyExisted;
        } catch (err) {
          console.error('[ledger] cita income creation failed (booking completed anyway):', err);
          ledgerWarning = true;
        }
      }

      // ── VISITAS D1: la visita de la cita concluida ──────────────────────────
      // Mismo punto y misma semántica que el cobro: efecto interno del servidor, así que
      // cubre los tres caminos que concluyen (agenda, agente, chat de citas). Falla ABIERTO:
      // concluir una cita nunca depende del expediente. `fechaHint` sale de `currentBooking`
      // (leído ANTES del update): en un slot privado el slot ya se borró arriba.
      // 08-PLAN F2: en TODO estado terminal, no sólo al concluir — cancelada / no asistió borra la
      // visita VACÍA y conserva la que tiene contenido (`syncVisitaForBooking`). Falla abierto igual.
      let visitaId: string | undefined;
      let visitaWarning = false;
      try {
        const r = await prisma.$transaction((tx) => syncVisitaForBooking(tx, currentBooking.id, {
          fechaHint: currentBooking.slot?.date ?? currentBooking.date ?? null,
          ...(callerUserId && callerRole ? { quien: { userId: callerUserId, userRole: callerRole } } : {}),
        }));
        if (r.status === 'created' || r.status === 'updated') visitaId = r.visitaId;
        else if (newStatus === 'COMPLETED' && (r.status === 'no_fecha' || r.status === 'booking_not_found')) {
          console.warn(`[visitas] cita ${currentBooking.id} concluida SIN visita: ${r.status}`);
          visitaWarning = true;
        }
      } catch (err) {
        console.error(`[visitas] reconciling the visita failed (status ${newStatus} saved anyway):`, err);
        if (newStatus === 'COMPLETED') visitaWarning = true;
      }

      // ── H-010 / H-054: a cita that ended takes its LIVE payment link down with it ──────────
      // Cancelled or no-show: always. Completed: only if the doctor declared a cobro (even if
      // writing it failed: they were paid; or $0 = cortesía) or the income already existed — a completion WITHOUT
      // income (only the legacy citas chat, /dashboard/appointments/v1, completes with no `income`) may be waiting on
      // precisely that link, and killing it would leave the cita with no way to be paid. Same point and semantics as the
      // income: a server-side effect, so it covers every path that ends a cita (agenda,
      // assistant, patient self-cancel). Never fails the status change. (A reschedule cancels the
      // old cita, so its pending link dies here too — it is NOT moved to the new one, see
      // `pagoYFacturaAlReagendar` in lib/reagendar-sesion.ts for why.)
      let links: ResultadoDesactivar | undefined;
      // `income` present = the doctor decided the cobro in «Completar cita» — including $0, a
      // CORTESÍA (H-029): nothing more to charge, so the link dies too. Absent = only the legacy
      // citas chat (/dashboard/appointments/v1) completes without income; there the link may be how
      // the patient still pays. (The assistant always sends a cobro > 0 or finds the income.)
      const cobrada =
        montoNormal > 0 ||
        (newStatus === 'COMPLETED' && !!income && typeof income.price === 'number' && income.price === 0) ||
        (newStatus === 'COMPLETED' &&
          !!(await prisma.ledgerEntry
            .findUnique({ where: { bookingId: currentBooking.id }, select: { id: true } })
            .catch(() => null)));
      if (newStatus !== 'COMPLETED' || cobrada) {
        links = await desactivarLinksDeCita(currentBooking.id, currentBooking.doctorId);
      }

      const statusMessages = {
        // H-030: the agenda shows this message as its toast — in Spanish.
        CANCELLED: 'Cita cancelada',
        COMPLETED: 'Cita completada',
        NO_SHOW: 'Cita marcada como «No asistió»',
      };

      return NextResponse.json({
        success: true,
        data: updatedBooking,
        message: statusMessages[newStatus as keyof typeof statusMessages],
        ...(ledgerEntryId !== undefined ? { ledgerEntryId } : {}),
        ...(ledgerAlreadyExisted ? { ledgerAlreadyExisted: true } : {}),
        ...(ledgerWarning ? { ledgerWarning: true } : {}),
        // Lo que de verdad se registró (para que la agenda y el asistente no afirmen otro monto).
        // Ausente = no se registró cobro nuevo.
        ...(newStatus === 'COMPLETED' && ledgerEntryId !== undefined && !ledgerAlreadyExisted
          ? { cobroRegistrado: { monto: montoNormal } }
          : {}),
        ...(visitaId !== undefined ? { visitaId } : {}),
        ...(visitaWarning ? { visitaWarning: true } : {}),
        // Links turned off with the cita; `fallidos` = the provider call failed, the link is still live.
        ...(links && hayQueDecirlo(links) ? { linksDesactivados: links } : {}),
      });
    }

    // Non-terminal status updates (PENDING → CONFIRMED)
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === 'CONFIRMED' && { confirmedAt: new Date() }),
      },
      include: {
        slot: {
          include: { location: { select: { address: true } } },
        },
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
          },
        },
      },
    });

    // 08-PLAN F2: la visita ya nació con la cita; esto REPARA si su creación falló (falla abierto).
    await prisma.$transaction((tx) => syncVisitaForBooking(tx, id, {
      ...(callerUserId && callerRole ? { quien: { userId: callerUserId, userRole: callerRole } } : {}),
    })).catch((err) => console.error('[visitas] reconciling the visita failed (status saved anyway):', err));

    // Freeform bookings (slotId=null): skip slot-dependent work but still send email, SMS, log, GCal.
    // Range-based public bookings are created as PENDING and confirmed here by the doctor.
    const slot = updatedBooking.slot;
    if (!slot) {
      const freeformDateStr = currentBooking.date?.toISOString().split('T')[0] ?? '';
      const freeformStartTime = currentBooking.startTime ?? '';

      if (newStatus === 'CONFIRMED') {
        // Activity log
        logBookingConfirmed({
          doctorId: currentBooking.doctorId,
          bookingId: currentBooking.id,
          patientName: currentBooking.patientName,
          date: freeformDateStr,
          time: freeformStartTime,
          confirmationCode: updatedBooking.confirmationCode ?? undefined,
        });

        // SMS notification
        isSMSEnabled().then(smsEnabled => {
          if (!smsEnabled) return;
          sendPatientSMS({
            patientName: updatedBooking.patientName,
            patientPhone: updatedBooking.patientPhone,
            doctorName: updatedBooking.doctor.doctorFullName,
            doctorPhone: updatedBooking.doctor.clinicPhone || undefined,
            date: currentBooking.date?.toISOString() ?? '',
            startTime: freeformStartTime,
            endTime: currentBooking.endTime ?? '',
            duration: currentBooking.duration ?? 60,
            finalPrice: Number(updatedBooking.finalPrice),
            confirmationCode: updatedBooking.confirmationCode ?? '',
            clinicAddress: updatedBooking.doctor.clinicAddress || undefined,
            specialty: updatedBooking.doctor.primarySpecialty || undefined,
            reviewToken: updatedBooking.reviewToken || undefined,
          }, 'CONFIRMED').catch(err => console.error('SMS confirmation (freeform CONFIRMED):', err));
        }).catch(() => {});

        // GCal sync (googleEventId lives on the booking itself)
        if (currentBooking.googleEventId) {
          getCalendarTokens(currentBooking.doctorId).then(tokens => {
            if (!tokens) return;
            updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, currentBooking.googleEventId!, {
              id: currentBooking.id,
              date: freeformDateStr,
              startTime: freeformStartTime,
              endTime: currentBooking.endTime ?? '',
              isOpen: false,
              patientName: updatedBooking.patientName,
              bookingStatus: 'CONFIRMED',
              patientPhone: updatedBooking.patientPhone,
              patientEmail: updatedBooking.patientEmail,
              patientNotes: updatedBooking.notes ?? undefined,
              finalPrice: Number(updatedBooking.finalPrice),
            }).catch(err => console.error('[GCal sync] updateSlotEvent (freeform CONFIRMED):', err));
          }).catch(err => console.error('[GCal sync] getCalendarTokens (freeform CONFIRMED):', err));
        }

        // Confirmation email
        sendBookingConfirmationEmail(updatedBooking.id).catch(err =>
          console.error('[Email] auto-send confirmation (freeform CONFIRMED):', err)
        );
      }

      return NextResponse.json({ success: true, data: updatedBooking, message: newStatus === 'CONFIRMED' ? 'Cita confirmada' : 'Estado de la cita actualizado' });
    }

    // Send confirmation SMS when status changes to CONFIRMED
    const smsEnabled = await isSMSEnabled();
    if (newStatus === 'CONFIRMED' && smsEnabled) {
      const smsDetails = {
        patientName: updatedBooking.patientName,
        patientPhone: updatedBooking.patientPhone,
        doctorName: updatedBooking.doctor.doctorFullName,
        doctorPhone: updatedBooking.doctor.clinicPhone || undefined,
        date: slot.date.toISOString(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        finalPrice: Number(updatedBooking.finalPrice),
        confirmationCode: updatedBooking.confirmationCode ?? '',
        clinicAddress: (slot.location?.address ?? updatedBooking.doctor.clinicAddress) || undefined,
        specialty: updatedBooking.doctor.primarySpecialty || undefined,
        reviewToken: updatedBooking.reviewToken || undefined,
      };

      // Send CONFIRMED SMS to patient
      sendPatientSMS(smsDetails, 'CONFIRMED').catch((error) =>
        console.error('SMS confirmation notification failed:', error)
      );

    }

    // Log activity for non-terminal status changes
    if (newStatus === 'CONFIRMED') {
      logBookingConfirmed({
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: slot.date.toISOString().split('T')[0],
        time: slot.startTime,
        confirmationCode: updatedBooking.confirmationCode ?? undefined,
      });
    }

    // Sync to Google Calendar (fire-and-forget), then auto-send confirmation email.
    // Email is chained after GCal sync so slot.googleEventId is persisted before
    // ensureMeetLink runs — prevents duplicate calendar events for TELEMEDICINA.
    getCalendarTokens(currentBooking.doctorId).then(async tokens => {
      if (!tokens) return;
      const dateStr = slot.date.toISOString().split('T')[0];

      // When confirming, check if any active tasks overlap this slot's time
      let conflictNote: string | undefined;
      if (newStatus === 'CONFIRMED') {
        const dayTasks = await prisma.task.findMany({
          where: {
            doctorId: currentBooking.doctorId,
            dueDate: slot.date,
            status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
          },
          select: { title: true, startTime: true, endTime: true },
        });
        const hit = dayTasks.find(t =>
          t.startTime && t.endTime &&
          t.startTime < slot.endTime &&
          t.endTime > slot.startTime
        );
        if (hit) {
          conflictNote = `⚠️ Conflicto: pendiente "${hit.title}"${hit.startTime ? ` a las ${hit.startTime}` : ''}`;
        }
      }

      const slotEventData = {
        id: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOpen: slot.isOpen,
        patientName: newStatus === 'CONFIRMED' ? updatedBooking.patientName : undefined,
        bookingStatus: newStatus as 'CONFIRMED' | 'PENDING',
        patientPhone: newStatus === 'CONFIRMED' ? updatedBooking.patientPhone : undefined,
        patientEmail: newStatus === 'CONFIRMED' ? updatedBooking.patientEmail : undefined,
        patientNotes: newStatus === 'CONFIRMED' ? (updatedBooking.notes ?? undefined) : undefined,
        conflictNote,
        finalPrice: slot.finalPrice.toNumber(),
      };

      if (slot.googleEventId) {
        // Event already exists — update it
        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, slotEventData)
          .catch((err) => console.error('[GCal sync] updateSlotEvent (booking CONFIRMED):', err));
      } else {
        // No event yet (regular slot) — create one now and persist the ID
        const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slotEventData);
        await prisma.appointmentSlot.update({
          where: { id: slot.id },
          data: { googleEventId: eventId },
        });
      }
    }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CONFIRMED):', err))
    .finally(() => {
      // Auto-send confirmation email after GCal sync (outside smsEnabled — always fires)
      if (newStatus === 'CONFIRMED') {
        sendBookingConfirmationEmail(updatedBooking.id).catch((err) =>
          console.error('[Email] auto-send confirmation (PATCH CONFIRMED):', err)
        );
      }
    });

    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Cita confirmada',
      PENDING: 'Cita regresada a pendiente',
    };

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: statusMessages[newStatus] || 'Estado de la cita actualizado',
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'No se pudo actualizar la cita',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete booking and its associated slot
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    // Doctors can only delete their own bookings
    if (role === 'DOCTOR' && booking.doctorId !== authenticatedDoctorId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    // VISITAS 08-PLAN F2: la cita y su visita son el mismo evento. Borrar la cita dejaba su visita SIN
    // cita (la FK pone `booking_id` en NULL) — a veces en el futuro. Con contenido clínico → 409: la
    // cita se queda (la UI sólo ofrece «Eliminar» en citas terminadas). Vacía → se borra con la cita.
    const visitaDeLaCita = await prisma.visita.findUnique({
      where: { bookingId: id }, select: { id: true, comentario: true },
    });
    if (visitaDeLaCita && !(await visitaVacia(prisma, visitaDeLaCita))) {
      return NextResponse.json(
        {
          success: false,
          error: 'La visita de esta cita tiene contenido (plantillas, notas, recetas, fotos, ventas o un comentario): la cita no se borra, para no dejar esa visita sin su cita.',
        },
        { status: 409 }
      );
    }
    const borrarVisitaVacia = visitaDeLaCita
      ? [prisma.visita.deleteMany({ where: { id: visitaDeLaCita.id, bookingId: id } })]
      : [];

    // H-010 / H-054: a deleted cita's live link would stay payable with NO cita behind it (its
    // booking_id goes NULL). Read them now (the delete nulls booking_id); turn them off only once
    // the delete succeeded — a failed delete must not leave a live cita with a dead link.
    const linksVivos = await linksVivosDeCita(booking.id, booking.doctorId).catch((err) => {
      console.error('[desactivar-link] could not read the links of the cita being deleted:', err);
      return null;
    });

    const slot = booking.slot;
    // GCal event ID lives on the booking (freeform) or on the slot (slot-based)
    const gcalEventId = booking.googleEventId ?? slot?.googleEventId ?? null;

    // Delete the GCal event (fire-and-forget)
    if (gcalEventId) {
      getCalendarTokens(booking.doctorId).then(tokens => {
        if (!tokens) return;
        deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId)
          .catch((err) => console.error('[GCal sync] deleteEvent (booking DELETE):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking DELETE):', err));
    }

    // (08-PLAN F2: la visita vacía de la cita se borra en la MISMA transacción que la cita.)
    if (!booking.slotId) {
      // Freeform booking (legacy) — just delete the record, nothing else to clean up.
      await prisma.$transaction([...borrarVisitaVacia, prisma.booking.delete({ where: { id } })]);
    } else if (slot?.isPublic === false) {
      // Gap A: private slot — delete booking first (satisfies FK), then delete the now-orphaned slot.
      await prisma.$transaction([
        ...borrarVisitaVacia,
        prisma.booking.delete({ where: { id } }),
        prisma.appointmentSlot.delete({ where: { id: slot.id } }),
      ]);
    } else {
      // Regular public slot — delete booking record; slot stays available for new bookings.
      // Clear the stale GCal event ID from the slot if it had one.
      await prisma.$transaction([
        ...borrarVisitaVacia,
        prisma.booking.delete({ where: { id } }),
        ...(slot?.googleEventId
          ? [prisma.appointmentSlot.update({ where: { id: booking.slotId }, data: { googleEventId: null } })]
          : []),
      ]);
    }

    const links: ResultadoDesactivar = linksVivos
      ? await desactivarLinks(booking.doctorId, linksVivos)
      : { desactivados: [], fallidos: [], imposibles: [], errorLectura: true };

    // H-032: leave a trace, like every other status change (fire-and-forget, as those).
    logBookingDeleted({
      doctorId: booking.doctorId,
      bookingId: booking.id,
      patientName: booking.patientName,
      date: slot ? slot.date.toISOString().split('T')[0] : booking.date?.toISOString().split('T')[0] ?? '',
      time: slot?.startTime ?? booking.startTime ?? '',
    });

    return NextResponse.json({
      success: true,
      message: 'Cita eliminada exitosamente',
      ...(hayQueDecirlo(links) ? { linksDesactivados: links } : {}),
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: 'No se pudo eliminar la cita' },
      { status: 500 }
    );
  }
}
