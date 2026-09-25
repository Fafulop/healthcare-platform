/**
 * VISITAS (fase 1, D2) — lo común a las rutas de visitas del expediente.
 * Diseño: docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md §3 · Plan: 02-PLAN §5.
 *
 * Permisos: las rutas cuelgan de `medical-records/…`, así que heredan `expedientes` (decisión del
 * usuario 2026-09-25: SIN toggle propio). Los cinco hijos (consultas, fotos, notas, recetas,
 * informes) también son `expedientes`. Lo único con OTRO permiso es lo que viene de la cita:
 * hora/servicio (`citas`) y cobro (`flujo`). Sin ese permiso el campo NO viaja (no va vacío).
 */
import {
  prisma, Prisma, hasPermission, type PermissionKey, type PrismaClient,
} from '@healthcare/database';
import type { MedicalAuthContext } from '@/lib/medical-auth';
import { AppError } from '@/lib/api-error-handler';

/**
 * ¿Puede VER este bloque de DATOS? Dueño y admin: siempre. Member: su toggle.
 *
 * ⚠️ SIN techo del plan, a propósito. El plan recorta FUNCIONES (las rutas de facturar, del SAT…
 * ya lo hacen con `tierRouteDecision`), no la LECTURA de datos que ya son del doctor: con el techo,
 * un dueño en FREE (que excluye `facturacion`) dejaba de ver sus propias facturas en el
 * expediente. Es el error que este repo ya pagó dos veces (ver `summary` en route-permissions.ts).
 */
export function puedeVer(ctx: MedicalAuthContext, key: PermissionKey): boolean {
  if (ctx.role === 'ADMIN' || ctx.isOwner) return true;
  return hasPermission(ctx.permissions, key);
}

/** `@db.Date` se lee en UTC: el día es el prefijo ISO, nunca la fecha local. */
export const diaISO = (d: Date) => d.toISOString().slice(0, 10);

/** 'YYYY-MM-DD' válido → Date a mediodía UTC (mismo criterio que las rutas de alta de citas). */
export function parseFecha(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || diaISO(d) !== v ? null : d;
}

export const COMENTARIO_MAX = 5000;

/** `undefined` = no vino · `null` = borrarlo · string = el texto. Lanza si no es válido. */
export function parseComentario(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') throw new AppError('comentario debe ser texto', 400);
  const t = v.trim();
  if (t.length > COMENTARIO_MAX) throw new AppError(`comentario excede ${COMENTARIO_MAX} caracteres`, 400);
  return t || null;
}

/** El body tiene que ser un OBJETO JSON (`null` o un primitivo → 400, no un 500 al leer campos). */
export async function leerBody(request: Request): Promise<Record<string, unknown>> {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new AppError('Body JSON inválido', 400);
  return b as Record<string, unknown>;
}

/** Una 2ª visita para la misma cita (carrera): el índice único de booking_id decide → 409. */
export function unicaPorCita(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new AppError('La cita ya tiene una visita', 409);
  }
  throw e;
}

/**
 * El día de cada cita ligada. Con cita, la fecha de la visita ES la de la cita (DISEÑO §3): se
 * LEE, no se muestra la propia — una cita re-agendada después de ligarse dejaría viejo el respaldo.
 * Sin recorte por permiso: es la fecha de la VISITA, no el bloque de la cita.
 */
export async function diasDeCitas(doctorId: string, bookingIds: string[]): Promise<Map<string, Date>> {
  if (bookingIds.length === 0) return new Map();
  const bs = await prisma.booking.findMany({
    where: { id: { in: bookingIds }, doctorId },
    select: { id: true, date: true, slot: { select: { date: true } } },
  });
  const out = new Map<string, Date>();
  for (const b of bs) {
    const d = b.slot?.date ?? b.date;
    if (d) out.set(b.id, d);
  }
  return out;
}

export type ConteoHijos = { consultas: number; fotos: number; recetas: number; notas: number; informes: number };
const CERO: ConteoHijos = { consultas: 0, fotos: 0, recetas: 0, notas: 0, informes: 0 };

/**
 * Cuántos hijos tiene cada visita. `groupBy` filtrado por PACIENTE y por las visitas pedidas:
 * NO el `_count` de Prisma, que arma GROUP BY sobre las 5 tablas COMPLETAS (smoke de D1).
 */
