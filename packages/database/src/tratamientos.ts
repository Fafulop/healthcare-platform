import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * TRATAMIENTOS (fase 2, T4) — lo que la AGENDA y las rutas de citas de `apps/api` le hacen a una
 * sesión de tratamiento. Vive aquí (no en `apps/doctor/src/lib/tratamientos.ts`) porque lo usan
 * `apps/api` (crear / concluir / re-ligar citas) y `apps/doctor` (la tarjeta del asistente).
 * Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §5.
 */

/** Quién hizo el cambio, para la auditoría (NOM-024). */
export interface QuienAudita { userId: string; userRole: string }

export type MotivoNoSeMueve = 'sesion_cancelada' | 'sesion_con_visita';

/**
 * Reagendar: ¿la sesión pasa SOLA a la cita nueva? Sólo en el caso limpio. Una regla, un lugar: la
 * usan las rutas que crean la cita nueva y la tarjeta del asistente (que le dice al doctor lo que va
 * a pasar ANTES de confirmar). null = sí se mueve.
 */
export function motivoNoSeMueve(s: { cancelada: boolean; visitaId: string | null }): MotivoNoSeMueve | null {
  if (s.cancelada) return 'sesion_cancelada';
  if (s.visitaId) return 'sesion_con_visita';
  return null;
}

export type ResultadoReagendar =
  /** La cita vieja no era de ninguna sesión (lo común) — o era de una sesión de OTRO paciente (G1). */
  | { movida: false; motivo: 'sin_sesion' }
  | {
      movida: boolean;
      motivo?: MotivoNoSeMueve | 'cita_nueva_invalida' | 'cambio';
      sesion: { tratamientoId: string; nombre: string; numero: number; sesionesPlaneadas: number | null };
    };

/**
 * La sesión de la cita VIEJA pasa a la cita NUEVA de un reagendado. La llaman las rutas de `apps/api`
 * que crean la cita nueva cuando reciben `reagendaDe` (agenda y asistente lo mandan): así el paso va
 * pegado al reagendado, no a un segundo request del navegador.
 *
 * Sólo el caso limpio: la nueva es del MISMO doctor y paciente que la sesión, nació como reagendado
 * (`isRescheduled`) y está activa; la sesión no está cancelada ni guarda visita (si la tiene, decidir
 * qué pasa con ella es del doctor, en el tratamiento). Se escribe sólo si la sesión SIGUE en la cita
 * vieja. Audita en el expediente del paciente.
 *
 * ⚠️ NO exige que la vieja esté CANCELADA (la ruta vieja del navegador sí lo exigía): la agenda
 * crea la nueva ANTES de cancelar la vieja, así que en este momento la vieja sigue viva. Si luego
 * la cancelación falla, la agenda lo avisa (hay dos citas vivas y la sesión ya está en la nueva).
 *
 * NO lanza por reglas: devuelve `{ movida: false, motivo }`. El llamador FALLA ABIERTO si truena.
 */
export async function pasarSesionAlReagendar(
  db: Db,
  args: { doctorId: string; deBookingId: string; aBookingId: string } & QuienAudita,
): Promise<ResultadoReagendar> {
  const { doctorId, deBookingId, aBookingId } = args;
  if (!deBookingId || deBookingId === aBookingId) return { movida: false, motivo: 'sin_sesion' };

  const s = await db.tratamientoSesion.findFirst({
    where: { doctorId, bookingId: deBookingId },
    select: {
      id: true, patientId: true, numero: true, cancelada: true, visitaId: true, tratamientoId: true,
      tratamiento: { select: { nombre: true, sesionesPlaneadas: true } },
      booking: { select: { patientId: true } },
    },
  });
  if (!s || s.booking?.patientId !== s.patientId) return { movida: false, motivo: 'sin_sesion' };

  const sesion = {
    tratamientoId: s.tratamientoId, nombre: s.tratamiento.nombre, numero: s.numero,
    sesionesPlaneadas: s.tratamiento.sesionesPlaneadas,
  };
  const motivo = motivoNoSeMueve(s);
  if (motivo) return { movida: false, motivo, sesion };

  const nueva = await db.booking.findFirst({
    where: { id: aBookingId, doctorId },
    select: { patientId: true, status: true, isRescheduled: true, tratamientoSesion: { select: { id: true } } },
  });
  if (
    !nueva || !nueva.isRescheduled || nueva.patientId !== s.patientId
    || (nueva.status !== 'PENDING' && nueva.status !== 'CONFIRMED') || nueva.tratamientoSesion
  ) {
    return { movida: false, motivo: 'cita_nueva_invalida', sesion };
  }

  const { count } = await db.tratamientoSesion.updateMany({
    where: { id: s.id, bookingId: deBookingId, cancelada: false, visitaId: null },
    data: { bookingId: aBookingId },
  });
  if (count === 0) return { movida: false, motivo: 'cambio', sesion };

  await db.patientAuditLog.create({
    data: {
      patientId: s.patientId, doctorId, userId: args.userId, userRole: args.userRole,
      action: 'link_sesion_cita', resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: {
        tratamientoId: s.tratamientoId, numero: s.numero,
        bookingId: { from: deBookingId, to: aBookingId }, motivo: 'cita reagendada',
      },
    },
  });
  return { movida: true, sesion };
}

