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
 * NO se mueve si la vieja YA TIENE INGRESO (pagada por link; y sólo con ingreso puede estar
 * facturada): la factura va con el dinero, que se queda en la vieja — moverla invitaría a emitir un
 * segundo CFDI por el mismo pago. Sólo con el MISMO expediente (no nulo: al reagendar se puede
 * cambiar de paciente) y si la nueva no trae su propio valor.
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
export async function facturaAlReagendar(args: {
  reagendaDe: unknown;
  isRescheduled: unknown;
  doctorId: string;
  callerDoctorId: string | null | undefined;
  bookingId: string;
  role: string | null | undefined;
}): Promise<{ facturaSolicitada: boolean } | undefined> {
  const { reagendaDe, isRescheduled, doctorId, callerDoctorId, bookingId } = args;
  if (typeof reagendaDe !== 'string' || !reagendaDe || isRescheduled !== true || reagendaDe === bookingId) return undefined;
  if (args.role !== 'ADMIN' && (!callerDoctorId || callerDoctorId !== doctorId)) return undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      const [vieja, nueva] = await Promise.all([
        tx.booking.findFirst({
          where: { id: reagendaDe, doctorId, status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] } },
          select: { facturaSolicitada: true, patientId: true, ledgerEntry: { select: { id: true } } },
        }),
        tx.booking.findFirst({ where: { id: bookingId, doctorId }, select: { patientId: true, facturaSolicitada: true } }),
      ]);
      if (
        !vieja || !nueva ||
        vieja.facturaSolicitada === null ||
        vieja.ledgerEntry ||
        !vieja.patientId || vieja.patientId !== nueva.patientId ||
        nueva.facturaSolicitada !== null
      ) return undefined;
      const valor = vieja.facturaSolicitada;
      // Conditional on both ends still as read: a concurrent edit wins, nothing half-moved.
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, facturaSolicitada: null },
        data: { facturaSolicitada: valor },
      });
      if (count === 0) return undefined;
      await tx.booking.updateMany({
        where: { id: reagendaDe, facturaSolicitada: valor },
        data: { facturaSolicitada: null },
      });
      return { facturaSolicitada: valor };
    });
  } catch (err) {
    console.error('[reagendar] mover «¿Necesita factura?» a la cita nueva falló (la cita sí se creó):', err);
    return undefined;
  }
}
