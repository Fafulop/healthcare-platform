/**
 * fijarPrecioDeTier — la ESCRITURA del mapa tier ↔ precio de Stripe.
 *
 * TIERS C2. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.3
 *
 * Vive en el paquete y no dentro de `PATCH /api/admin/billing` por la misma
 * razón que `setDoctorTier`: la ruta también habla con Stripe, y eso la vuelve
 * imposible de ejecutar en una prueba. Aquí la lógica de BD se puede correr de
 * verdad. La ruta valida el price contra Stripe y luego llama esto.
 *
 * NO valida contra Stripe: eso es trabajo de la ruta, ANTES de llamar aquí.
 *
 * Dos reglas que el code review encontró rotas en la primera versión (que
 * escribía directo en la ruta):
 *
 *   1. 🔴 UN PRICE NO SE MUDA DE TIER EN SILENCIO. El `upsert` iba por
 *      `stripePriceId` y su rama `update` reescribía `tier`, mientras que el
 *      `updateMany` sólo desactivaba precios del tier DESTINO. Pegar el price de
 *      PRO en BÁSICO movía la fila a BÁSICO y dejaba a PRO SIN PRECIO — con la
 *      ruta respondiendo éxito. Ahora se rechaza y se dice qué tier lo usa.
 *
 *   2. LA NOTA INTERNA NO SE BORRA POR OMISIÓN. La pantalla nunca manda
 *      `notaInterna`, así que la ruta la leía como `null` y cada «Cambiar» —aun
 *      re-guardando el mismo price— borraba la nota guardada. `undefined`
 *      significa "no la toques"; sólo un valor explícito la cambia.
 */

import { DOCTOR_TIERS, type DoctorTier } from './permissions';

export interface TierPriceDb {
  tierPrice: {
    findUnique(args: {
      where: { stripePriceId: string };
      select: { tier: true; activo: true };
    }): Promise<{ tier: string; activo: boolean } | null>;
    updateMany(args: {
      where: { tier: string; activo: boolean; stripePriceId: { not: string } };
      data: { activo: boolean };
    }): Promise<unknown>;
    upsert(args: {
      where: { stripePriceId: string };
      create: { tier: string; stripePriceId: string; activo: boolean; notaInterna: string | null };
      update: { activo: boolean; notaInterna?: string | null };
    }): Promise<unknown>;
  };
  $transaction<T>(operaciones: Promise<T>[]): Promise<T[]>;
}

export type FijarPrecioResult =
  | { ok: true; tier: DoctorTier; stripePriceId: string }
  | { ok: false; code: 'INVALID_TIER' | 'PRICE_EN_OTRO_TIER'; mensaje: string };

export async function fijarPrecioDeTier(args: {
  db: TierPriceDb;
  tier: string;
  stripePriceId: string;
  /** `undefined` = no tocar la nota guardada. `null` o string = reemplazarla. */
  notaInterna?: string | null;
}): Promise<FijarPrecioResult> {
  const { db, tier, stripePriceId, notaInterna } = args;

  if (!(DOCTOR_TIERS as readonly string[]).includes(tier)) {
    return {
      ok: false,
      code: 'INVALID_TIER',
      mensaje: `Tier inválido: ${JSON.stringify(tier)}. Permitidos: ${DOCTOR_TIERS.join(', ')}.`,
    };
  }

  // ── Regla 1: el price no puede pertenecer ya a OTRO tier ─────────────────
  const existente = await db.tierPrice.findUnique({
    where: { stripePriceId },
    select: { tier: true, activo: true },
  });
  if (existente && existente.tier !== tier) {
    return {
      ok: false,
      code: 'PRICE_EN_OTRO_TIER',
      mensaje:
        `Ese precio ya está asignado al plan ${existente.tier}` +
        `${existente.activo ? ' (es su precio ACTIVO)' : ' (como precio anterior, inactivo)'}. ` +
        `Un precio de Stripe pertenece a un solo plan: crea otro precio en Stripe para ${tier}.`,
    };
  }

  // ── Desactivar el anterior y activar el nuevo, EN ESE ORDEN ──────────────
  // El índice único PARCIAL (`WHERE activo`) prohíbe dos activos del mismo
  // tier y se revisa por sentencia (no es diferible), así que primero se apaga
  // el viejo y después se prende el nuevo. En una transacción: si la segunda
  // falla, el tier no se queda sin precio.
  await db.$transaction([
    db.tierPrice.updateMany({
      where: { tier, activo: true, stripePriceId: { not: stripePriceId } },
      data: { activo: false },
    }) as Promise<unknown>,
    db.tierPrice.upsert({
      where: { stripePriceId },
      create: { tier, stripePriceId, activo: true, notaInterna: notaInterna ?? null },
      // Regla 2: `tier` NO se reescribe (la regla 1 ya garantiza que coincide)
      // y la nota sólo entra si el llamador la mandó.
      update: { activo: true, ...(notaInterna !== undefined ? { notaInterna } : {}) },
    }) as Promise<unknown>,
  ]);

  return { ok: true, tier: tier as DoctorTier, stripePriceId };
}
