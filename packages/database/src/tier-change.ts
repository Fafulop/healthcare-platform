/**
 * setDoctorTier — el ÚNICO camino de escritura de `Doctor.tier`.
 *
 * TIERS C2. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.4
 * (huecos H2 y H3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ EXISTE ESTE ARCHIVO
 *
 * Hasta C2 el tier lo escribía UN solo sitio —`PATCH /api/admin/doctor-tier`—,
 * y ahí vivían, sueltas, las reglas que protegen ese cambio: la validación de
 * case canónico y el guard de cupo. Su cabecera decía, literalmente, "this is
 * the ONLY write path for the tier".
 *
 * El webhook de C3 rompe esa frase: al confirmarse un pago tiene que mover el
 * tier él mismo. Si escribiera `doctor.update` directo, se saltaría el guard de
 * cupo —que sólo existía dentro de la ruta del admin— y aparecería una cuenta
 * por encima de su tope que el propio admin declara imposible. Dos caminos con
 * reglas distintas sobre el mismo dato es el modo de fallo que este repo ya
 * pagó dos veces, porque *parece* que funciona.
 *
 * Así que las reglas se mudan aquí y los dos llamadores pasan por la misma
 * puerta. Las cuatro invariantes son de esta función, no de quien la llama:
 *
 *   1. CASE CANÓNICO — se rechaza, no se normaliza. Un 'free' guardado no
 *      empata con TIER_EXCLUDED_KEYS: `tierAllows` es fail-open, así que la
 *      cuenta se comportaría como PRO mientras la UI dice FREE.
 *   2. GUARD DE CUPO — un cambio que dejaría la cuenta POR ENCIMA de su tope se
 *      rechaza (decisión del usuario, 2026-09-13). Medido en prod: bajar a
 *      dr-david-salazar-vela (94 activos) a FREE (50) se rechaza.
 *   3. AUDITORÍA — la fila de tier_change_log se escribe en la MISMA
 *      transacción que el update. Antes esto era un console.log, y "pagué y no
 *      pasó nada" no se contesta con logs de Railway que rotan.
 *   4. IDEMPOTENCIA — Stripe REINTENTA sus webhooks. El mismo `evt_` no puede
 *      mover el tier dos veces ni dejar dos filas de bitácora.
 *
 * NO LANZA para los resultados de negocio esperados: devuelve un resultado
 * discriminado. Un rechazo por cupo no es una avería, y el llamador tiene que
 * poder contarlo con números. Sólo se propagan los errores de infraestructura.
 */

import {
  DOCTOR_TIERS,
  PATIENT_STATUS_COUNTED_AGAINST_QUOTA,
  maxPatientsFor,
  type DoctorTier,
} from './permissions';

/** De dónde viene el cambio. Se guarda para poder auditarlo después. */
export type OrigenCambioTier = 'admin' | 'webhook' | 'script';

export interface SetDoctorTierArgs {
  /** El cliente Prisma (o uno equivalente). NO una transacción: se abre una adentro. */
  db: TierWriteDb;
  doctorId: string;
  /** CRUDO, sin validar: validarlo es trabajo de esta función. */
  tier: string;
  origen: OrigenCambioTier;
  /** Quién lo movió: correo del admin, o `stripe:evt_…`. */
  actor: string;
  /**
   * El id del evento de Stripe, cuando lo hay. Es la llave de idempotencia:
   * si ya existe una fila con este id, no se vuelve a mover nada.
   */
  stripeEventId?: string | null;
  motivo?: string | null;
}

export type SetDoctorTierResult =
  | {
      ok: true;
      /** false ⇒ ya estaba en ese tier, o el evento ya se había procesado. */
      changed: boolean;
      /** true ⇒ se reconoció un `stripeEventId` ya visto. */
      duplicado?: boolean;
      from: string;
      to: DoctorTier;
    }
  | { ok: false; code: 'INVALID_TIER'; mensaje: string }
  | { ok: false; code: 'NOT_FOUND'; mensaje: string }
  | {
      ok: false;
      code: 'QUOTA_EXCEEDED';
      mensaje: string;
      /** Los números, para que el llamador no tenga que recalcularlos. */
      current: number;
      limit: number;
      tier: DoctorTier;
    };

