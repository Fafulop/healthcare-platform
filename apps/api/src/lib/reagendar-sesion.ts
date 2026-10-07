import { logActivity } from '@/lib/activity-logger';
import {
  prisma, ligarSesionACitaNueva, pasarSesionAlReagendar, type ResultadoLigarNueva, type ResultadoReagendar,
} from '@healthcare/database';

/**
 * TRATAMIENTOS (T4) — reagendar = cancelar la cita vieja + crear la nueva (agenda y asistente). Las
 * rutas que crean la cita nueva reciben `reagendaDe` (el id de la vieja) y, JUNTO con el alta, la
 * sesión de tratamiento pasa a la cita nueva (`pasarSesionAlReagendar`, packages/database). Antes lo
 * hacía un segundo request del navegador, que podía no llegar (pestaña cerrada a la mitad).
 *
 * Sólo un DOCTOR autenticado reagendando una cita suya, o un ADMIN (`isRescheduled`): una reserva
 * pública nunca mueve sesiones. FALLA ABIERTO: crear la cita nunca depende de esto.
 *
 * V4 paso 2 (2026-10-02): la visita de la sesión, si es la de la cita vieja, viaja con ella en la
 * MISMA transacción (si no se puede mover, se deshace todo y la respuesta lo dice: `{ error: true }`).
 *
 * Devuelve lo que va en la respuesta como `sesionReagendada` (undefined = no aplica).
 */
export async function sesionAlReagendar(args: {
  reagendaDe: unknown;
  isRescheduled: unknown;
  /** El doctor dueño de la cita NUEVA. */
  doctorId: string;
  /** El doctor autenticado (null = petición pública o ADMIN). */
  callerDoctorId: string | null | undefined;
  bookingId: string;
  userId: string | null | undefined;
  role: string | null | undefined;
}): Promise<ResultadoReagendar | { error: true } | undefined> {
  const { reagendaDe, isRescheduled, doctorId, callerDoctorId, bookingId } = args;
  if (typeof reagendaDe !== 'string' || !reagendaDe || isRescheduled !== true) return undefined;
  const esAdmin = args.role === 'ADMIN';
  if (!esAdmin && (!callerDoctorId || callerDoctorId !== doctorId)) return undefined;
  try {
    return await prisma.$transaction((tx) =>
      pasarSesionAlReagendar(tx, {
        doctorId, deBookingId: reagendaDe, aBookingId: bookingId,
        userId: args.userId ?? 'unknown', userRole: args.role ?? 'unknown',
      }),
    );
  } catch (err) {
    console.error('[tratamientos] pasar la sesión a la cita reagendada falló (la cita sí se creó):', err);
    return { error: true };
  }
}

/**
 * TRATAMIENTOS T5 — «Agendar sesiones» crea cada cita por la MISMA ruta que la agenda
 * (`range-bookings/instant`) con `paraSesion`: aquí la cita recién creada se liga a su sesión
 * (`ligarSesionACitaNueva`, packages/database). Sólo un doctor autenticado de esa cita (o ADMIN).
 * FALLA ABIERTO: la cita ya existe; `{ error: true }` le dice a la pantalla que NO quedó ligada.
 */
export async function ligarSesionAlAgendar(args: {
  paraSesion: unknown;
  doctorId: string;
  callerDoctorId: string | null | undefined;
  bookingId: string;
  userId: string | null | undefined;
  role: string | null | undefined;
}): Promise<ResultadoLigarNueva | { error: true } | undefined> {
  const { paraSesion, doctorId, callerDoctorId, bookingId } = args;
  if (typeof paraSesion !== 'string' || !paraSesion) return undefined;
  if (args.role !== 'ADMIN' && (!callerDoctorId || callerDoctorId !== doctorId)) return undefined;
  try {
    return await prisma.$transaction((tx) =>
      ligarSesionACitaNueva(tx, {
        doctorId, sesionId: paraSesion, bookingId,
        userId: args.userId ?? 'unknown', userRole: args.role ?? 'unknown',
      }),
    );
  } catch (err) {
    console.error('[tratamientos] ligar la sesión a la cita agendada falló (la cita sí se creó):', err);
    return { error: true };
  }
}