/**
 * T6 — ¿Esta cita es una sesión CUBIERTA por el paquete de su tratamiento? Una regla, un lugar: la
 * usan concluir la cita (el cobro es $0 «cubierta por el paquete» o el extra), los links de pago
 * (bloqueados) y el GET de la agenda (para que el modal de completar no pida precio).
 * Cubierta = sesión de ESE paciente (la cita no se re-ligó), NO cancelada, de un tratamiento con
 * precio de paquete, y SIN un link de pago activo o pagado. Sin precio de paquete el doctor cobra por
 * sesión como siempre → null.
 *
 * ⚠️ El link: si la cita ya tenía un link de pago (creado antes de poner el precio, o antes de ligarla
 * a la sesión), tratarla como cubierta escribiría un $0 que OCUPA el único movimiento de la cita
 * (`bookingId` es único) — y el pago del link, al llegar, se perdería. Con link, la cita conserva su
 * cobro normal (lo pagado por el link). Desde que hay paquete, los links nuevos se bloquean.
 */
export function linkDePagoVivo(b: {
  paymentLink?: { isActive: boolean; status: string } | null;
  mpPaymentPreference?: { isActive: boolean; status: string } | null;
} | null | undefined): boolean {
  const vivo = (l?: { isActive: boolean; status: string } | null) => !!l && (l.isActive || l.status === 'PAID');
  return vivo(b?.paymentLink) || vivo(b?.mpPaymentPreference);
}

export async function paqueteDeCita(
  db: Db, bookingId: string,
): Promise<{ tratamientoId: string; nombre: string } | null> {
  const s = await db.tratamientoSesion.findFirst({
    where: { bookingId },
    select: {
      patientId: true, cancelada: true,
      booking: {
        select: {
          patientId: true,
          paymentLink: { select: { isActive: true, status: true } },
          mpPaymentPreference: { select: { isActive: true, status: true } },
        },
      },
      tratamiento: { select: { id: true, nombre: true, precioPaquete: true } },
    },
  });
  if (!s || s.cancelada || s.booking?.patientId !== s.patientId || s.tratamiento.precioPaquete === null) return null;
  if (linkDePagoVivo(s.booking)) return null;
  return { tratamientoId: s.tratamiento.id, nombre: s.tratamiento.nombre };
}

export type ResultadoLigarNueva =
  | { ligada: true }
  | { ligada: false; motivo: 'sin_sesion' | 'tratamiento_no_activo' | 'sesion_cancelada' | 'sesion_con_visita' | 'sesion_con_cita' | 'cita_invalida' | 'cambio' };

/**
 * TRATAMIENTOS v2 · V1 — el precio con el que NACE una cita que se agenda para una sesión
 * (`paraSesion`, «Agendar sesiones») o que reagenda la cita de una (`reagendaDe`): el PROPIO de la
 * sesión. Las rutas de agendar lo usan en vez del precio del servicio, así que la cita, su evento de
 * Google Calendar, su correo y su bitácora llevan ya el precio correcto (corregirlo DESPUÉS de crear
 * dejaba el viejo en todos ellos). null = la sesión no tiene precio propio → el del servicio, como hoy.
 */
