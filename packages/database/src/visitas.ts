import type { Prisma, PrismaClient } from '@prisma/client';
import { guardarVisitaEnSesion, soltarSesionDeOtroPaciente, type QuienAudita } from './tratamientos';

type Db = PrismaClient | Prisma.TransactionClient;

export type SyncVisitaResult =
  | { status: 'created' | 'updated'; visitaId: string }
  /** La cita no existe (borrada en medio). */
  | { status: 'booking_not_found' }
  /** 08-PLAN F2: cita cancelada / no asistió — su visita VACÍA se borró. */
  | { status: 'deleted' }
  /** 08-PLAN F2: cita cancelada / no asistió — su visita tiene contenido y se QUEDA (con la cita cancelada). */
  | { status: 'kept'; visitaId: string }
  /** 08-PLAN F2: cita cancelada / no asistió sin visita: nada que hacer. */
  | { status: 'none' }
  /** Sin expediente ligado: no hay de quién colgarla. Nace cuando se ligue. */
  | { status: 'no_patient' }
  /** Tiene paciente pero NO hay de dónde sacar el día. Anomalía: el llamador la reporta. */
  | { status: 'no_fecha' };

/**
 * 08-PLAN F2 — ¿la visita está VACÍA? Sin plantillas, fotos, recetas, notas, informes, ventas ni
 * comentario: la misma regla que «Borrar visita» (que además mira las ventas). Una vacía se puede
 * borrar sin perder nada; una con algo, NUNCA se borra sola. `count` por hijo (usa el índice de
 * `visita_id`), no `_count` (Prisma lo arma como GROUP BY sobre las tablas COMPLETAS — smoke de D1).
 */
export async function visitaVacia(db: Db, visita: { id: string; comentario: string | null }): Promise<boolean> {
  if (visita.comentario?.trim()) return false;
  const w = { where: { visitaId: visita.id } };
  const n = await Promise.all([
    db.clinicalEncounter.count(w), db.patientMedia.count(w), db.prescription.count(w),
    db.patientNote.count(w), db.medicalReport.count(w), db.sale.count(w),
  ]);
  return n.every((x) => x === 0);
}

/**
 * VISITAS (fase 1, D1 + D1b) — deja la visita de una cita en el estado correcto.
 * Diseño: docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md §6.
 *
 * 08-PLAN F2 (2026-10-09): ya no sólo al concluir — RECONCILIA en cada momento que afecta a la cita:
 *   · se CREA la cita (las 4 rutas de alta de apps/api, al final, tras mover lo que se reagenda);
 *   · cambia su estado (agenda, agente, chat de citas y el paciente con su liga: todos por el PATCH);
 *   · se liga, re-liga o desliga el expediente de la cita.
 * Pendiente / Agendada / Completada con expediente ⇒ tiene su visita. Cancelada / No asistió ⇒ su
 * visita vacía se borra; con contenido se queda.
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
 *   · Cita viva o concluida con paciente → visita de ese paciente. `upsert` sobre `booking_id` (único
 *     COMPLETO en la BD): no duplica con dos clics, desde el agente, ni en carrera.
 *   · Si ya existía para el mismo paciente → sólo se refresca su `fecha`.
 *   · Caso borde aceptado: A→B→A con contenido deja la visita de A SIN cita (en su expediente, con
 *     su contenido) y A recibe una nueva vacía. Nada se pierde ni se mueve; el doctor lo ve.
 *
 * Los llamadores la corren en `$transaction`: soltar/borrar la vieja y crear la nueva son un paso.
 *
 * Sin candado de fila a propósito: el choque real (concluir y re-ligar la MISMA cita en el mismo
 * milisegundo) no lo hace una persona, y un `FOR UPDATE` en el camino de TODAS las citas era más
 * riesgo que el caso. Si pasara, lo detecta el CONTEO de reparación (VISITAS SESSION-REFRESCO §3):
 * sólo se midió (0/0/0 al lanzar, 2026-09-29); no existe un script que lo corrija solo.
 *
 * El llamador decide qué hacer si esto TRUENA; en la ruta de citas, FALLA ABIERTO.
 *
 * TRATAMIENTOS (T4): en la MISMA transacción, la sesión de tratamiento de la cita sigue a la cita —
 * si la cita se re-liga a OTRO paciente, la sesión del anterior la suelta (G1b); si nace la visita,
 * la sesión de ese paciente la guarda (P2). `opts.quien` es para auditar el primer caso.
 *
 * @param opts.fechaHint El día de la cita leído ANTES de concluir. Hace falta porque al concluir
 *   en un slot PRIVADO el slot se BORRA, y una cita de slot no tiene fecha propia: re-leída
 *   después, ya no tiene día. (Las rutas de alta guardan las fechas a MEDIODÍA UTC,
 *   `T12:00:00Z`, así que cortarlas a `@db.Date` en UTC da el día correcto.)
 */
