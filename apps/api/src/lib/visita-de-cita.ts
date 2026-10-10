import { prisma, moverVisitaAlReagendar, syncVisitaForBooking } from '@healthcare/database';

/**
 * VISITAS 08-PLAN F2 — la cita NACE con su visita. Lo llaman las 4 rutas que crean citas
 * (`bookings`, `bookings/instant`, `range-bookings`, `range-bookings/instant`) al FINAL, después de
 * `sesionAlReagendar` y `ligarSesionAlAgendar` (que pueden traer a esta cita la visita de una sesión):
 *   1. reagendado (`reagendaDe`) → la visita de la cita vieja pasa a ésta (toda cita, no sólo sesiones);
 *   2. `syncVisitaForBooking` → si aún no tiene, nace la suya (sólo con expediente; la pública sin
 *      expediente la recibe al ligarlo).
 * FALLA ABIERTO: agendar nunca depende de la visita (si falla, la cita queda sin visita y se repara al
 * siguiente cambio de la cita, o al concluirla). Devuelve el id de la visita, si quedó una.
 */
export async function visitaDeCitaNueva(args: {
  bookingId: string;
  doctorId: string;
  reagendaDe?: unknown;
  isRescheduled?: unknown;
  /** El doctor de la sesión (DOCTOR) o null (público / admin). Sólo un doctor mueve la visita de su cita. */
  callerDoctorId?: string | null;
  userId?: string | null;
  role?: string | null;
}): Promise<string | undefined> {
  const quien = { userId: args.userId ?? 'system', userRole: args.role ?? 'system' };
  try {
    return await prisma.$transaction(async (tx) => {
      const puedeMover = typeof args.reagendaDe === 'string' && args.reagendaDe && args.isRescheduled === true
        && (args.role === 'ADMIN' || (!!args.callerDoctorId && args.callerDoctorId === args.doctorId));
      if (puedeMover) {
        await moverVisitaAlReagendar(tx, {
          doctorId: args.doctorId, deBookingId: args.reagendaDe as string, aBookingId: args.bookingId, ...quien,
        });
      }
      const r = await syncVisitaForBooking(tx, args.bookingId, { quien });
      return r.status === 'created' || r.status === 'updated' ? r.visitaId : undefined;
    });
  } catch (err) {
    console.error('[visitas] la visita de la cita nueva falló (la cita sí se creó):', err);
    return undefined;
  }
}
