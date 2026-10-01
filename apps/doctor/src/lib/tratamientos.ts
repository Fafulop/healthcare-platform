/**
 * VISITAS fase 2 (T2) — TRATAMIENTOS: lo común a sus rutas.
 * Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §1 (P1, P2) · §3 · §8 (G1–G9).
 *
 * Permisos: las rutas cuelgan de `medical-records/…` ⇒ heredan `expedientes` (G10: todos los
 * planes). Lo que viene de la cita va recortado con `citas`/`flujo` (`bloquesDeCita`), y ligar o
 * desligar una cita exige `citas` (G4). `precio_paquete` NO viaja ni se escribe hasta T6 (G5).
 *
 * El ESTADO de una sesión no se guarda (P1): se deriva aquí, en `estadoDeSesion()`, y nadie más lo
 * calcula. La sesión SIEMPRE guarda su visita cuando la conoce (P2 revisado), aunque tenga cita.
 */
import { prisma, Prisma, type PrismaClient, type BookingStatus } from '@healthcare/database';
import type { NextRequest } from 'next/server';
import { logAudit, type MedicalAuthContext } from '@/lib/medical-auth';
import { AppError } from '@/lib/api-error-handler';
import { bloquesDeCita, cargarCitaLigable, diaISO, exigirMismoDiaSiTienePlantillas, unicaPorCita } from '@/lib/visitas';

type Db = Prisma.TransactionClient | PrismaClient;

export const ESTADOS_TRATAMIENTO = ['activo', 'terminado', 'cancelado'] as const;
export type EstadoTratamiento = (typeof ESTADOS_TRATAMIENTO)[number];

export const NOMBRE_MAX = 200;
export const NOTAS_MAX = 5000;
/** Tope de sesiones planeadas Y de sesiones creadas de golpe al dar de alta. */
export const SESIONES_MAX = 100;
export const INTERVALO_MAX = 365;

// ─── Validación de entrada ──────────────────────────────────────────────────────────────────

export function parseNombre(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) throw new AppError('nombre es requerido', 400);
  const t = v.trim();
  if (t.length > NOMBRE_MAX) throw new AppError(`nombre excede ${NOMBRE_MAX} caracteres`, 400);
  return t;
}

/** `undefined` = no vino · `null` = borrarlas · string = el texto. */
export function parseNotas(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') throw new AppError('notas debe ser texto', 400);
  const t = v.trim();
  if (t.length > NOTAS_MAX) throw new AppError(`notas excede ${NOTAS_MAX} caracteres`, 400);
  return t || null;
}

/** Entero 1..max, `null` = sin valor, `undefined` = no vino. */
export function parseEnteroOpcional(v: unknown, campo: string, max: number): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {
    throw new AppError(`${campo} debe ser un entero entre 1 y ${max}`, 400);
  }
  return v;
}

export function parseEstadoTratamiento(v: unknown): EstadoTratamiento | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !(ESTADOS_TRATAMIENTO as readonly string[]).includes(v)) {
    throw new AppError(`estado debe ser ${ESTADOS_TRATAMIENTO.join(' · ')}`, 400);
  }
  return v as EstadoTratamiento;
}

/** La plantilla sugerida tiene que ser una plantilla ACTIVA de este doctor (la FK no lo exige). */
export async function parsePlantilla(doctorId: string, v: unknown): Promise<string | null | undefined> {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string' || !v) throw new AppError('plantillaSugeridaId inválido', 400);
  const t = await prisma.encounterTemplate.findFirst({
    where: { id: v, doctorId, isActive: true },
    select: { id: true },
  });
  if (!t) throw new AppError('Plantilla no encontrada', 404);
  return t.id;
}

/**
 * G5: el precio del paquete es de T6. Si alguien lo manda HOY se rechaza en vez de ignorarlo: una
 * pantalla que lo enviara creería que quedó guardado.
 */
export function rechazarPrecio(body: Record<string, unknown>) {
  if (body.precioPaquete !== undefined) {
    throw new AppError('precioPaquete todavía no se puede guardar', 400);
  }
}