export async function contarHijos(
  patientId: string, visitaIds: string[], db: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<Map<string, ConteoHijos>> {
  const out = new Map<string, ConteoHijos>(visitaIds.map((id) => [id, { ...CERO }]));
  if (visitaIds.length === 0) return out;
  const where = { patientId, visitaId: { in: visitaIds } };
  const [enc, med, rec, not, inf] = await Promise.all([
    db.clinicalEncounter.groupBy({ by: ['visitaId'], where, _count: { _all: true } }),
    db.patientMedia.groupBy({ by: ['visitaId'], where, _count: { _all: true } }),
    db.prescription.groupBy({ by: ['visitaId'], where, _count: { _all: true } }),
    db.patientNote.groupBy({ by: ['visitaId'], where, _count: { _all: true } }),
    db.medicalReport.groupBy({ by: ['visitaId'], where, _count: { _all: true } }),
  ]);
  const sumar = (rows: { visitaId: string | null; _count?: { _all?: number } | true }[], campo: keyof ConteoHijos) => {
    for (const r of rows) {
      const n = typeof r._count === 'object' ? r._count._all ?? 0 : 0;
      if (r.visitaId && out.has(r.visitaId)) out.get(r.visitaId)![campo] = n;
    }
  };
  sumar(enc, 'consultas'); sumar(med, 'fotos'); sumar(rec, 'recetas'); sumar(not, 'notas'); sumar(inf, 'informes');
  return out;
}

export const totalHijos = (c: ConteoHijos) => c.consultas + c.fotos + c.recetas + c.notas + c.informes;

const BOOKING_SELECT = {
  id: true, status: true, startTime: true, endTime: true, serviceName: true, date: true,
  slot: { select: { date: true, startTime: true, endTime: true } },
} as const;

/**
 * El bloque de la cita de cada visita, recortado por permiso: sin `citas` sólo viaja `{ id }`
 * (para saber que HAY cita); el cobro sólo con `flujo`.
 */
export async function bloquesDeCita(ctx: MedicalAuthContext, bookingIds: string[]) {
  const out = new Map<string, Record<string, unknown>>();
  if (bookingIds.length === 0) return out;
  const verCita = puedeVer(ctx, 'citas');
  const verCobro = puedeVer(ctx, 'flujo');
  const [bookings, ledger] = await Promise.all([
    verCita
      ? prisma.booking.findMany({ where: { id: { in: bookingIds }, doctorId: ctx.doctorId }, select: BOOKING_SELECT })
      : Promise.resolve([]),
    verCobro
      ? prisma.ledgerEntry.findMany({
          where: { bookingId: { in: bookingIds }, doctorId: ctx.doctorId },
          select: { bookingId: true, amount: true, amountPaid: true, paymentStatus: true, formaDePago: true },
        })
      : Promise.resolve([]),
  ]);
  const citaPor = new Map(bookings.map((b) => [b.id, b]));
  const cobroPor = new Map(ledger.map((l) => [l.bookingId!, l]));
  for (const id of bookingIds) {
    const bloque: Record<string, unknown> = { id };
    const b = citaPor.get(id);
    if (b) {
      const dia = b.slot?.date ?? b.date;
      Object.assign(bloque, {
        status: b.status,
        fecha: dia ? diaISO(dia) : null,
        horaInicio: b.slot?.startTime ?? b.startTime ?? null,
        horaFin: b.slot?.endTime ?? b.endTime ?? null,
        servicio: b.serviceName ?? null,
      });
    }
    if (verCobro) {
      const l = cobroPor.get(id);
      bloque.cobro = l
        ? { monto: Number(l.amount), pagado: Number(l.amountPaid ?? 0), estado: l.paymentStatus ?? null, formaDePago: l.formaDePago ?? null }
        : null;
    }
    out.set(id, bloque);
  }
  return out;
}

/**
 * Valida que una cita se pueda ligar a una visita de este paciente:
 *   · quien liga necesita `citas` (ligar escribe en el bloque de la cita; DISEÑO §3 #5);
 *   · del MISMO doctor (la BD también lo exige, FK compuesta) y del MISMO paciente (sólo el servidor);
 *   · ni CANCELLED ni NO_SHOW (no hubo visita);
 *   · sin otra visita.
 * Devuelve el día de la cita (manda sobre `visitas.fecha`) o null si no tiene.
 */
export async function validarCitaParaVisita(
  ctx: MedicalAuthContext, patientId: string, bookingId: unknown, exceptVisitaId?: string,
): Promise<{ fechaCita: Date | null }> {
  if (!puedeVer(ctx, 'citas')) throw new AppError('PERMISSION_BLOCKED', 403);
  if (typeof bookingId !== 'string' || !bookingId) throw new AppError('bookingId inválido', 400);
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, doctorId: ctx.doctorId },
    select: { patientId: true, status: true, date: true, slot: { select: { date: true } }, visita: { select: { id: true } } },
  });
  if (!b) throw new AppError('Cita no encontrada', 404);
  if (b.patientId !== patientId) throw new AppError('La cita no está ligada a este paciente', 409);
  if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') {
    throw new AppError('La cita está cancelada o el paciente no asistió', 409);
  }
  if (b.visita && b.visita.id !== exceptVisitaId) throw new AppError('La cita ya tiene una visita', 409);
  return { fechaCita: b.slot?.date ?? b.date ?? null };
}