/** Lo mínimo que se necesita del cliente. Estructural, como el resto del paquete. */
export interface TierWriteDb {
  doctor: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; slug: true; tier: true };
    }): Promise<{ id: string; slug: string; tier: string } | null>;
    update(args: { where: { id: string }; data: { tier: string } }): Promise<unknown>;
  };
  patient: { count(args: { where: { doctorId: string; status: string } }): Promise<number> };
  tierChangeLog: {
    findUnique(args: {
      where: { stripeEventId: string };
      select: { id: true; toTier: true; fromTier: true };
    }): Promise<{ id: string; toTier: string; fromTier: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  $transaction<T>(operaciones: Promise<T>[]): Promise<T[]>;
}

function esCanonico(valor: unknown): valor is DoctorTier {
  return typeof valor === 'string' && (DOCTOR_TIERS as readonly string[]).includes(valor);
}

export async function setDoctorTier(args: SetDoctorTierArgs): Promise<SetDoctorTierResult> {
  const { db, doctorId, tier, origen, actor, stripeEventId, motivo } = args;

  // ── 1. Case canónico ──────────────────────────────────────────────────────
  if (!esCanonico(tier)) {
    return {
      ok: false,
      code: 'INVALID_TIER',
      mensaje:
        `Tier inválido: ${JSON.stringify(tier)}. ` +
        `Valores permitidos (sensible a mayúsculas): ${DOCTOR_TIERS.join(', ')}.`,
    };
  }

  // ── 2. Idempotencia ───────────────────────────────────────────────────────
  // Antes de tocar nada: si este evento ya se procesó, no se repite. Se
  // comprueba aquí Y se vuelve a atrapar abajo por el UNIQUE, porque entre esta
  // lectura y la escritura cabe un reintento de Stripe.
  if (stripeEventId) {
    const yaVisto = await db.tierChangeLog.findUnique({
      where: { stripeEventId },
      select: { id: true, toTier: true, fromTier: true },
    });
    if (yaVisto) {
      return {
        ok: true,
        changed: false,
        duplicado: true,
        from: yaVisto.fromTier,
        to: yaVisto.toTier as DoctorTier,
      };
    }
  }

  const doctor = await db.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, slug: true, tier: true },
  });
  if (!doctor) {
    return { ok: false, code: 'NOT_FOUND', mensaje: `No existe el doctor ${doctorId}` };
  }

  // Idempotente: ya está donde se le quiere poner. No se escribe bitácora de un
  // no-cambio; el rastro es de lo que CAMBIÓ.
  if (doctor.tier === tier) {
    return { ok: true, changed: false, from: doctor.tier, to: tier };
  }

  // ── 3. Guard de cupo ──────────────────────────────────────────────────────
  // Corre para CUALQUIER origen, que es el punto entero de este archivo: el
  // webhook de C3 no puede saltárselo. Subir de plan nunca lo dispara (los
  // topes crecen); lo que protege es todo movimiento a la baja.
  const nuevoTope = maxPatientsFor(tier);
  if (nuevoTope !== null) {
    const activos = await db.patient.count({
      where: { doctorId: doctor.id, status: PATIENT_STATUS_COUNTED_AGAINST_QUOTA },
    });
    if (activos > nuevoTope) {
      return {
        ok: false,
        code: 'QUOTA_EXCEEDED',
        mensaje:
          `${doctor.slug} tiene ${activos} pacientes activos y el plan ${tier} permite ` +
          `${nuevoTope}. Archiva ${activos - nuevoTope} expediente(s) antes de bajar el plan ` +
          `(archivar no borra nada y libera lugar).`,
        current: activos,
        limit: nuevoTope,
        tier,
      };
    }
  }

  // ── 4. Escritura + bitácora, en la MISMA transacción ──────────────────────
  // Si la bitácora falla, el tier NO se mueve. Un cambio de plan sin rastro es
  // justo lo que este archivo viene a eliminar, así que no se acepta "se movió
  // pero no se anotó".
  try {
    await db.$transaction([
      db.doctor.update({ where: { id: doctor.id }, data: { tier } }) as Promise<unknown>,
      db.tierChangeLog.create({
        data: {
          doctorId: doctor.id,
          fromTier: doctor.tier,
          toTier: tier,
          origen,
          actor,
          stripeEventId: stripeEventId ?? null,
          motivo: motivo ?? null,
        },
      }) as Promise<unknown>,
    ]);
  } catch (e) {
    // P2002 sobre stripeEventId ⇒ otro reintento del MISMO evento ganó la
    // carrera entre la comprobación de arriba y esta escritura. No es un error:
    // el cambio ya quedó hecho por el otro.
    if (esChoqueDeEventoDuplicado(e, stripeEventId)) {
      return { ok: true, changed: false, duplicado: true, from: doctor.tier, to: tier };
    }
    throw e;
  }

  return { ok: true, changed: true, from: doctor.tier, to: tier };
}

function esChoqueDeEventoDuplicado(e: unknown, stripeEventId?: string | null): boolean {
  if (!stripeEventId) return false;
  const code = (e as { code?: string } | null)?.code;
  if (code !== 'P2002') return false;
  // El target puede venir como arreglo de campos o como string, según versión.
  const target = (e as { meta?: { target?: unknown } } | null)?.meta?.target;
  const texto = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return texto.includes('stripe_event_id') || texto.includes('stripeEventId') || texto === '';
}