/** Choque en un índice único de sesiones (cita, visita o número) que ganó otra petición. */
export function unicaDeSesion(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new AppError('Esa cita o visita ya se ligó a otra sesión; recarga e intenta de nuevo', 409);
  }
  throw e;
}

// ─── Estado derivado (P1) ───────────────────────────────────────────────────────────────────

export type EstadoSesion = 'cancelada' | 'hecha' | 'agendada' | 'por_agendar';
export type MotivoPorAgendar =
  | 'sin_cita' | 'cita_cancelada' | 'cita_no_asistio' | 'cita_de_otro_paciente' | 'cita_sin_expediente';

export interface CitaDeSesion {
  patientId: string | null;
  status: BookingStatus;
  visita: { id: string } | null;
}

export interface EstadoDerivado {
  estado: EstadoSesion;
  /** Por qué está «por agendar» (sólo en ese estado). */
  motivo?: MotivoPorAgendar;
  /** Hecha por su cita COMPLETED, pero la visita automática no se abrió. */
  aviso?: 'visita_no_abierta';
  /** La visita de la sesión: la propia (P2) o, si no la guardó, la de su cita. */
  visitaId: string | null;
  /** ¿Su cita es de ESTE paciente? (G1a: una cita re-ligada a otro no cuenta ni se muestra.) */
  citaPropia: boolean;
}

/**
 * EL estado de una sesión. Orden de la tabla de 03-PLAN §1: cancelada → hecha → agendada → por
 * agendar. Una cita que ya es de OTRO paciente se ignora entera (G1a): ni su estado ni su visita.
 */
export function estadoDeSesion(
  s: { patientId: string; cancelada: boolean; bookingId: string | null; visitaId: string | null },
  cita: CitaDeSesion | null,
): EstadoDerivado {
  const citaPropia = !!(s.bookingId && cita && cita.patientId === s.patientId);
  const visitaId = s.visitaId ?? (citaPropia ? cita!.visita?.id ?? null : null);
  const base = { visitaId, citaPropia };

  if (s.cancelada) return { estado: 'cancelada', ...base };
  if (visitaId) return { estado: 'hecha', ...base };
  if (citaPropia) {
    const st = cita!.status;
    if (st === 'COMPLETED') return { estado: 'hecha', aviso: 'visita_no_abierta', ...base };
    if (st === 'PENDING' || st === 'CONFIRMED') return { estado: 'agendada', ...base };
    return { estado: 'por_agendar', motivo: st === 'NO_SHOW' ? 'cita_no_asistio' : 'cita_cancelada', ...base };
  }
  // La cita dejó de ser de este paciente: re-ligada a OTRO, o desligada de todo expediente.
  const motivo: MotivoPorAgendar = !s.bookingId || !cita ? 'sin_cita'
    : cita.patientId ? 'cita_de_otro_paciente'
    : 'cita_sin_expediente';
  return { estado: 'por_agendar', motivo, ...base };
}

/**
 * La cita que la sesión TIENE para todo efecto: la guardada, si sigue siendo de este paciente. Una
 * cita re-ligada a otro o desligada de todo expediente (G1) no cuenta — la respuesta no la muestra,
 * así que tampoco puede bloquear nada (ligar una visita, borrar la sesión).
 */
export function citaEfectiva(s: { patientId: string; bookingId: string | null; booking: { patientId: string | null } | null }) {
  return s.bookingId && s.booking?.patientId === s.patientId ? s.bookingId : null;
}

// La regla «¿la sesión pasa sola a la cita nueva al reagendar?» vive en `@healthcare/database`
// (la usan las rutas de `apps/api` que crean la cita nueva): aquí sólo se re-exporta.
export { motivoNoSeMueve, type MotivoNoSeMueve } from '@healthcare/database';

/** Lo mínimo para DERIVAR el estado (los conteos no necesitan más). */
const CITA_PARA_ESTADO = { select: { patientId: true, status: true, visita: { select: { id: true } } } } as const;

const SESION_SELECT = {
  id: true, tratamientoId: true, patientId: true, numero: true, cancelada: true,
  bookingId: true, visitaId: true, notas: true, createdAt: true, updatedAt: true,
  booking: CITA_PARA_ESTADO,
} as const;