export async function syncVisitaForBooking(
  db: Db,
  bookingId: string,
  opts: { fechaHint?: Date | null; quien?: QuienAudita } = {},
): Promise<SyncVisitaResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, doctorId: true, patientId: true, status: true, date: true, slot: { select: { date: true } } },
  });
  if (!booking) return { status: 'booking_not_found' };

  await soltarSesionDeOtroPaciente(db, booking, opts.quien);

  let current = await db.visita.findUnique({
    where: { bookingId },
    select: { id: true, patientId: true, origen: true, fecha: true, comentario: true },
  });

  const fecha = booking.slot?.date ?? booking.date ?? opts.fechaHint ?? current?.fecha ?? null;

  // Visita de OTRO paciente colgada de esta cita → se suelta (o se borra si era sólo la liga).
  // Cita SIN paciente (se desligó) → la visita se deja tal cual: si se vuelve a ligar al mismo
  // paciente, sigue ahí y no se parte en dos.
  if (current && booking.patientId && current.patientId !== booking.patientId) {
    if (current.origen === 'cita' && await visitaVacia(db, current)) {
      await db.visita.delete({ where: { id: current.id } });
    } else {
      await db.visita.update({ where: { id: current.id }, data: { bookingId: null } });
    }
    current = null;
  }

  if (!booking.patientId) return { status: 'no_patient' };

  // 08-PLAN F2 (2026-10-09): la cita NACE con su visita — no sólo al concluir. Cancelada / no
  // asistió: su visita vacía se borra (nada se pierde) y la que tiene contenido se QUEDA con su cita
  // cancelada (lo clínico nunca se borra solo). Los estados terminales no regresan (VALID_TRANSITIONS).
  if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
    if (!current) return { status: 'none' };
    if (await visitaVacia(db, current)) {
      await db.visita.delete({ where: { id: current.id } });
      return { status: 'deleted' };
    }
    return { status: 'kept', visitaId: current.id };
  }

  if (!fecha) return { status: 'no_fecha' };

  if (current) {
    if (current.fecha.toISOString().slice(0, 10) !== fecha.toISOString().slice(0, 10)) {
      await db.visita.update({ where: { id: current.id }, data: { fecha } });
    }
    await guardarVisitaEnSesion(db, booking, current.id);
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
  await guardarVisitaEnSesion(db, booking, visita.id);
  return { status: 'created', visitaId: visita.id };
}

/**
 * 08-PLAN F2 — reagendar = crear la cita NUEVA (con `reagendaDe`) y luego cancelar la VIEJA. Para TODA
 * cita (no sólo sesiones: ésas las mueve antes `pasarSesionAlReagendar`), la visita de la vieja pasa a
 * la nueva con la fecha de la nueva — así lo que el doctor ya subió no se queda en la cita cancelada.
 * Lo de adentro (plantillas, notas, fotos, recetas, ventas) conserva su propia fecha.
 *
 * Sólo el caso limpio: la vieja sigue viva (Pendiente / Agendada), es del MISMO doctor y paciente que la
 * nueva, la nueva nació como reagendado y AÚN no tiene visita. Escritura condicionada (la visita sigue en
 * la vieja). Corre ANTES de `syncVisitaForBooking` de la nueva (si no, la nueva ya tendría la suya y el
 * índice único de `booking_id` lo impediría). Devuelve el id de la visita movida, o null.
 */
export async function moverVisitaAlReagendar(
  db: Db, args: { doctorId: string; deBookingId: string; aBookingId: string } & QuienAudita,
): Promise<string | null> {
  const { doctorId, deBookingId, aBookingId } = args;
  if (!deBookingId || deBookingId === aBookingId) return null;
  const [vieja, nueva] = await Promise.all([
    db.booking.findFirst({
      where: { id: deBookingId, doctorId },
      select: { status: true, patientId: true, visita: { select: { id: true } } },
    }),
    db.booking.findFirst({
      where: { id: aBookingId, doctorId },
      select: { patientId: true, isRescheduled: true, date: true, slot: { select: { date: true } }, visita: { select: { id: true } } },
    }),
  ]);
  if (!vieja?.visita || !nueva || nueva.visita || !nueva.isRescheduled) return null;
  if (vieja.status !== 'PENDING' && vieja.status !== 'CONFIRMED') return null;
  if (!vieja.patientId || vieja.patientId !== nueva.patientId) return null;

  const fecha = nueva.slot?.date ?? nueva.date ?? null;
  const { count } = await db.visita.updateMany({
    where: { id: vieja.visita.id, bookingId: deBookingId, patientId: vieja.patientId, doctorId },
    data: { bookingId: aBookingId, ...(fecha ? { fecha } : {}) },
  });
  if (count === 0) return null;
  await db.patientAuditLog.create({
    data: {
      patientId: vieja.patientId, doctorId, userId: args.userId, userRole: args.userRole,
      action: 'update_visita', resourceType: 'visita', resourceId: vieja.visita.id,
      changes: {
        bookingId: { from: deBookingId, to: aBookingId },
        ...(fecha ? { fecha: fecha.toISOString().slice(0, 10) } : {}),
        motivo: 'su cita se reagendó',
      },
    },
  });
  return vieja.visita.id;
}
