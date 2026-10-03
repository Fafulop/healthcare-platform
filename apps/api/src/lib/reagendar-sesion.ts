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