export type ConteoSesiones = {
  total: number; hechas: number; agendadas: number; porAgendar: number; canceladas: number;
};
const CERO: ConteoSesiones = { total: 0, hechas: 0, agendadas: 0, porAgendar: 0, canceladas: 0 };
const CAMPO: Record<EstadoSesion, keyof ConteoSesiones> = {
  hecha: 'hechas', agendada: 'agendadas', por_agendar: 'porAgendar', cancelada: 'canceladas',
};

/**
 * Cuántas sesiones hay en cada estado, por tratamiento. No es un `groupBy`: el estado no es una
 * columna (P1), así que se leen las sesiones del PACIENTE (índice `patient_id`) y se derivan.
 */
export async function conteosPorTratamiento(
  doctorId: string, patientId: string, tratamientoIds: string[],
): Promise<Map<string, ConteoSesiones>> {
  const out = new Map<string, ConteoSesiones>(tratamientoIds.map((id) => [id, { ...CERO }]));
  if (tratamientoIds.length === 0) return out;
  const sesiones = await prisma.tratamientoSesion.findMany({
    where: { patientId, doctorId, tratamientoId: { in: tratamientoIds } },
    select: {
      tratamientoId: true, patientId: true, cancelada: true, bookingId: true, visitaId: true,
      booking: CITA_PARA_ESTADO,
    },
  });
  for (const s of sesiones) {
    const c = out.get(s.tratamientoId)!;
    c.total += 1;
    c[CAMPO[estadoDeSesion(s, s.booking).estado]] += 1;
  }
  return out;
}

/**
 * Las sesiones, listas para la respuesta: estado derivado, su visita (con su fecha, que con cita es
 * la de la cita) y el bloque de su cita recortado por permiso. La cita sólo viaja si es de ESTE
 * paciente (G1a): una cita re-ligada mostraría la hora de otra persona.
 */
