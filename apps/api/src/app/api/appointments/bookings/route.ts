// POST /api/appointments/bookings - Create a new booking
// GET /api/appointments/bookings - Get bookings (for doctor or admin)

import { NextResponse } from 'next/server';
import { prisma, resolveFacturaVerdict, buildSatStatusMap, satUuidQueryVariants } from '@healthcare/database';
import {
  sendPatientSMS,
  sendDoctorSMS,
  isSMSEnabled,
} from '@/lib/sms';
import { sendNewBookingTelegram, isTelegramConfigured } from '@/lib/telegram';
import { validateAuthToken } from '@/lib/auth';
import { logBookingCreated } from '@/lib/activity-logger';
import { createSlotEvent, updateSlotEvent } from '@/lib/google-calendar';
import { getCalendarTokens, generateConfirmationCode, generateReviewToken } from '@/lib/appointments-utils';
import { lockBookingDay, findBookingOverlap } from '@/lib/booking-overlap';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';
import { validatePatientLink, patientLinkGoneResponse } from '@/lib/patient-link';

// In-memory rate limiter for booking creation (per IP).
// Prevents SMS/email bombing via rapid booking requests.
const BOOKING_RATE_LIMIT = 10;       // max bookings per window
const BOOKING_RATE_WINDOW_MS = 60_000; // 1 minute
const bookingRateMap = new Map<string, { count: number; resetAt: number }>();

// Periodically purge expired entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of bookingRateMap) {
    if (now > entry.resetAt) bookingRateMap.delete(ip);
  }
}, BOOKING_RATE_WINDOW_MS);

function checkBookingRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = bookingRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    bookingRateMap.set(ip, { count: 1, resetAt: now + BOOKING_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= BOOKING_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// POST - Create a booking
export async function POST(request: Request) {
  try {
    // Rate limit unauthenticated booking requests by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Optional auth — doctors/admins get auto-confirmed bookings, public gets PENDING.
    let callerRole: string | null = null;
    let callerDoctorId: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
      callerDoctorId = auth.doctorId ?? null;
    } catch {}

    // Only rate-limit unauthenticated (public) requests
    if (!callerRole && !checkBookingRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      slotId,
      patientName,
      patientEmail,
      patientPhone,
      patientWhatsapp,
      notes,
      serviceId,
      isFirstTime,
      appointmentMode,
      isRescheduled,
      patientId,
    } = body;

    // Validation — basic type and format checks on public input
    if (!slotId || typeof slotId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'slotId is required' },
        { status: 400 }
      );
    }
    if (!patientName || typeof patientName !== 'string' || patientName.trim().length < 2 || patientName.length > 200) {
      return NextResponse.json(
        { success: false, error: 'patientName is required (2-200 characters)' },
        { status: 400 }
      );
    }
    if (patientEmail && (typeof patientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail))) {
      return NextResponse.json(
        { success: false, error: 'patientEmail must be a valid email address' },
        { status: 400 }
      );
    }
    if (patientPhone && (typeof patientPhone !== 'string' || patientPhone.length > 20)) {
      return NextResponse.json(
        { success: false, error: 'patientPhone must be at most 20 characters' },
        { status: 400 }
      );
    }
    if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json(
        { success: false, error: 'notes must be at most 2000 characters' },
        { status: 400 }
      );
    }

    // Pre-flight: verify slot exists and belongs to the right doctor (for service validation).
    // The critical availability check (isOpen, currentBookings) happens inside the transaction below.
    const slotForValidation = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
    });

    if (!slotForValidation) {
      return NextResponse.json(
        { success: false, error: 'Appointment slot not found' },
        { status: 404 }
      );
    }

    // Doctors can only book on their own agenda (same guard as range-bookings —
    // this legacy route lacked it: PR 2 tenancy audit 2026-07-08). Without it, a
    // doctor token targeting a foreign slot got autoConfirm (CONFIRMED + cutoff
    // skip) on another doctor's agenda. Public (no token) stays PENDING-for-anyone.
    // Full slots-model retirement is planned with PR 4's /v1 /v2 cleanup.
    if (callerRole === 'DOCTOR' && callerDoctorId !== slotForValidation.doctorId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado — solo puedes crear citas en tu propia agenda' },
        { status: 403 }
      );
    }

    // Fetch doctor booking field settings to determine which fields are required
    const isDoctor = callerRole === 'DOCTOR' || callerRole === 'ADMIN';
    const doctorFieldSettings = await prisma.doctor.findUnique({
      where: { id: slotForValidation.doctorId },
      select: {
        bookingPublicEmailRequired:      true,
        bookingPublicPhoneRequired:      true,
        bookingPublicWhatsappRequired:   true,
        bookingHorariosEmailRequired:    true,
        bookingHorariosPhoneRequired:    true,
        bookingHorariosWhatsappRequired: true,
      },
    });

    const emailRequired    = isDoctor
      ? (doctorFieldSettings?.bookingHorariosEmailRequired    ?? true)
      : (doctorFieldSettings?.bookingPublicEmailRequired      ?? true);
    const phoneRequired    = isDoctor
      ? (doctorFieldSettings?.bookingHorariosPhoneRequired    ?? true)
      : (doctorFieldSettings?.bookingPublicPhoneRequired      ?? true);
    const whatsappRequired = isDoctor
      ? (doctorFieldSettings?.bookingHorariosWhatsappRequired ?? true)
      : (doctorFieldSettings?.bookingPublicWhatsappRequired   ?? true);

    const missing = [
      emailRequired    && !patientEmail    ? 'patientEmail'    : null,
      phoneRequired    && !patientPhone    ? 'patientPhone'    : null,
      whatsappRequired && !patientWhatsapp ? 'patientWhatsapp' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Faltan campos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate service selection
    const doctorServicesCount = await prisma.service.count({
      where: { doctorId: slotForValidation.doctorId },
    });

    if (doctorServicesCount > 0 && !serviceId) {
      return NextResponse.json(
        { success: false, error: 'Por favor selecciona un servicio para continuar' },
        { status: 400 }
      );
    }

    let serviceName: string | null = null;
    let servicePrice: number = 0;
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, doctorId: slotForValidation.doctorId },
      });
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'El servicio seleccionado no es válido' },
          { status: 400 }
        );
      }
      serviceName = service.serviceName;
      servicePrice = Number(service.price) || 0;
    }

    // A provided patientId must reference a patient of the slot's doctor
    // (public callers get a uniform 404 — no existence/ownership oracle)
    const patientLinkError = await validatePatientLink(patientId, slotForValidation.doctorId, !!callerRole);
    if (patientLinkError) {
      return NextResponse.json(
        { success: false, error: patientLinkError.error },
        { status: patientLinkError.status }
      );
    }

    // Generate confirmation code and review token
    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    // Doctors/admins booking directly → CONFIRMED immediately (no pending review step).
    // Public portal bookings → PENDING until doctor confirms.
    const autoConfirm = callerRole === 'DOCTOR' || callerRole === 'ADMIN';
    const bookingStatus = autoConfirm ? 'CONFIRMED' : 'PENDING';

    // Create booking atomically: re-check availability INSIDE the transaction to prevent
    // race-condition double-booking (two concurrent requests seeing the same slot state).
    // The DB partial unique index on (slot_id) WHERE status is active is the final safety net.
    let booking: any;
    let slot: any;
    try {
      [booking, slot] = await prisma.$transaction(async (tx) => {
        const freshSlot = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
        if (!freshSlot) throw Object.assign(new Error('SLOT_NOT_FOUND'), { bookingError: true });
        if (!freshSlot.isPublic) throw Object.assign(new Error('SLOT_CLOSED'), { bookingError: true });
        if (!freshSlot.isOpen) throw Object.assign(new Error('SLOT_CLOSED'), { bookingError: true });

        // Serialize concurrent booking writes for this doctor+date (see booking-overlap.ts)
        await lockBookingDay(tx, freshSlot.doctorId, freshSlot.date.toISOString().split('T')[0]);

        // Freeform (range-based) bookings don't create slots, so the slot's own state
        // can't reflect them — reject if one occupies this slot's time window.
        const freeformConflict = await findBookingOverlap(tx, {
          doctorId: freshSlot.doctorId,
          date: freshSlot.date,
          startTime: freshSlot.startTime,
          endTime: freshSlot.endTime,
          freeformOnly: true,
        });
        if (freeformConflict) throw Object.assign(new Error('SLOT_CLOSED'), { bookingError: true });

        // For public bookings (not doctor/admin), reject slots that have already passed or
        // start within 1 hour of the current time in America/Mexico_City.
        if (!autoConfirm) {
          const nowMXStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
          const todayMX = nowMXStr.split(' ')[0];
          const slotDateKey = freshSlot.date.toISOString().split('T')[0];
          if (slotDateKey < todayMX) {
            throw Object.assign(new Error('SLOT_PAST'), { bookingError: true });
          }
          if (slotDateKey === todayMX) {
            const [h, m] = nowMXStr.split(' ')[1].slice(0, 5).split(':').map(Number);
            const cutoff = h * 60 + m + 60;
            const cutoffTime = cutoff >= 24 * 60
              ? '24:00'
              : `${String(Math.floor(cutoff / 60)).padStart(2, '0')}:${String(cutoff % 60).padStart(2, '0')}`;
            if (freshSlot.startTime <= cutoffTime) {
              throw Object.assign(new Error('SLOT_TOO_SOON'), { bookingError: true });
            }
          }
        }

        const b = await tx.booking.create({
          data: {
            slotId,
            doctorId: freshSlot.doctorId,
            patientName,
            patientEmail,
            patientPhone,
            patientWhatsapp,
            notes,
            serviceId: serviceId || null,
            serviceName,
            isFirstTime: isFirstTime ?? null,
            appointmentMode: appointmentMode || null,
            finalPrice: servicePrice,
            confirmationCode,
            reviewToken,
            status: bookingStatus,
            isRescheduled: isRescheduled === true,
            patientId: patientId || null,
            // 🔴 El consultorio se HEREDA del slot que se está reservando. `freshSlot`
            // ya viene completo del `findUnique` de arriba, así que el dato estaba en
            // la mano y se tiraba — igual que pasaba con el rango en `range-bookings`.
            //
            // ⚠️ Con PRECISIÓN, porque aquí sí hay un matiz: `slot.locationId` NO
            // siempre es una elección del doctor. `slots/route.ts` resuelve el slot
            // sin consultorio AL DEFAULT antes de crearlo, y el `create_slots` del
            // agente nunca manda uno — o sea que un doctor de dos sedes que crea
            // horarios por voz termina con slots que dicen su sede default sin que
            // él lo haya dicho.
            //
            // Aun así se hereda, y a propósito: `send-confirmation-email.ts` YA le
            // mandó al paciente la dirección de `slot.location`. O sea que esto no es
            // "donde el doctor eligió", es **la dirección que se le dio al paciente**,
            // que es justo lo que el doctor necesita ver para cacharla si está mal.
            // Guardar NULL aquí escondería el problema en vez de evitarlo.
            //
            // La ruta de al lado (`bookings/instant`) hace lo CONTRARIO —sólo guarda
            // lo explícito— porque ahí el slot se crea en la misma llamada y nadie le
            // ha dicho nada al paciente todavía.
            locationId: freshSlot.locationId,
            ...(autoConfirm && { confirmedAt: new Date() }),
          },
        });
        return [b, freshSlot];
      });
    } catch (txErr: any) {
      if (txErr?.bookingError) {
        const statusCode = txErr.message === 'SLOT_NOT_FOUND' ? 404 : 400;
        const msg =
          txErr.message === 'SLOT_NOT_FOUND' ? 'Appointment slot not found' :
          txErr.message === 'SLOT_PAST' ? 'Este horario ya pasó y no está disponible para reservar' :
          txErr.message === 'SLOT_TOO_SOON' ? 'Este horario ya no está disponible (menos de 1 hora de anticipación requerida)' :
          'This slot is not available for booking';
        return NextResponse.json({ success: false, error: msg }, { status: statusCode });
      }
      // DB unique index violation = slot already has an active booking
      if ((txErr as any)?.code === 'P2002') {
        return NextResponse.json({ success: false, error: 'This slot is fully booked' }, { status: 400 });
      }
      // P2028 = transaction timeout — advisory-lock waits under a booking burst count
      // toward it. Retriable, so return 503 instead of a generic 500.
      if ((txErr as any)?.code === 'P2028') {
        return NextResponse.json(
          { success: false, error: 'Hay muchas reservas en proceso en este momento. Intenta de nuevo en unos segundos.' },
          { status: 503 }
        );
      }
      // GAP-1 race: patient deleted between the pre-check and the create
      const patientGone = patientLinkGoneResponse(txErr);
      if (patientGone) return patientGone;
      throw txErr;
    }

    // Include slot details in response
    const bookingWithSlot = await prisma.booking.findUnique({
      where: { id: booking.id },
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
            clinicWhatsapp: true,
          },
        },
      },
    });

    // Sync to Google Calendar (fire-and-forget)
    getCalendarTokens(slot.doctorId).then(async tokens => {
      if (!tokens) return;
      const dateStr = slot.date.toISOString().split('T')[0];
      const slotEventData = {
        id: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOpen: slot.isOpen,
        patientName: autoConfirm ? patientName : `⏳ ${patientName}`,
        bookingStatus: bookingStatus as 'PENDING' | 'CONFIRMED',
        patientPhone: patientPhone,
        patientEmail: patientEmail,
        patientNotes: notes ?? undefined,
        finalPrice: Number(slot.finalPrice),
      };
      if (slot.googleEventId) {
        await updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, slotEventData);
      } else {
        // Create GCal event for any new booking (PENDING from public app or CONFIRMED from doctor)
        const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slotEventData);
        await prisma.appointmentSlot.update({ where: { id: slot.id }, data: { googleEventId: eventId } });
      }
    }).catch((err) => console.error('[GCal sync] booking POST:', err))
    .finally(() => {
      // Auto-send confirmation email when doctor books directly (autoConfirm).
      // Chained after GCal sync so googleEventId is persisted before ensureMeetLink runs (TELEMEDICINA).
      if (autoConfirm) {
        sendBookingConfirmationEmail(booking.id).catch((err) =>
          console.error('[Email] auto-send confirmation (booking POST):', err)
        );
      }
    });

    // Send SMS notifications (async, non-blocking)
    const smsEnabled = await isSMSEnabled();
    if (smsEnabled && bookingWithSlot?.slot) {
      const smsDetails = {
        patientName,
        patientPhone: patientPhone,
        doctorName: bookingWithSlot.doctor.doctorFullName,
        doctorPhone: bookingWithSlot.doctor.clinicPhone || undefined,
        date: bookingWithSlot.slot.date.toISOString(),
        startTime: bookingWithSlot.slot.startTime,
        endTime: bookingWithSlot.slot.endTime,
        duration: bookingWithSlot.slot.duration,
        finalPrice: Number(bookingWithSlot.finalPrice),
        confirmationCode,
        clinicAddress: (bookingWithSlot.slot?.location?.address ?? bookingWithSlot.doctor.clinicAddress) || undefined,
        specialty: bookingWithSlot.doctor.primarySpecialty || undefined,
        reviewToken,
      };

      // Send SMS to patient — CONFIRMED if doctor booked directly, PENDING if public portal.
      sendPatientSMS(smsDetails, bookingStatus as 'PENDING' | 'CONFIRMED').catch((error) =>
        console.error(`SMS patient notification (${bookingStatus}) failed:`, error)
      );

      // Send to doctor (don't await - let it run in background)
      sendDoctorSMS(smsDetails).catch((error) =>
        console.error('SMS doctor notification failed:', error)
      );

    }

    // Send Telegram notification to doctor for PENDING bookings (from public portal)
    if (bookingStatus === 'PENDING' && isTelegramConfigured()) {
      prisma.doctor.findUnique({
        where: { id: slot.doctorId },
        select: { telegramChatId: true, telegramNotifyBooking: true },
      }).then((doc) => {
        if (!doc?.telegramChatId || !doc.telegramNotifyBooking) return;
        return sendNewBookingTelegram(doc.telegramChatId, {
          patientName,
          patientPhone,
          serviceName: serviceName ?? null,
          date: slot.date.toISOString(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          confirmationCode,
        });
      }).catch((err) => console.error('Telegram notification failed:', err));
    }

    // Log activity (non-blocking)
    logBookingCreated({
      doctorId: slot.doctorId,
      bookingId: booking.id,
      patientName,
      patientEmail,
      patientPhone,
      date: slot.date.toISOString().split('T')[0],
      time: `${slot.startTime}-${slot.endTime}`,
      confirmationCode,
      finalPrice: servicePrice,
    });

    return NextResponse.json(
      {
        success: true,
        data: bookingWithSlot,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get bookings (filtered by doctor or email)
export async function GET(request: Request) {
  try {
    // Authenticate user
    const { email, role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const { searchParams } = new URL(request.url);
    const requestedDoctorId = searchParams.get('doctorId');
    const patientEmail = searchParams.get('patientEmail');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    // Authorization scoping: doctors can only see their own bookings
    if (role === 'ADMIN') {
      // Admins can filter by doctorId if provided, otherwise see all
      if (requestedDoctorId) {
        where.doctorId = requestedDoctorId;
      }
    } else if (role === 'DOCTOR') {
      // Doctors can ONLY see their own bookings
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Doctor profile not found for this user',
          },
          { status: 403 }
        );
      }

      // Force scope to authenticated doctor's ID only
      where.doctorId = authenticatedDoctorId;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - only doctors and admins can view bookings',
        },
        { status: 403 }
      );
    }

    if (patientEmail) {
      where.patientEmail = patientEmail;
    }

    if (status) {
      where.status = status;
    }

    // Date range filter — covers both slot-based (slot.date) and freeform (booking.date) bookings.
    // Use OR so freeform bookings aren't dropped when slot is null.
    if (startDate || endDate) {
      const dateFilter: any = startDate && endDate
        ? { gte: new Date(startDate), lte: new Date(endDate) }
        : startDate
        ? { gte: new Date(startDate) }
        : { lte: new Date(endDate!) };

      where.OR = [
        { slot: { date: dateFilter } },
        { slotId: null, date: dateFilter },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        slot: true,
        // El consultorio de la cita. ⚠️ `location` en null NO significa "el
        // consultorio por defecto": significa NO REGISTRADO (ver el comentario de
        // `Booking.locationId` en el schema). Las citas anteriores al 2026-08-06
        // no lo guardaron por ningún camino, así que la UI tiene que decir
        // "sin registrar" en vez de adivinar.
        location: { select: { id: true, name: true } },
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
          },
        },
        formLink: {
          select: {
            id: true,
            token: true,
            status: true,
            createdAt: true,
          },
        },
        patient: {
          select: {
            id: true,
            // Contacto VIVO del expediente. La copia de la cita solo se escribe al
            // agendar y nadie la actualiza después, así que la UI la usa de respaldo
            // para decidir si puede mandar la confirmación.
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            requiereFactura: true,
            rfc: true,
            razonSocial: true,
            regimenFiscal: true,
            usoCfdi: true,
            codigoPostalFiscal: true,
            // Enlace de DATOS FISCALES pendiente. Vive colgado del PACIENTE, no de la cita
            // (`bookingId` en NULL), así que no llega por `formLink` —que se resuelve por
            // bookingId— y la UI no tenía forma de saber que ya se había mandado uno: el
            // estado vivía en un useState y se perdía al refrescar.
            // ⚠️ El filtro por `templateId` es OBLIGATORIO: el formulario fiscal comparte tabla
            // con los formularios CLÍNICOS y se distingue solo por ese centinela. Olvidarlo es
            // exactamente el bug que hoy infla `formulariosPreConsulta` en el agente.
            formLinks: {
              where: { templateId: 'FISCAL', status: 'PENDING' },
              select: { id: true, token: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        paymentLink: {
          select: {
            id: true,
            stripePaymentLinkUrl: true,
            status: true,
            isActive: true,
            paidAt: true,
            amount: true,
          },
        },
        mpPaymentPreference: {
          select: {
            id: true,
            mpInitPoint: true,
            status: true,
            isActive: true,
            paidAt: true,
            amount: true,
          },
        },
        // ¿YA SE FACTURÓ esta cita? La respuesta NO vive en la cita ni en el paciente:
        // el CFDI cuelga del INGRESO (`Booking → LedgerEntry → cfdisEmitted/facturas`).
        //
        // ⚠️ El proxy tentador —`patient.requiereFactura && patient.rfc`, que es lo que
        // pinta `FiscalFormButton`— contesta OTRA pregunta: "¿ya tenemos su RFC?". Un
        // paciente CON RFC al que nunca se le facturó saldría como resuelto, y ésas son
        // justo las citas que el filtro existe para encontrar. Por eso el veredicto se
        // resuelve aquí —contra las CUATRO señales que registran una factura, ver
        // resolveFacturaVerdict— y no en el cliente a partir de datos que sólo se le
        // parecen.
        ledgerEntry: {
          select: {
            id: true,
            // El ingreso YA REGISTRADO de esta cita. Nace por dos caminos: el webhook de
            // un link pagado, o el propio "Completar". Si existe, `createCitaLedgerEntry`
            // devuelve `alreadyExisted` y DESCARTA la forma de pago y el monto que mande
            // el cliente (practice-utils.ts §idempotency) — así que el modal tiene que
            // MOSTRAR esto en vez de volver a preguntarlo.
            formaDePago: true,
            amount: true,
            // Las señales del veredicto de facturación. `cfdisEmitted` va SIN `where`
            // y SIN `take`: qué status cuenta lo decide resolveFacturaVerdict, y un
            // `take: 1` sobre la lista sin filtrar podría traerse justo la cancelada
            // y esconder la activa.
            cfdisEmitted: { select: { status: true } },
            // Factura SUBIDA a mano (PDF) y su XML — el doctor que factura por fuera
            // de la plataforma la registra así, y para él la cita SÍ está facturada.
            // `take: 1` en estas DOS: solo importa si hay ALGUNA, no cuántas.
            // (`cfdisEmitted`, arriba, va sin `take` a propósito — ahí el status
            // de cada una decide.)
            facturas: { select: { id: true }, take: 1 },
            facturasXml: { select: { id: true }, take: 1 },
            // Factura externa detectada vía SAT Descarga. Esta señal ANTES no se
            // miraba aquí y sí en el agente: una cita facturada por fuera salía en
            // "Por Facturar" y el asistente decía que ya estaba facturada.
            satCfdiUuid: true,
            // Para la clave del lookup del SAT (un uuid por doctor, ver abajo).
            doctorId: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Contraste de los uuids EXTERNOS contra el último sync del SAT (Vigente vs
    // Cancelado), en una sola consulta para toda la lista.
    const satUuids = Array.from(
      new Set(
        bookings
          .map((b) => b.ledgerEntry?.satCfdiUuid)
          .filter((u): u is string => !!u)
      )
    );
    // Acotado a los doctores de ESTAS citas (este GET también lo usa un ADMIN sin
    // `doctorId`, que ve las de todos) y a las dos variantes de case del uuid.
    // Un uuid NO identifica una sola fila: `SatCfdiMetadata` es
    // `@@unique([doctorId, uuid])` y los satStatus de dos doctores pueden
    // discrepar —el fallback por XML del worker escribe 'Vigente' a ciegas—, así
    // que la clave del mapa lleva el doctor y aquí no gana una fila ajena.
    const satDoctorIds = Array.from(
      new Set(bookings.map((b) => b.ledgerEntry?.doctorId).filter((d): d is string => !!d))
    );
    const satStatusByUuid = satUuids.length > 0
      ? buildSatStatusMap(
          await prisma.satCfdiMetadata.findMany({
            where: { doctorId: { in: satDoctorIds }, uuid: { in: satUuidQueryVariants(satUuids) } },
            select: { doctorId: true, uuid: true, satStatus: true },
          })
        )
      : undefined;

    // Se manda el VEREDICTO, no las señales sueltas: el cliente no tiene por qué volver
    // a derivar "qué cuenta como facturada" — esa regla vive en un solo sitio (regla 0),
    // y desde 2026-08 ese sitio es `resolveFacturaVerdict` en @healthcare/database, que
    // comparten esta ruta y la del expediente (antes cada una miraba un subconjunto
    // distinto de las mismas tres señales).
    // Sin `ledgerEntry` (cita que nunca generó ingreso) ⇒ no facturada.
    const data = bookings.map(({ ledgerEntry, ...booking }) => ({
      ...booking,
      facturada: resolveFacturaVerdict(ledgerEntry, satStatusByUuid).facturada,
      // `null` = no hay ingreso registrado ⇒ completar lo va a CREAR con lo que capture
      // el doctor. Presente = ya existe ⇒ completar NO lo toca, y estos son los valores
      // reales que quedaron guardados (no `finalPrice`, que es sólo el precio de lista).
      ingreso: ledgerEntry
        ? { formaDePago: ledgerEntry.formaDePago, amount: Number(ledgerEntry.amount) }
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
