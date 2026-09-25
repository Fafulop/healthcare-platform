import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type SyncVisitaResult =
  | { status: 'created' | 'updated'; visitaId: string }
  /** La cita no existe (borrada en medio). */
  | { status: 'booking_not_found' }
  /** La cita no está concluida: su visita nace al concluir, no antes. */
  | { status: 'not_completed' }
  /** Sin expediente ligado: no hay de quién colgarla. Nace cuando se ligue. */
  | { status: 'no_patient' }
  /** Tiene paciente pero NO hay de dónde sacar el día. Anomalía: el llamador la reporta. */
  | { status: 'no_fecha' };

/**
 * VISITAS (fase 1, D1 + D1b) — deja la visita de una cita en el estado correcto.
 * Diseño: docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md §6.
 *
 * UNA sola implementación para los dos momentos que la afectan:
 *   · la cita pasa a COMPLETED (agenda, agente y chat de citas: los tres por el mismo PATCH);
 *   · se liga, re-liga o desliga el expediente de la cita.
 *
 * NO confía en lo que le pase el llamador: RE-LEE la cita de la base y reconcilia contra ella.
 * (Code review de D1: con el paciente copiado del llamador, re-ligar la cita dejaba la visita en
 * el expediente del paciente ANTERIOR, apuntando a la cita del nuevo.)
 *
 * Reglas:
 *   · Cita DESLIGADA (sin paciente) → su visita NO se toca. Desligar y volver a ligar al mismo
 *     paciente la encuentra intacta. (Un re-enganche "por paciente y día" se probó y se quitó en
 *     review: no distingue la visita que soltamos de la de una cita BORRADA o de OTRA cita del mismo
 *     día, y movía contenido clínico a la cita equivocada.)
 *   · Visita ligada a esta cita pero de OTRO paciente (se re-ligó):
 *       – vacía (sin hijos ni `comentario`) y automática (origen 'cita') → se BORRA: fue una liga
 *         equivocada, no un hecho;
 *       – con contenido, o creada a mano → se le quita la cita y se queda donde está, con su
 *         fecha. El contenido clínico NUNCA se mueve en silencio (y la BD lo impediría: los hijos
 *         tienen FK compuesta al paciente de la visita).
 *   · Cita concluida con paciente → visita de ese paciente. `upsert` sobre `booking_id` (único
 *     COMPLETO en la BD): no duplica con dos clics, desde el agente, ni en carrera.
 *   · Si ya existía para el mismo paciente → sólo se refresca su `fecha`.
 *   · Caso borde aceptado: A→B→A con contenido deja la visita de A SIN cita (en su expediente, con
 *     su contenido) y A recibe una nueva vacía. Nada se pierde ni se mueve; el doctor lo ve.
 *
 * Los llamadores la corren en `$transaction`: soltar/borrar la vieja y crear la nueva son un paso.
 *
 * Sin candado de fila a propósito: el choque real (concluir y re-ligar la MISMA cita en el mismo
 * milisegundo) no lo hace una persona, y un `FOR UPDATE` en el camino de TODAS las citas era más
 * riesgo que el caso. Si pasara, el barrido previo al lanzamiento lo corrige (02-PLAN §4).
 *
 * El llamador decide qué hacer si esto TRUENA; en la ruta de citas, FALLA ABIERTO.
 *
 * @param opts.fechaHint El día de la cita leído ANTES de concluir. Hace falta porque al concluir
 *   en un slot PRIVADO el slot se BORRA, y una cita de slot no tiene fecha propia: re-leída
 *   después, ya no tiene día. (Las rutas de alta guardan las fechas a MEDIODÍA UTC,
 *   `T12:00:00Z`, así que cortarlas a `@db.Date` en UTC da el día correcto.)
 */
export async function syncVisitaForBooking(
  db: Db,
  bookingId: string,
  opts: { fechaHint?: Date | null } = {},
): Promise<SyncVisitaResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, doctorId: true, patientId: true, status: true, date: true, slot: { select: { date: true } } },
  });
  if (!booking) return { status: 'booking_not_found' };

  let current = await db.visita.findUnique({
    where: { bookingId },
    select: { id: true, patientId: true, origen: true, fecha: true, comentario: true },
  });

  const fecha = booking.slot?.date ?? booking.date ?? opts.fechaHint ?? current?.fecha ?? null;

  // Visita de OTRO paciente colgada de esta cita → se suelta (o se borra si era sólo la liga).
  // Cita SIN paciente (se desligó) → la visita se deja tal cual: si se vuelve a ligar al mismo
  // paciente, sigue ahí y no se parte en dos.
  if (current && booking.patientId && current.patientId !== booking.patientId) {
    // Se cuenta SÓLO aquí (rama rara) y con `count` por hijo, que usa el índice de `visita_id`.
    // NO `_count` en el findUnique: Prisma lo arma como GROUP BY sobre las 5 tablas COMPLETAS,
    // y eso corría en cada cita concluida (lo mostró el SQL del smoke de D1).
    const w = { where: { visitaId: current.id } };
    const hijos = await Promise.all([
      db.clinicalEncounter.count(w), db.patientMedia.count(w), db.prescription.count(w),
      db.patientNote.count(w), db.medicalReport.count(w),
    ]);
    const vacia = hijos.every((n) => n === 0) && !current.comentario?.trim();
    if (vacia && current.origen === 'cita') {
      await db.visita.delete({ where: { id: current.id } });
    } else {
      await db.visita.update({ where: { id: current.id }, data: { bookingId: null } });
    }
    current = null;
  }

  if (booking.status !== 'COMPLETED') return { status: 'not_completed' };
  if (!booking.patientId) return { status: 'no_patient' };
  if (!fecha) return { status: 'no_fecha' };

  if (current) {
    if (current.fecha.toISOString().slice(0, 10) !== fecha.toISOString().slice(0, 10)) {
      await db.visita.update({ where: { id: current.id }, data: { fecha } });
    }
    return { status: 'updated', visitaId: current.id };
  }

  const visita = await db.visita.upsert({
    where: { bookingId },
    create: {
      patientId: booking.patientId,
      doctorId: booking.doctorId,
      fecha,
      bookingId,
      origen: 'cita',
    },
    update: { fecha },
    select: { id: true },
  });
  return { status: 'created', visitaId: visita.id };
}