export async function sesionesParaRespuesta(
  ctx: MedicalAuthContext, patientId: string, where: Prisma.TratamientoSesionWhereInput,
) {
  const sesiones = await prisma.tratamientoSesion.findMany({
    where: { ...where, patientId, doctorId: ctx.doctorId },
    orderBy: { numero: 'asc' },
    select: SESION_SELECT,
  });
  const derivados = sesiones.map((s) => estadoDeSesion(s, s.booking));

  const citasPropias = sesiones.flatMap((s, i) => (derivados[i].citaPropia ? [s.bookingId!] : []));
  const visitaIds = derivados.flatMap((d) => (d.visitaId ? [d.visitaId] : []));
  const [bloques, visitas] = await Promise.all([
    bloquesDeCita(ctx, citasPropias),
    visitaIds.length
      ? prisma.visita.findMany({
          where: { id: { in: visitaIds }, patientId, doctorId: ctx.doctorId },
          // Con cita, la fecha de la visita ES la de la cita (misma regla que `diasDeCitas`).
          select: { id: true, fecha: true, booking: { select: { date: true, slot: { select: { date: true } } } } },
        })
      : Promise.resolve([]),
  ]);
  const visitaPor = new Map(
    visitas.map((v) => [
      v.id,
      { id: v.id, fecha: diaISO(v.booking?.slot?.date ?? v.booking?.date ?? v.fecha) },
    ]),
  );

  return sesiones.map((s, i) => {
    const d = derivados[i];
    return {
      id: s.id,
      numero: s.numero,
      cancelada: s.cancelada,
      notas: s.notas,
      estado: d.estado,
      ...(d.motivo ? { motivo: d.motivo } : {}),
      ...(d.aviso ? { aviso: d.aviso } : {}),
      visita: d.visitaId ? visitaPor.get(d.visitaId) ?? { id: d.visitaId } : null,
      cita: d.citaPropia ? bloques.get(s.bookingId!) ?? { id: s.bookingId } : null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });
}

/**
 * La sesión de tratamiento de UNA visita, para la pantalla de la visita («Sesión 3 de 6 —
 * Injerto capilar»): la que GUARDA la visita (P2) y, si ninguna, la de su cita — sólo si la cita
 * sigue siendo de este paciente (una cita vieja, G1, no la hace sesión de nada). null = ninguna.
 */
export async function sesionDeVisita(doctorId: string, patientId: string, visitaId: string, bookingId: string | null) {
  const select = {
    numero: true, cancelada: true,
    tratamiento: { select: { id: true, nombre: true, sesionesPlaneadas: true } },
  } as const;
  const s = (await prisma.tratamientoSesion.findFirst({ where: { doctorId, patientId, visitaId }, select }))
    ?? (bookingId
      ? await prisma.tratamientoSesion.findFirst({
          where: { doctorId, patientId, bookingId, booking: { is: { patientId } } },
          select,
        })
      : null);
  if (!s) return null;
  return {
    tratamientoId: s.tratamiento.id, nombre: s.tratamiento.nombre, numero: s.numero,
    sesionesPlaneadas: s.tratamiento.sesionesPlaneadas, cancelada: s.cancelada,
  };
}

/**
 * Las citas y visitas que ya son de ALGUNA sesión del paciente: los selectores de «Ligar una
 * cita / una visita…» no ofrecen lo que el servidor rechazaría con 409.
 */
export async function ocupadasDelPaciente(doctorId: string, patientId: string) {
  const sesiones = await prisma.tratamientoSesion.findMany({
    where: { doctorId, patientId, OR: [{ bookingId: { not: null } }, { visitaId: { not: null } }] },
    select: { bookingId: true, visitaId: true },
  });
  return {
    citas: sesiones.flatMap((s) => (s.bookingId ? [s.bookingId] : [])),
    visitas: sesiones.flatMap((s) => (s.visitaId ? [s.visitaId] : [])),
  };
}

// ─── Cargar con tenencia ────────────────────────────────────────────────────────────────────

/** Sin `precioPaquete` a propósito (G5): no viaja hasta T6. */
export const TRATAMIENTO_SELECT = {
  id: true, nombre: true, estado: true, sesionesPlaneadas: true, intervaloDias: true,
  plantillaSugeridaId: true, notas: true, createdAt: true, updatedAt: true,
} as const;

export function cargarTratamiento(doctorId: string, patientId: string, tratamientoId: string) {
  return prisma.tratamiento.findFirst({
    where: { id: tratamientoId, patientId, doctorId },
    select: TRATAMIENTO_SELECT,
  });
}

/** Con su cita (lo mínimo para derivar): el PATCH compara contra la visita que la sesión MUESTRA. */
export function cargarSesion(doctorId: string, patientId: string, tratamientoId: string, sesionId: string) {
  return prisma.tratamientoSesion.findFirst({
    where: { id: sesionId, tratamientoId, patientId, doctorId },
    select: {
      id: true, patientId: true, numero: true, cancelada: true, bookingId: true, visitaId: true, notas: true,
      booking: CITA_PARA_ESTADO,
    },
  });
}

// ─── Ligar una cita a una sesión ────────────────────────────────────────────────────────────

/**
 * G1: una sesión del paciente ANTERIOR que sigue apuntando a una cita re-ligada a este. Soltarla
 * cambia el expediente de OTRO paciente: el llamador lo audita bajo ESE `patientId`.
 */
export interface SesionVieja { id: string; patientId: string }

export interface PlanLigarCita {
  /** La visita que la sesión guarda tras ligar (P2 revisado): la suya o la de la cita. */
  visitaDeSesion: string | null;
  /** G2: la visita manual de la sesión pasa a ser la de la cita (con el día de la cita). */
  moverVisita: { id: string; fecha: Date | null } | null;
  /** G1: la cita seguía en la sesión del paciente ANTERIOR (se re-ligó); se suelta de ahí. */
  soltarSesion: SesionVieja | null;
}

/**
 * ¿Se puede ligar `bookingId` a esta sesión? Las reglas comunes de `cargarCitaLigable` (las MISMAS
 * que para ligar una cita a una visita: `citas` (G4), mismo doctor y paciente, ni CANCELLED ni
 * NO_SHOW) más las de la sesión:
 *   · no es de otra sesión de este paciente (si es de la de OTRO paciente, quedó vieja: G1);
 *   · G2: si la sesión ya tiene visita y la cita también, y son distintas → 409; si sólo la
 *     sesión tiene visita, esa visita pasa a ser la de la cita (si no es ya de OTRA cita y, si
 *     tiene plantillas, la cita es del MISMO día);
 *   · si sólo la cita tiene visita, que no sea ya de otra sesión.
 */
export async function planLigarCitaASesion(
  ctx: MedicalAuthContext,
  sesion: { id: string; patientId: string },
  bookingId: unknown,
  visitaActual: string | null,
): Promise<PlanLigarCita> {
  const c = await cargarCitaLigable(ctx, sesion.patientId, bookingId, { conSesion: true });

  let soltarSesion: SesionVieja | null = null;
  if (c.sesion && c.sesion.id !== sesion.id) {
    if (c.sesion.patientId === sesion.patientId) {
      throw new AppError('La cita ya es de otra sesión', 409);
    }
    soltarSesion = c.sesion;
  }

  if (visitaActual && c.visitaId && visitaActual !== c.visitaId) {
    // Sin «desliga X primero»: con cita, la visita de la sesión no se desliga sola (PATCH → 409).
    throw new AppError('Esta cita ya tiene su visita y la sesión guarda otra: una sesión no puede tener dos visitas', 409);
  }

  let moverVisita: PlanLigarCita['moverVisita'] = null;
  if (visitaActual && !c.visitaId) {
    const v = await prisma.visita.findFirst({
      where: { id: visitaActual, patientId: sesion.patientId, doctorId: ctx.doctorId },
      select: { bookingId: true, fecha: true },
    });
    if (v?.bookingId && v.bookingId !== c.id) {
      throw new AppError('La visita de esta sesión es de otra cita: una visita no puede ser de dos citas', 409);
    }
    if (v && !v.bookingId) {
      await exigirMismoDiaSiTienePlantillas(ctx.doctorId, sesion.patientId, visitaActual, v.fecha, c.fechaCita);
      moverVisita = { id: visitaActual, fecha: c.fechaCita };
    }
  }

  if (c.visitaId && !visitaActual) {
    const otra = await prisma.tratamientoSesion.findFirst({
      where: { visitaId: c.visitaId, NOT: { id: sesion.id } },
      select: { id: true },
    });
    if (otra) throw new AppError('La visita de esta cita ya es de otra sesión', 409);
  }

  return { visitaDeSesion: visitaActual ?? c.visitaId, moverVisita, soltarSesion };
}

/**
 * Escribe una sesión que (quizá) liga una cita, en UNA transacción: suelta la sesión vieja de la
 * cita (G1), mueve la visita manual a la cita (G2) y actualiza la sesión con `data`. La usan el
 * PATCH de la sesión (y antes el reagendado, que desde T4 vive en `apps/api` —
 * `pasarSesionAlReagendar`, packages/database), para que «ligar una cita» se escriba de UNA forma. Un choque en `visitas` sale con su mensaje (`unicaPorCita`);
 * uno en sesiones, con el suyo (`unicaDeSesion`).
 *
 * `siSigue`: la escritura sólo procede si la sesión SIGUE así (p. ej. con la cita que se leyó);
 * si otra petición la cambió entre la lectura y aquí, 409 en vez de pisarla.
 */
export async function escribirSesion(
  sesionId: string, data: Prisma.TratamientoSesionUncheckedUpdateInput,
  plan: PlanLigarCita | null, bookingId: string | null,
  siSigue?: Prisma.TratamientoSesionWhereInput,
) {
  await prisma
    .$transaction(async (tx) => {
      if (plan?.soltarSesion) {
        await tx.tratamientoSesion.update({ where: { id: plan.soltarSesion.id }, data: { bookingId: null } });
      }
      if (plan?.moverVisita) {
        await tx.visita
          .update({
            where: { id: plan.moverVisita.id },
            data: { bookingId, ...(plan.moverVisita.fecha ? { fecha: plan.moverVisita.fecha } : {}) },
          })
          .catch(unicaPorCita);
      }
      if (siSigue) {
        const { count } = await tx.tratamientoSesion.updateMany({ where: { ...siSigue, id: sesionId }, data });
        if (count === 0) throw new AppError('La sesión cambió mientras tanto; revisa el tratamiento', 409);
      } else {
        await tx.tratamientoSesion.update({ where: { id: sesionId }, data });
      }
    })
    .catch(unicaDeSesion);
}

/** Auditoría (NOM-024) de lo que `escribirSesion` hizo FUERA de la sesión: la visita movida y la sesión soltada. */
export async function auditarEfectosDeLigar(
  ctx: MedicalAuthContext, request: NextRequest, patientId: string, plan: PlanLigarCita | null, bookingId: string,
) {
  if (plan?.moverVisita) {
    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role, request,
      action: 'update_visita', resourceType: 'visita', resourceId: plan.moverVisita.id,
      changes: {
        bookingId: { from: null, to: bookingId },
        ...(plan.moverVisita.fecha ? { fecha: { to: diaISO(plan.moverVisita.fecha) } } : {}),
        motivo: 'su sesión de tratamiento se ligó a esta cita',
      },
    });
  }
  if (plan?.soltarSesion) await auditarSesionSoltada(ctx, request, plan.soltarSesion, bookingId);
}