/**
 * H-054 (2026-10-04) — reagendar = cancelar la vieja + crear la nueva, y «¿Necesita factura?» se
 * quedaba en la vieja. Aquí, al crear la nueva, se MUEVE (no se copia: la vieja cancelada con la
 * casilla en Sí seguía saliendo en «Por facturar» — dos pendientes para una sola consulta). Se mueve
 * la respuesta tal cual (Sí o No: el asistente distingue «no» de «sin contestar»).
 *
 * H-062 (2026-10-06) — y si la vieja YA ESTABA PAGADA (por link), el PAGO se va con ella: su ingreso
 * y su link pagado (Stripe / Mercado Pago) pasan a la cita nueva, que así se ve «Pagado» y al
 * completarla no se cobra otra vez (el ingreso existente ya lo impide). Antes el dinero se quedaba en
 * la vieja (cancelada) y el doctor tenía que completar la nueva en $0. La factura va CON el dinero:
 * si el pago se movió, la casilla se mueve con él; si no se pudo mover, se quedan juntos en la vieja
 * (moverla sola invitaría a emitir un segundo CFDI por el mismo pago). Todo sólo con el MISMO
 * expediente (no nulo: al reagendar se puede cambiar de paciente); el pago sólo si la nueva no trae
 * ya su propio ingreso o link; la casilla sólo si la nueva no trae su propio valor.
 *
 * Sirve en cualquier orden del cliente (la agenda crea y luego cancela; el asistente cancela y luego
 * crea), por eso la vieja puede estar ya CANCELLED.
 *
 * El LINK DE PAGO pendiente NO se mueve (decisión del usuario 2026-10-04, tras el code review): con el
 * reagendar repartido en dos peticiones de cliente en órdenes distintos, moverlo podía dejarlo en
 * otro paciente, en una cita sin expediente, o ya apagado (el asistente cancela primero). Al
 * cancelarse la vieja su link se APAGA (desactivar-link.ts) y el doctor crea uno en la nueva.
 *
 * Mismas reglas que `sesionAlReagendar`: sólo un DOCTOR autenticado reagendando una cita suya (o un
 * ADMIN). FALLA ABIERTO. Devuelve el valor movido (va en la respuesta como `facturaReagendada`).
 */
