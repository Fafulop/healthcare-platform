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
import {
  bloquesDeCita, cargarCitaLigable, diaISO, diasDeCitas, puedeVer, unicaPorCita,
} from '@/lib/visitas';

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
 * TRATAMIENTOS v2 · V2 (2026-10-02): ya no hay paquetes. Un precio de paquete que llegue se RECHAZA
 * (400); `null` se ignora (un formulario viejo en caché lo manda siempre al editar el nombre, y eso
 * no debe fallar). Los 2 tratamientos viejos con paquete conservan su dato tal cual.
 */
export function rechazarPrecioPaquete(v: unknown): void {
  if (v === undefined || v === null) return;
  throw new AppError('Ya no hay precio de paquete: el total del tratamiento es la suma de sus sesiones', 400);
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
  // V4: «Abrir visita» se puede ANTES de la sesión (decisión 4). Una visita cuya cita propia sigue
  // siendo plan no hace «hecha» la sesión: sigue agendada hasta que llegue (o se concluya) la cita.
  const citaEnPlan = citaPropia && (cita!.status === 'PENDING' || cita!.status === 'CONFIRMED');
  // Y si esa cita se CAYÓ (cancelada / no asistió) y la visita es la SUYA (abierta antes), la sesión no
  // se atendió: vuelve a «por agendar» (con su motivo); al agendarla, su visita viaja a la cita nueva
  // (V4 paso 2). Una visita propia de la sesión (otra, manual) sí la deja hecha, como siempre.
  const citaCaida = citaPropia && (cita!.status === 'CANCELLED' || cita!.status === 'NO_SHOW');
  const visitaDeSuCita = citaPropia && !!visitaId && cita!.visita?.id === visitaId;
  if (visitaId && !citaEnPlan && !(citaCaida && visitaDeSuCita)) return { estado: 'hecha', ...base };
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
const CITA_PARA_ESTADO = {
  select: { patientId: true, status: true, finalPrice: true, visita: { select: { id: true } } },
} as const;

const SESION_SELECT = {
  id: true, tratamientoId: true, patientId: true, numero: true, cancelada: true,
  bookingId: true, visitaId: true, notas: true, createdAt: true, updatedAt: true,
  servicioId: true, servicioNombre: true, precio: true,
  booking: CITA_PARA_ESTADO,
} as const;

/**
 * TRATAMIENTOS v2 · V1 — el precio PLANEADO de una sesión, con su FUENTE (una sola regla, regla 0):
 *   1. el suyo (`sesion`);
 *   2. sin precio propio (sesiones de antes de V1): el de su cita PROPIA si aún es plan
 *      (pendiente/confirmada) y > 0 (`cita`). `finalPrice` es NOT NULL y vale 0 cuando la cita no
 *      tenía precio: 0 NO es un precio, es «no se sabe»;
 *   3. si no, null = «sin precio» (se dice, no se inventa un $0).
 * Es lo que se PLANEA cobrar. Lo que SE COBRÓ (al concluir la cita) es otro número: `cobrosDeCitas`.
 */
export function precioDeSesion(
  s: {
    precio: Prisma.Decimal | null; patientId: string; bookingId: string | null;
    booking: { patientId: string | null; status: BookingStatus; finalPrice: Prisma.Decimal } | null;
  },
): { precio: number | null; fuente: 'sesion' | 'cita' | null } {
  if (s.precio !== null) return { precio: Number(s.precio), fuente: 'sesion' };
  if (citaEfectiva(s) && s.booking
    && (s.booking.status === 'PENDING' || s.booking.status === 'CONFIRMED')
    && Number(s.booking.finalPrice) > 0) {
    return { precio: Number(s.booking.finalPrice), fuente: 'cita' };
  }
  return { precio: null, fuente: null };
}

/**
 * El COBRO de cada cita (su movimiento de Flujo, 1:1 por `bookingId`), con sus DOS números separados
 * — mezclarlos fue el error: `cargo` = lo que se cobró (`amount`, lo que el doctor capturó al
 * concluirla) y `pagado` = lo que de eso ya entró (`amountPaid`; un movimiento viejo sin `amountPaid`
 * cuenta pagado sólo si su estado es PAID). Un cargo PENDIENTE o PARCIAL deja ver lo que se debe.
 */
async function cobrosDeCitas(doctorId: string, citas: string[]) {
  if (!citas.length) return new Map<string, { cargo: number; pagado: number; folio: string }>();
  const movimientos = await prisma.ledgerEntry.findMany({
    where: { doctorId, bookingId: { in: citas } },
    select: { bookingId: true, amount: true, amountPaid: true, paymentStatus: true, internalId: true },
  });
  return new Map(movimientos.map((m) => {
    const cargo = Number(m.amount);
    const pagado = m.amountPaid !== null ? Number(m.amountPaid) : m.paymentStatus === 'PAID' ? cargo : 0;
    return [m.bookingId!, { cargo, pagado, folio: m.internalId }];
  }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * TRATAMIENTOS v2 · V1 — la CUENTA de un tratamiento sin paquete (06-PLAN §4), para quien tiene
 * `flujo`. Nada se guarda, todo se SUMA de lo que ya existe. El IMPORTE de cada sesión (no cancelada):
 *   · ya cobrada (su cita concluyó y tiene movimiento) → LO COBRADO (`cargo`, fuente `cobro`): el doctor
 *     decidió el monto al concluirla — un descuento del día o un link a otro monto NO deja un
 *     «pendiente» que nadie debe;
 *   · aún no → su precio PLANEADO (`precioDeSesion`); sin precio → `sinPrecio` (no se inventa).
 *   · total     = Σ importes;
 *   · pagado    = Σ lo que ENTRÓ de esos cargos (`pagado`): un cobro pendiente o parcial SÍ deja ver
 *                 lo que se debe;
 *   · pendiente = total − pagado (si se pagó de más, `cobradoDeMas` > 0 y pendiente 0);
 *   · cobradoEnCanceladas = lo que cobraron sesiones CANCELADAS (p. ej. un cargo por no asistir): el
 *                 dinero entró, pero contarlo en `pagado` bajaría en silencio lo que deben las otras;
 *                 se dice aparte;
 *   · ventas    = las de las visitas de sus sesiones, en renglón APARTE (decisión 5): su total y
 *                 su pagado, sin ventas canceladas. No entran en el total de sesiones.
 */
export async function cuentaDelTratamiento(doctorId: string, patientId: string, tratamientoId: string) {
  const sesiones = await prisma.tratamientoSesion.findMany({
    where: { tratamientoId, patientId, doctorId },
    orderBy: { numero: 'asc' },
    select: SESION_SELECT,
  });
  const derivados = sesiones.map((s) => estadoDeSesion(s, s.booking));
  const citas = sesiones.flatMap((s) => (citaEfectiva(s) ? [s.bookingId!] : []));
  const visitas = derivados.flatMap((d) => (d.visitaId ? [d.visitaId] : []));

  const [cobroPor, ventas] = await Promise.all([
    cobrosDeCitas(doctorId, citas),
    visitas.length
      ? prisma.sale.findMany({
          where: { doctorId, patientId, visitaId: { in: visitas }, status: { not: 'CANCELLED' } },
          // V5: folio y fecha para el «Resumen de tratamiento» (las ventas van renglón por renglón).
          select: { total: true, amountPaid: true, saleNumber: true, saleDate: true },
          orderBy: { saleDate: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  let total = 0;
  let pagado = 0;
  let cobradoEnCanceladas = 0;
  let sinPrecio = 0;
  const porSesion = sesiones.map((s) => {
    const m = citaEfectiva(s) ? cobroPor.get(s.bookingId!) : undefined;
    const planeado = precioDeSesion(s);
    const importe = m ? m.cargo : planeado.precio;
    const fuente: 'cobro' | 'sesion' | 'cita' | null = m ? 'cobro' : planeado.fuente;
    const entro = m?.pagado ?? 0;
    if (s.cancelada) {
      cobradoEnCanceladas += entro;
    } else {
      pagado += entro;
      if (importe === null) sinPrecio += 1;
      else total += importe;
    }
    return {
      id: s.id, importe: importe === null ? null : r2(importe), fuente,
      pagado: r2(entro), folio: m?.folio ?? null,
    };
  });

  const ventasTotal = ventas.reduce((a, v) => a + Number(v.total), 0);
  const ventasPagado = ventas.reduce((a, v) => a + Number(v.amountPaid ?? 0), 0);
  return {
    total: r2(total),
    pagado: r2(pagado),
    pendiente: r2(Math.max(0, total - pagado)),
    cobradoDeMas: r2(Math.max(0, pagado - total)),
    cobradoEnCanceladas: r2(cobradoEnCanceladas),
    sinPrecio,
    sesiones: porSesion,
    ventas: {
      cuantas: ventas.length, total: r2(ventasTotal), pagado: r2(ventasPagado),
      detalle: ventas.map((v) => ({
        folio: v.saleNumber, fecha: diaISO(v.saleDate), total: r2(Number(v.total)), pagado: r2(Number(v.amountPaid ?? 0)),
      })),
    },
  };
}

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

  // V1: el servicio viaja siempre; el precio PLANEADO sólo con `flujo` (es dinero — misma regla que
  // tenía el precio del paquete, G5). Lo cobrado/pagado vive en la cuenta (`cuentaDelTratamiento`).
  const conFlujo = puedeVer(ctx, 'flujo');
  return sesiones.map((s, i) => {
    const d = derivados[i];
    return {
      id: s.id,
      numero: s.numero,
      cancelada: s.cancelada,
      notas: s.notas,
      servicioId: s.servicioId,
      servicioNombre: s.servicioNombre,
      ...(conFlujo ? precioDeSesion(s) : {}),
      estado: d.estado,
      ...(d.motivo ? { motivo: d.motivo } : {}),
      ...(d.aviso ? { aviso: d.aviso } : {}),
      visita: d.visitaId ? visitaPor.get(d.visitaId) ?? { id: d.visitaId } : null,
      // V4 paso 2 — su visita ES la de su cita: al reagendar (o agendar de nuevo una cita caída)
      // viaja con ella. Mismo veredicto que `motivoNoSeMueve` en packages/database (regla 0).
      visitaViaja: !!d.visitaId && d.citaPropia && s.booking?.visita?.id === d.visitaId,
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
 * T7 — la sesión de cada visita, para la etiqueta «Sesión N de M — X» en la tarjeta de Visitas del
 * perfil. Misma regla que `sesionDeVisita` (la sesión que guarda la visita o, si no, la de su cita
 * mientras siga siendo de este paciente), en UNA consulta para toda la lista.
 */
export async function sesionesDeVisitas(
  doctorId: string, patientId: string, visitas: { id: string; bookingId: string | null }[],
) {
  const ids = visitas.map((v) => v.id);
  const bookingIds = visitas.flatMap((v) => (v.bookingId ? [v.bookingId] : []));
  const out = new Map<string, {
    tratamientoId: string; nombre: string; estado: string; numero: number; sesionesPlaneadas: number | null; cancelada: boolean;
  }>();
  if (ids.length === 0) return out;
  const sesiones = await prisma.tratamientoSesion.findMany({
    where: {
      doctorId, patientId,
      OR: [
        { visitaId: { in: ids } },
        ...(bookingIds.length ? [{ bookingId: { in: bookingIds }, booking: { is: { patientId } } }] : []),
      ],
    },
    select: {
      numero: true, cancelada: true, visitaId: true, bookingId: true,
      tratamiento: { select: { id: true, nombre: true, estado: true, sesionesPlaneadas: true } },
    },
  });
  const porVisita = new Map(sesiones.filter((x) => x.visitaId).map((x) => [x.visitaId as string, x]));
  const porCita = new Map(sesiones.filter((x) => x.bookingId).map((x) => [x.bookingId as string, x]));
  for (const v of visitas) {
    const x = porVisita.get(v.id) ?? (v.bookingId ? porCita.get(v.bookingId) : undefined);
    if (x) {
      out.set(v.id, {
        tratamientoId: x.tratamiento.id, nombre: x.tratamiento.nombre, estado: x.tratamiento.estado, numero: x.numero,
        sesionesPlaneadas: x.tratamiento.sesionesPlaneadas, cancelada: x.cancelada,
      });
    }
  }
  return out;
}

// ─── T7: «Es seguimiento de…» al crear una visita (DISEÑO §7, P5) ───────────────────────────

/** Lo que el modal manda: unirse a un tratamiento ACTIVO, o seguir a una visita anterior. */
export type Seguimiento = { tratamientoId: string } | { visitaId: string };

export function parseSeguimiento(v: unknown): Seguimiento | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const t = typeof o.tratamientoId === 'string' && o.tratamientoId ? o.tratamientoId : null;
    const vi = typeof o.visitaId === 'string' && o.visitaId ? o.visitaId : null;
    if (t && !vi) return { tratamientoId: t };
    if (vi && !t) return { visitaId: vi };
  }
  throw new AppError('seguimiento inválido: { tratamientoId } o { visitaId }', 400);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2026-09-12' → '12 sep' (el día ya viene como texto: sin zonas horarias de por medio). */
function diaCorto(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** El día que MUESTRA una visita: el de su cita si la tiene (DISEÑO §3), si no el suyo. */
export async function diaDeVisita(doctorId: string, v: { fecha: Date; bookingId: string | null }) {
  const diaCita = v.bookingId ? (await diasDeCitas(doctorId, [v.bookingId])).get(v.bookingId) : undefined;
  return diaISO(diaCita ?? v.fecha);
}

/**
 * El tratamiento «Seguimiento del <día>» que nace de una visita SUELTA: sesión 1 = esa visita, y su cita
 * si no es ya de otra sesión. Una sola regla para los dos caminos que lo crean: «Nueva Visita» →
 * «Seguimiento de una visita anterior» (T7) y «Agendar seguimiento» desde la visita (07-PLAN P3a).
 * Dentro de la transacción del llamador; `diaVisita` = `diaDeVisita(...)`.
 */
export async function crearSeguimientoDeVisita(
  tx: Prisma.TransactionClient, doctorId: string, patientId: string,
  visita: { id: string; bookingId: string | null }, diaVisita: string,
): Promise<{ tratamientoId: string; nombre: string; sesionId: string }> {
  const nombre = `Seguimiento del ${diaCorto(diaVisita)}`;
  const t = await tx.tratamiento.create({ data: { patientId, doctorId, nombre }, select: { id: true } });
  const citaLibre = visita.bookingId
    && !(await tx.tratamientoSesion.findFirst({ where: { bookingId: visita.bookingId }, select: { id: true } }))
    ? visita.bookingId : null;
  const s1 = await tx.tratamientoSesion.create({
    data: { tratamientoId: t.id, patientId, doctorId, numero: 1, visitaId: visita.id, bookingId: citaLibre },
    select: { id: true },
  });
  return { tratamientoId: t.id, nombre, sesionId: s1.id };
}

export interface SeguimientoHecho {
  tratamientoId: string;
  /** El tratamiento se CREÓ aquí (seguimiento de una visita que no era de ninguno). */
  creado: { nombre: string; sesionAnteriorId: string; visitaAnteriorId: string } | null;
  sesionId: string;
  numero: number;
  /** true = se llenó una sesión «por agendar» que ya existía; false = se agregó al final. */
  llenoExistente: boolean;
  bookingId: string | null;
}

/**
 * T7 — la visita RECIÉN creada (en la misma transacción) entra al tratamiento como sesión:
 *   · `{ tratamientoId }`: un tratamiento ACTIVO del paciente;
 *   · `{ visitaId }`: la visita anterior (nunca de un día POSTERIOR a ésta: 409 — H-024) — si ya es de un tratamiento activo, a ése; si no es de
 *     ninguno, nace uno chico «Seguimiento del 12 sep» con sesión 1 = la anterior y 2 = la nueva; si
 *     es de uno terminado/cancelado, 409 (se reactiva primero — decisión del usuario 2026-10-01).
 * La visita llena la PRIMERA sesión libre (no cancelada, sin visita y sin una cita que siga
 * contando — la misma regla que «Agendar sesiones»); si no hay, se agrega una al final (como
 * «Agregar sesión»: no cambia las sesiones planeadas). Si la visita trae cita y esa cita no es de
 * ninguna sesión, la sesión la toma también. Cualquier choque de índice único → 409 legible.
 */
export async function unirComoSeguimiento(
  tx: Prisma.TransactionClient, doctorId: string, patientId: string, seg: Seguimiento,
  /** `fecha` = el día de la visita nueva (con cita, la ruta ya la puso en el día de la cita). */
  nueva: { id: string; bookingId: string | null; fecha: Date },
): Promise<SeguimientoHecho> {
  try {
    let tratamientoId: string;
    let creado: SeguimientoHecho['creado'] = null;

    if ('visitaId' in seg) {
      if (seg.visitaId === nueva.id) throw new AppError('Una visita no puede ser seguimiento de sí misma', 400);
      const prev = await tx.visita.findFirst({
        where: { id: seg.visitaId, patientId, doctorId },
        select: {
          id: true, fecha: true, bookingId: true,
          tratamientoSesion: { select: { tratamientoId: true, tratamiento: { select: { estado: true, nombre: true } } } },
        },
      });
      if (!prev) throw new AppError('La visita anterior no existe o no es de este paciente', 404);

      // H-024 (2026-10-04): «seguimiento de una visita anterior» — la anterior no puede ser POSTERIOR a
      // ésta (si no, la sesión 2 queda antes que la 1). Día de cada visita = el de su cita si la tiene
      // (misma regla que el nombre «Seguimiento del …» y que la tarjeta de Visitas).
      const diaPrev = await diaDeVisita(doctorId, prev);
      const diaNueva = diaISO(nueva.fecha);
      if (diaPrev > diaNueva) {
        // Con el año si son de años distintos: «5 ene, posterior a 20 dic» se leería falso.
        const otroAnio = diaPrev.slice(0, 4) !== diaNueva.slice(0, 4);
        const f = (iso: string) => `${diaCorto(iso)}${otroAnio ? ` ${iso.slice(0, 4)}` : ''}`;
        throw new AppError(
          `La visita elegida es del ${f(diaPrev)}, posterior a ésta (${f(diaNueva)}): una visita sólo puede ser seguimiento de una anterior`,
          409,
        );
      }
      if (prev.tratamientoSesion) {
        if (prev.tratamientoSesion.tratamiento.estado !== 'activo') {
          throw new AppError(
            `La visita anterior es de «${prev.tratamientoSesion.tratamiento.nombre}», que ya terminó o se canceló: reactívalo primero`,
            409,
          );
        }
        tratamientoId = prev.tratamientoSesion.tratamientoId;
      } else {
        const c = await crearSeguimientoDeVisita(tx, doctorId, patientId, prev, diaPrev);
        tratamientoId = c.tratamientoId;
        creado = { nombre: c.nombre, sesionAnteriorId: c.sesionId, visitaAnteriorId: prev.id };
      }
    } else {
      const t = await tx.tratamiento.findFirst({
        where: { id: seg.tratamientoId, patientId, doctorId },
        select: { id: true, estado: true, nombre: true },
      });
      if (!t) throw new AppError('Tratamiento no encontrado', 404);
      if (t.estado !== 'activo') throw new AppError(`«${t.nombre}» ya terminó o se canceló: reactívalo primero`, 409);
      tratamientoId = t.id;
    }

    // Candado: dos visitas a la vez no toman la misma sesión libre ni el mismo número nuevo. Con el
    // candado puesto se RE-LEE el estado: un «Cancelar tratamiento» entre la lectura de arriba y aquí
    // ya no se cuela.
    await tx.$queryRaw`SELECT id FROM medical_records.tratamientos WHERE id = ${tratamientoId} FOR UPDATE`;
    if (!creado) {
      const ahora = await tx.tratamiento.findUnique({ where: { id: tratamientoId }, select: { estado: true, nombre: true } });
      if (!ahora || ahora.estado !== 'activo') {
        throw new AppError(`«${ahora?.nombre ?? 'El tratamiento'}» ya terminó o se canceló: reactívalo primero`, 409);
      }
    }

    const citaNueva = nueva.bookingId
      && !(await tx.tratamientoSesion.findFirst({ where: { bookingId: nueva.bookingId }, select: { id: true } }))
      ? nueva.bookingId : null;

    // «Libre» = lo que la pantalla del tratamiento enseña como «Por agendar»: la MISMA función
    // (`estadoDeSesion`), no una copia de la regla — así no se pueden separar.
    const candidatas = await tx.tratamientoSesion.findMany({
      where: { tratamientoId, cancelada: false, visitaId: null },
      orderBy: { numero: 'asc' },
      select: {
        id: true, numero: true, patientId: true, cancelada: true, bookingId: true, visitaId: true,
        booking: CITA_PARA_ESTADO,
      },
    });
    const libre = candidatas.find((x) => estadoDeSesion(x, x.booking).estado === 'por_agendar');

    if (libre) {
      await tx.tratamientoSesion.update({
        where: { id: libre.id },
        data: { visitaId: nueva.id, ...(citaNueva ? { bookingId: citaNueva } : {}) },
      });
      return { tratamientoId, creado, sesionId: libre.id, numero: libre.numero, llenoExistente: true, bookingId: citaNueva };
    }
    const agg = await tx.tratamientoSesion.aggregate({
      where: { tratamientoId }, _max: { numero: true }, _count: { _all: true },
    });
    if (agg._count._all >= SESIONES_MAX) {
      throw new AppError(`Un tratamiento tiene a lo más ${SESIONES_MAX} sesiones`, 409);
    }
    const numero = (agg._max.numero ?? 0) + 1;
    const s = await tx.tratamientoSesion.create({
      data: { tratamientoId, patientId, doctorId, numero, visitaId: nueva.id, bookingId: citaNueva },
      select: { id: true },
    });
    return { tratamientoId, creado, sesionId: s.id, numero, llenoExistente: false, bookingId: citaNueva };
  } catch (e) {
    if (e instanceof AppError) throw e;
    unicaDeSesion(e);
  }
}

/** Auditoría (NOM-024) de un seguimiento: el tratamiento si nació aquí, y la sesión de la visita. */
export async function auditarSeguimiento(
  ctx: MedicalAuthContext, request: NextRequest, patientId: string, h: SeguimientoHecho, visitaId: string,
) {
  if (h.creado) {
    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_tratamiento', resourceType: 'tratamiento', resourceId: h.tratamientoId,
      changes: { nombre: h.creado.nombre, motivo: 'seguimiento de una visita', visitaAnteriorId: h.creado.visitaAnteriorId },
      request,
    });
    await logAudit({
      patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
      action: 'create_sesion', resourceType: 'tratamiento_sesion', resourceId: h.creado.sesionAnteriorId,
      changes: { tratamientoId: h.tratamientoId, numero: 1, visitaId: h.creado.visitaAnteriorId, motivo: 'visita anterior del seguimiento' },
      request,
    });
  }
  await logAudit({
    patientId, doctorId: ctx.doctorId, userId: ctx.userId, userRole: ctx.role,
    action: h.llenoExistente ? 'link_sesion_visita' : 'create_sesion',
    resourceType: 'tratamiento_sesion', resourceId: h.sesionId,
    changes: {
      tratamientoId: h.tratamientoId, numero: h.numero, visitaId: { to: visitaId },
      ...(h.bookingId ? { bookingId: { to: h.bookingId } } : {}),
      motivo: 'Nueva Visita · es seguimiento',
    },
    request,
  });
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
      servicioId: true, servicioNombre: true, precio: true,
      booking: CITA_PARA_ESTADO,
    },
  });
}

export const SERVICIO_NOMBRE_MAX = 255;
export const PRECIO_SESION_MAX = 10_000_000;

/**
 * V1 — el SERVICIO de una sesión: `servicioId` (uno de los servicios de Citas del doctor; sólo dice de
 * dónde salió) y/o `servicioNombre` (el que se guarda y se muestra, editable). undefined = no viene.
 */
export async function parseServicioSesion(
  doctorId: string, body: Record<string, unknown>, actual: string | null,
): Promise<{ servicioId?: string | null; servicioNombre?: string | null }> {
  const out: { servicioId?: string | null; servicioNombre?: string | null } = {};
  if (body.servicioId !== undefined) {
    if (body.servicioId === null || body.servicioId === '') out.servicioId = null;
    // Re-enviar el que ya tiene no es elegirlo: aunque ese servicio ya se haya borrado (liga sin FK),
    // no debe impedir guardar el nombre o el precio.
    else if (body.servicioId === actual) out.servicioId = actual;
    else {
      if (typeof body.servicioId !== 'string') throw new AppError('servicioId inválido', 400);
      const sv = await prisma.service.findFirst({ where: { id: body.servicioId, doctorId }, select: { id: true } });
      if (!sv) throw new AppError('Servicio no encontrado', 404);
      out.servicioId = sv.id;
    }
  }
  if (body.servicioNombre !== undefined) {
    if (body.servicioNombre === null) out.servicioNombre = null;
    else {
      if (typeof body.servicioNombre !== 'string') throw new AppError('servicioNombre inválido', 400);
      const t = body.servicioNombre.trim();
      if (t.length > SERVICIO_NOMBRE_MAX) throw new AppError(`El servicio admite hasta ${SERVICIO_NOMBRE_MAX} caracteres`, 400);
      out.servicioNombre = t || null;
    }
  }
  return out;
}

/** V1 — el PRECIO de una sesión. Es dinero: escribirlo exige `flujo` (como el precio del paquete). */
export function parsePrecioSesion(ctx: MedicalAuthContext, v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (!puedeVer(ctx, 'flujo')) throw new AppError('PERMISSION_BLOCKED', 403);
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > PRECIO_SESION_MAX) throw new AppError('Precio inválido', 400);
  return Math.round(n * 100) / 100;
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
 *     sesión tiene visita, esa visita pasa a ser la de la cita (si no es ya de OTRA cita; sus
 *     plantillas conservan su fecha, 2026-10-02);
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
      // Sus plantillas tienen su propia fecha (2026-10-02): la visita toma el día de la cita sin más.
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