/**
 * Ligar una visita SIN cita a la sesión (la sesión no tiene cita: con cita, su visita es la de la
 * cita). La visita tiene que ser de este paciente, sin cita propia y de ninguna otra sesión.
 */
export async function validarVisitaParaSesion(
  doctorId: string, sesion: { id: string; patientId: string }, visitaId: unknown,
): Promise<string> {
  if (typeof visitaId !== 'string' || !visitaId) throw new AppError('visitaId inválido', 400);
  const v = await prisma.visita.findFirst({
    where: { id: visitaId, patientId: sesion.patientId, doctorId },
    select: { id: true, bookingId: true, tratamientoSesion: { select: { id: true } } },
  });
  if (!v) throw new AppError('Visita no encontrada', 404);
  if (v.bookingId) throw new AppError('Esa visita tiene cita: liga la cita a la sesión', 409);
  if (v.tratamientoSesion && v.tratamientoSesion.id !== sesion.id) {
    throw new AppError('Esa visita ya es de otra sesión', 409);
  }
  return v.id;
}

// ─── G3: ligar una cita a una VISITA (rutas de visitas) ─────────────────────────────────────

/**
 * Cuando la pantalla de una visita V liga la cita C, las sesiones tienen que seguir coherentes
 * (G3: los índices únicos no ven el cruce porque son columnas distintas):
 *   · C es de la sesión S2 y V de la sesión S1 (distintas) → 409;
 *   · sólo V es de una sesión → esa sesión toma la cita C (si no tiene ya OTRA cita);
 *   · sólo C es de una sesión → esa sesión guarda V (P2 revisado), si no guarda ya OTRA visita.
 *     Si esa sesión es de OTRO paciente (C se re-ligó, G1), quedó vieja: se ignora, y si la cita
 *     pasa a una sesión de este paciente se suelta de ahí (si no, choca el índice único).
 * `visitaId = null` = la visita aún no existe (alta): sólo aplica el último caso, y el llamador
 * pone el id en cuanto la crea.
 * Devuelve qué escribir (en la transacción del llamador) o null; aplicarlo con `aplicarEnSesion`.
 */