export async function pagoYFacturaAlReagendar(args: {
  reagendaDe: unknown;
  isRescheduled: unknown;
  doctorId: string;
  callerDoctorId: string | null | undefined;
  bookingId: string;
  role: string | null | undefined;
}): Promise<{ facturaSolicitada?: boolean; pagoMovido?: true } | undefined> {
  const { reagendaDe, isRescheduled, doctorId, callerDoctorId, bookingId } = args;
  if (typeof reagendaDe !== 'string' || !reagendaDe || isRescheduled !== true || reagendaDe === bookingId) return undefined;
  if (args.role !== 'ADMIN' && (!callerDoctorId || callerDoctorId !== doctorId)) return undefined;
  const resultado: { facturaSolicitada?: boolean; pagoMovido?: true } = {};

  // ── 1. The money (H-062), in its OWN transaction: a failure here must not undo the factura move. ──
  try {
    await prisma.$transaction(async (tx) => {
      const [vieja, nueva] = await Promise.all([
        tx.booking.findFirst({
          where: { id: reagendaDe, doctorId, status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] } },
          select: {
            patientId: true, status: true, cancelledAt: true, patientName: true,
            ledgerEntry: { select: { id: true, amount: true } },
            paymentLink: { select: { status: true } },
            mpPaymentPreference: { select: { status: true } },
          },
        }),
        tx.booking.findFirst({
          where: { id: bookingId, doctorId },
          select: {
            patientId: true,
            ledgerEntry: { select: { id: true } },
            paymentLink: { select: { id: true } },
            mpPaymentPreference: { select: { id: true } },
          },
        }),
      ]);
      if (!vieja?.ledgerEntry || !nueva || !vieja.patientId || vieja.patientId !== nueva.patientId) return;
      // Only a payment that came through a PAID link: anything else (a «⚠️ Revisar» payment on a
      // switched-off link) stays where it is for the doctor to review.
      if (vieja.paymentLink?.status !== 'PAID' && vieja.mpPaymentPreference?.status !== 'PAID') return;
      // Only a REAL reschedule: the old cita still active (agenda: create, then cancel) or cancelled
      // moments ago (assistant: cancel, then create) — never money parked on an old cancelled cita.
      if (vieja.status === 'CANCELLED' && (!vieja.cancelledAt || Date.now() - vieja.cancelledAt.getTime() > 15 * 60_000)) return;
      // Only into a cita with none of its own (all three are 1:1 with a cita).
      if (nueva.ledgerEntry || nueva.paymentLink || nueva.mpPaymentPreference) return;
      // Conditional on the income STILL being on the old cita: two reschedules of the same cita at
      // once must not split the income and the link across two new citas.
      const { count } = await tx.ledgerEntry.updateMany({
        where: { id: vieja.ledgerEntry.id, bookingId: reagendaDe },
        data: { bookingId },
      });
      if (count !== 1) return;
      await tx.paymentLink.updateMany({ where: { bookingId: reagendaDe, status: 'PAID' }, data: { bookingId } });
      await tx.mpPaymentPreference.updateMany({ where: { bookingId: reagendaDe, status: 'PAID' }, data: { bookingId } });
      resultado.pagoMovido = true;
      // Leave a trace (moving money between citas must be reconstructible).
      logActivity({
        doctorId,
        actionType: 'PAYMENT_MOVED',
        entityType: 'BOOKING',
        entityId: bookingId,
        displayMessage: `Pago de $${Number(vieja.ledgerEntry.amount)} pasado a la cita reagendada: ${vieja.patientName}`,
        icon: 'ArrowRightLeft',
        color: 'gray',
        metadata: { deCita: reagendaDe, aCita: bookingId, ledgerEntryId: vieja.ledgerEntry.id },
      });
    });
  } catch (err) {
    console.error('[reagendar] pasar el pago a la cita nueva falló (la cita sí se creó):', err);
  }

  // ── 2. «¿Necesita factura?» — always WITH the money. ──
  try {
    await prisma.$transaction(async (tx) => {
      const [vieja, nueva] = await Promise.all([
        tx.booking.findFirst({
          where: { id: reagendaDe, doctorId, status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] } },
          select: { facturaSolicitada: true, patientId: true, ledgerEntry: { select: { id: true } } },
        }),
        tx.booking.findFirst({ where: { id: bookingId, doctorId }, select: { patientId: true, facturaSolicitada: true } }),
      ]);
      if (!vieja || !nueva || vieja.facturaSolicitada === null) return;
      if (!vieja.patientId || vieja.patientId !== nueva.patientId) return;
      // The money stayed on the old cita: the flag stays with it (moving it alone invites a second
      // CFDI for the same payment).
      if (vieja.ledgerEntry) return;
      const valor = vieja.facturaSolicitada;
      if (nueva.facturaSolicitada === null) {
        // Conditional on both ends still as read: a concurrent edit wins, nothing half-moved.
        const { count } = await tx.booking.updateMany({
          where: { id: bookingId, facturaSolicitada: null },
          data: { facturaSolicitada: valor },
        });
        if (count > 0) resultado.facturaSolicitada = valor;
        else if (!resultado.pagoMovido) return;
      } else if (!resultado.pagoMovido) {
        return; // the new cita has its own answer and no money moved: leave both as they are
      }
      // Clear it on the old cita (moved, or the money left it): never two «Por facturar» for one consulta.
      await tx.booking.updateMany({ where: { id: reagendaDe, facturaSolicitada: valor }, data: { facturaSolicitada: null } });
    });
  } catch (err) {
    console.error('[reagendar] mover «¿Necesita factura?» a la cita nueva falló (la cita sí se creó):', err);
  }

  return resultado.pagoMovido || resultado.facturaSolicitada !== undefined ? resultado : undefined;
}