/**
 * VISITAS D3 — la visita de un HIJO (foto, receta, informe, nota, consulta). UNA regla, un lugar
 * (DISEÑO §3 "una sola liga al padre"): **la visita de un hijo es la de su consulta.**
 *   · Con consulta (`encounterId`): el servidor la DERIVA de la consulta; un `visitaId` que no
 *     coincida → 409 (una foto no puede estar en la consulta de la visita A con visitaId = B).
 *   · Sin consulta: el `visitaId` que venga, si la visita es del MISMO paciente y doctor (la BD
 *     también lo exige con la FK compuesta).
 * ⚠️ scripts/visitas/backfill-visitas.cjs aplica la MISMA regla a los datos viejos: si cambia aquí,
 *    cambia allá.
 *
 * Devuelve `undefined` = no tocar la columna · `null` = «Sin visita» · string = esa visita.
 *
 * @param opts.visitaId       lo que mandó el cliente (`undefined` = no lo mandó).
 * @param opts.encounterId    la consulta del hijo DESPUÉS de esta escritura (null = sin consulta).
 * @param opts.encounterCambio ¿esta escritura pone o cambia la consulta? (en un alta con consulta: sí)
 */
export async function resolverVisitaDeHijo(
  doctorId: string,
  patientId: string,
  opts: { visitaId: unknown; encounterId: string | null; encounterCambio: boolean },
  db: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<string | null | undefined> {
  if (opts.encounterId) {
    // Con consulta la visita se DERIVA: un null/'' que manda un formulario por default no dice nada.
    const pedida = opts.visitaId === null || opts.visitaId === '' ? undefined : opts.visitaId;
    if (!opts.encounterCambio && pedida === undefined) return undefined;
    const enc = await db.clinicalEncounter.findFirst({
      where: { id: opts.encounterId, patientId, doctorId },
      select: { visitaId: true },
    });
    if (!enc) throw new AppError('Consulta no encontrada', 404);
    if (pedida !== undefined && pedida !== enc.visitaId) {
      throw new AppError('La visita de este elemento es la de su consulta', 409);
    }
    return enc.visitaId;
  }
  if (opts.visitaId === undefined) return undefined;
  if (opts.visitaId === null) return null;
  if (typeof opts.visitaId !== 'string' || !opts.visitaId) throw new AppError('visitaId inválido', 400);
  const v = await db.visita.findFirst({
    where: { id: opts.visitaId, patientId, doctorId },
    select: { id: true },
  });
  if (!v) throw new AppError('Visita no encontrada', 404);
  return v.id;
}

/**
 * Mueve una CONSULTA a otra visita (o a «Sin visita») y ARRASTRA a sus hijos (fotos, recetas,
 * informes con ese `encounterId`): si no, quedarían en otra visita que su consulta. Va en la
 * transacción del llamador. Devuelve los IDS de los hijos movidos: la auditoría (NOM-024) tiene
 * que poder decir QUÉ receta o informe cambió de visita, no sólo cuántos.
 */
export async function moverConsultaDeVisita(
  tx: Prisma.TransactionClient, encounterId: string, visitaId: string | null,
): Promise<{ fotos: string[]; recetas: string[]; informes: string[] }> {
  const where = { encounterId };
  const sel = { select: { id: true } } as const;
  const [fotos, recetas, informes] = await Promise.all([
    tx.patientMedia.findMany({ where, ...sel }),
    tx.prescription.findMany({ where, ...sel }),
    tx.medicalReport.findMany({ where, ...sel }),
  ]);
  await tx.clinicalEncounter.update({ where: { id: encounterId }, data: { visitaId } });
  await Promise.all([
    tx.patientMedia.updateMany({ where, data: { visitaId } }),
    tx.prescription.updateMany({ where, data: { visitaId } }),
    tx.medicalReport.updateMany({ where, data: { visitaId } }),
  ]);
  const ids = (r: { id: string }[]) => r.map((x) => x.id);
  return { fotos: ids(fotos), recetas: ids(recetas), informes: ids(informes) };
}