export interface CambioDeSesion {
  sesionId: string;
  ponerCita: boolean;
  ponerVisita: boolean;
  soltarSesion: SesionVieja | null;
}

export async function sesionAlLigarCitaAVisita(
  db: Db, doctorId: string, patientId: string, bookingId: string, visitaId: string | null,
): Promise<CambioDeSesion | null> {
  const [sesC, sesV] = await Promise.all([
    db.tratamientoSesion.findFirst({
      where: { bookingId, doctorId },
      select: { id: true, patientId: true, visitaId: true },
    }),
    visitaId
      ? db.tratamientoSesion.findFirst({
          where: { visitaId, doctorId },
          select: { id: true, patientId: true, bookingId: true, booking: { select: { patientId: true } } },
        })
      : Promise.resolve(null),
  ]);
  const sesCPropia = sesC && sesC.patientId === patientId ? sesC : null;

  if (sesV) {
    if (sesCPropia && sesCPropia.id !== sesV.id) {
      throw new AppError('La cita es de una sesión de tratamiento y la visita de otra', 409);
    }
    if (sesCPropia) return null; // ya son la misma sesión
    // Una cita vieja (G1: de otro paciente o de ninguno) no bloquea: la cita nueva la reemplaza.
    if (citaEfectiva(sesV)) {
      throw new AppError('La sesión de tratamiento de esta visita tiene otra cita', 409);
    }
    return {
      sesionId: sesV.id, ponerCita: true, ponerVisita: false,
      soltarSesion: sesC ? { id: sesC.id, patientId: sesC.patientId } : null,
    };
  }
  if (sesCPropia) {
    if (sesCPropia.visitaId && sesCPropia.visitaId !== visitaId) {
      throw new AppError('La sesión de tratamiento de esta cita ya tiene otra visita', 409);
    }
    if (sesCPropia.visitaId) return null;
    return { sesionId: sesCPropia.id, ponerCita: false, ponerVisita: true, soltarSesion: null };
  }
  return null;
}