export async function precioParaCitaDeSesion(
  db: Db, args: { doctorId: string; paraSesion?: unknown; reagendaDe?: unknown },
): Promise<number | null> {
  const where = typeof args.paraSesion === 'string' && args.paraSesion
    ? { id: args.paraSesion, doctorId: args.doctorId, cancelada: false }
    : typeof args.reagendaDe === 'string' && args.reagendaDe
      ? { bookingId: args.reagendaDe, doctorId: args.doctorId, cancelada: false }
      : null;
  if (!where) return null;
  const s = await db.tratamientoSesion.findFirst({ where, select: { precio: true } });
  return s?.precio != null ? Number(s.precio) : null;
}

/**
 * TRATAMIENTOS v2 · V1 — al EDITAR el precio de una sesión o LIGARLE una cita que ya existe, la cita
 * toma el precio de la sesión, para que concluirla lo pre-llene (decisión 6, VISITAS/06-PLAN). (Una
 * cita que se CREA para la sesión ya nace con él: `precioParaCitaDeSesion`.) Sólo toca una cita que
 * aún es PLAN:
 *   · PENDING/CONFIRMED (concluida, cancelada o no-show = historia);
 *   · SIN movimiento en Flujo (un prepago ya es dinero a otro monto);
 *   · SIN link de pago PAGADO ni PENDIENTE-y-activo: el paciente pagó, o tiene una liga, por el monto
 *     viejo. Por ESTADO, no por `isActive`: el webhook de Mercado Pago apaga (`isActive: false`) la
 *     preferencia al pagarse, así que «inactiva» no quiere decir «sin pagar».
 * Devuelve si la cambió. Quién puede pedirlo (permiso `citas`) lo decide el llamador.
 */
export async function repreciarCitaDeSesion(
  db: Db, args: { doctorId: string; bookingId: string; precio: number },
): Promise<boolean> {
  const ligaVieja = {
    OR: [{ status: 'PAID' as const }, { status: 'PENDING' as const, isActive: true }],
  };
  const { count } = await db.booking.updateMany({
    where: {
      id: args.bookingId, doctorId: args.doctorId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      ledgerEntry: { is: null },
      NOT: [{ paymentLink: { is: ligaVieja } }, { mpPaymentPreference: { is: ligaVieja } }],
    },
    data: { finalPrice: args.precio },
  });
  return count > 0;
}

/**
 * T5 — «Agendar sesiones»: la cita RECIÉN creada (por la misma ruta que la agenda) se liga a SU
 * sesión en la misma petición (`paraSesion`), para que nunca quede una cita agendada sin su sesión.
 * Mismas reglas que «Ligar una cita…» para el caso que aquí importa: misma doctor y paciente, cita
 * activa y de ninguna otra sesión; la sesión no cancelada, SIN visita propia, y sin una cita que
 * siga contando (una cancelada / no-show / de otro paciente sí se reemplaza). Escritura condicionada.
 * Audita en el expediente. NO lanza por reglas: devuelve `{ ligada: false, motivo }`. (Su precio lo
 * puso ya la ruta al crearla: `precioParaCitaDeSesion`.)
 */