/** Auditoría (NOM-024) de una `SesionVieja` soltada: va al expediente del OTRO paciente. */
export async function auditarSesionSoltada(
  ctx: MedicalAuthContext, request: NextRequest, s: SesionVieja, bookingId: string,
) {
  await logAudit({
    patientId: s.patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
    action: 'link_sesion_cita', resourceType: 'tratamiento_sesion', resourceId: s.id,
    changes: { bookingId: { from: bookingId, to: null }, motivo: 'la cita pasó a otro expediente' },
    request,
  });
}

/**
 * Auditoría (NOM-024) de un `CambioDeSesion` hecho desde las rutas de VISITAS: la sesión tiene su
 * propia fila, igual que cuando el cambio se hace desde el PATCH de la sesión.
 */
export async function auditarCambioDeSesion(
  ctx: MedicalAuthContext, request: NextRequest, patientId: string, c: CambioDeSesion, bookingId: string, visitaId: string,
) {
  await logAudit({
    patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
    action: c.ponerCita ? 'link_sesion_cita' : 'link_sesion_visita',
    resourceType: 'tratamiento_sesion', resourceId: c.sesionId,
    changes: {
      ...(c.ponerCita ? { bookingId: { to: bookingId } } : {}),
      ...(c.ponerVisita ? { visitaId: { to: visitaId } } : {}),
      motivo: 'se ligó desde la visita',
    },
    request,
  });
  if (c.soltarSesion) await auditarSesionSoltada(ctx, request, c.soltarSesion, bookingId);
}

/**
 * Escribe un `CambioDeSesion` dentro de la transacción del llamador. Un choque en un índice único
 * de SESIONES sale con su propio mensaje (AppError), no con el «la cita ya tiene una visita» que
 * el llamador da a los choques de `visitas`.
 */
export async function aplicarEnSesion(
  tx: Prisma.TransactionClient, c: CambioDeSesion, bookingId: string, visitaId: string,
) {
  try {
    if (c.soltarSesion) {
      await tx.tratamientoSesion.update({ where: { id: c.soltarSesion.id }, data: { bookingId: null } });
    }
    await tx.tratamientoSesion.update({
      where: { id: c.sesionId },
      data: { ...(c.ponerCita ? { bookingId } : {}), ...(c.ponerVisita ? { visitaId } : {}) },
    });
  } catch (e) {
    unicaDeSesion(e);
  }
}

/**
 * G3 al DESLIGAR la cita B de la visita V: si una sesión guarda las dos, la visita y la cita
 * dejarían de ser la misma cosa dentro de la sesión (y al concluirse B nacería una 2ª visita para
 * esa sesión). Ambiguo cuál de las dos «es» de la sesión ⇒ 409: se desliga desde el tratamiento.
 */
export async function exigirSinSesionAlDesligar(db: Db, doctorId: string, bookingId: string, visitaId: string) {
  const s = await db.tratamientoSesion.findFirst({
    where: { doctorId, bookingId, visitaId },
    select: { id: true },
  });
  if (s) {
    throw new AppError('Esta visita y su cita son una sesión de tratamiento: desliga la cita desde el tratamiento', 409);
  }
}