export async function ligarSesionACitaNueva(
  db: Db,
  args: { doctorId: string; sesionId: string; bookingId: string } & QuienAudita,
): Promise<ResultadoLigarNueva> {
  const { doctorId, sesionId, bookingId } = args;
  const s = await db.tratamientoSesion.findFirst({
    where: { id: sesionId, doctorId },
    select: {
      id: true, patientId: true, numero: true, cancelada: true, visitaId: true, bookingId: true, tratamientoId: true,
      booking: { select: { patientId: true, status: true } },
      tratamiento: { select: { estado: true } },
    },
  });
  if (!s) return { ligada: false, motivo: 'sin_sesion' };
  // Un tratamiento terminado o cancelado no recibe citas nuevas.
  if (s.tratamiento.estado !== 'activo') return { ligada: false, motivo: 'tratamiento_no_activo' };
  const motivo = motivoNoSeMueve(s);
  if (motivo) return { ligada: false, motivo };
  // Una cita que SIGUE contando (del mismo paciente y activa o completada) no se pisa.
  const citaVigente = s.bookingId && s.booking?.patientId === s.patientId
    && s.booking.status !== 'CANCELLED' && s.booking.status !== 'NO_SHOW';
  if (citaVigente) return { ligada: false, motivo: 'sesion_con_cita' };

  const b = await db.booking.findFirst({
    where: { id: bookingId, doctorId },
    select: { patientId: true, status: true, tratamientoSesion: { select: { id: true } } },
  });
  if (!b || b.patientId !== s.patientId || (b.status !== 'PENDING' && b.status !== 'CONFIRMED') || b.tratamientoSesion) {
    return { ligada: false, motivo: 'cita_invalida' };
  }

  const { count } = await db.tratamientoSesion.updateMany({
    where: { id: s.id, bookingId: s.bookingId, cancelada: false, visitaId: null },
    data: { bookingId },
  });
  if (count === 0) return { ligada: false, motivo: 'cambio' };

  await db.patientAuditLog.create({
    data: {
      patientId: s.patientId, doctorId, userId: args.userId, userRole: args.userRole,
      action: 'link_sesion_cita', resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: {
        tratamientoId: s.tratamientoId, numero: s.numero,
        bookingId: { from: s.bookingId, to: bookingId }, motivo: 'agendada desde el tratamiento',
      },
    },
  });
  return { ligada: true };
}

/**
 * Re-ligar la cita a OTRO paciente (G1b): la sesión del paciente ANTERIOR la suelta. Desligarla de
 * todo expediente NO la suelta (igual que la visita: volver a ligarla al mismo paciente la encuentra
 * intacta). Corre dentro de `syncVisitaForBooking`, en su transacción.
 */
export async function soltarSesionDeOtroPaciente(
  db: Db, booking: { id: string; doctorId: string; patientId: string | null }, quien?: QuienAudita,
) {
  if (!booking.patientId) return;
  const s = await db.tratamientoSesion.findFirst({
    where: { doctorId: booking.doctorId, bookingId: booking.id, NOT: { patientId: booking.patientId } },
    select: { id: true, patientId: true, numero: true, tratamientoId: true },
  });
  if (!s) return;
  await db.tratamientoSesion.update({ where: { id: s.id }, data: { bookingId: null } });
  await db.patientAuditLog.create({
    data: {
      patientId: s.patientId, doctorId: booking.doctorId,
      userId: quien?.userId ?? 'system', userRole: quien?.userRole ?? 'system',
      action: 'link_sesion_cita', resourceType: 'tratamiento_sesion', resourceId: s.id,
      changes: {
        tratamientoId: s.tratamientoId, numero: s.numero,
        bookingId: { from: booking.id, to: null }, motivo: 'la cita pasó a otro expediente',
      },
    },
  });
}

/**
 * P2 revisado: cuando nace (o se confirma) la visita de una cita que es sesión de ESE paciente, la
 * sesión la GUARDA — así no la pierde si después la cita se borra o se re-liga. Sólo si la sesión
 * aún no guarda visita (si guarda otra, es un caso que decide el doctor). Corre dentro de
 * `syncVisitaForBooking`, en su transacción.
 */
export async function guardarVisitaEnSesion(
  db: Db, booking: { id: string; doctorId: string; patientId: string | null }, visitaId: string,
) {
  if (!booking.patientId) return;
  // Si OTRA sesión ya guarda esta visita, el índice único reventaría y, dentro de la transacción de
  // `syncVisitaForBooking`, se llevaría de corbata la visita misma. Se revisa antes.
  const yaEsDeOtra = await db.tratamientoSesion.findFirst({ where: { visitaId }, select: { id: true } });
  if (yaEsDeOtra) return;
  await db.tratamientoSesion.updateMany({
    // No en una sesión CANCELADA («cancelar sólo la sesión, la cita se queda»): la visita de esa
    // cita no es de la sesión que el doctor canceló.
    where: { doctorId: booking.doctorId, bookingId: booking.id, patientId: booking.patientId, visitaId: null, cancelada: false },
    data: { visitaId },
  });
}
