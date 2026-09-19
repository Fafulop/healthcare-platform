/**
 * Qué planes se le pueden VENDER a una cuenta (TIERS C3).
 *
 * Una sola función la usan el estado (lo que la pantalla ofrece) y el checkout
 * (lo que el servidor acepta), para que no puedan discrepar: si la pantalla
 * ofreciera un plan que el checkout rechaza —o al revés, que el checkout
 * aceptara uno que la pantalla no ofrece— el cliente sería la frontera.
 *
 * Reglas:
 *   - Sólo precios ACTIVOS del mapa, que Stripe reconozca, recurrentes y no
 *     archivados. Un precio mal configurado simplemente no se ofrece.
 *   - LAB no se vende (es por invitación).
 *   - 🔴 Por defecto NUNCA un plan por DEBAJO del actual (excepción: `incluirMenores`,
 *     sólo sin suscripción viva y nunca para LAB — 04 §12.6 #4). Hoy 10 cuentas están en PRO
 *     puestas a mano y no pagan nada; si pudieran contratar BÁSICO, el pago
 *     entraría y `setDoctorTier` se negaría a bajarlas (guard de cupo, o
 *     simplemente porque bajar no es lo que se pagó) — dinero cobrado sin nada
 *     que entregar. Así una cuenta PRO sólo puede contratar PRO.
 *   - Un tier desconocido en la BD no compra nada: no se le vende a una fila
 *     corrupta, se le avisa al admin por la pantalla de Cobro.
 */

import type Stripe from 'stripe';
import { DOCTOR_TIERS, TIER_LABELS, type DoctorTier, type PrismaClient } from '@healthcare/database';

export interface PlanVendible {
  tier: DoctorTier;
  label: string;
  stripePriceId: string;
  montoCentavos: number;
  moneda: string;
  intervalo: string;
  /** Por DEBAJO del plan actual: pagarlo BAJA la cuenta (04 §12.6 #4). */
  baja: boolean;
}

const rango = (tier: string) => (DOCTOR_TIERS as readonly string[]).indexOf(tier);

export async function planesVendibles(
  db: PrismaClient,
  cliente: Stripe,
  tierActual: string,
  opciones: { incluirMenores?: boolean } = {},
): Promise<PlanVendible[]> {
  const rangoActual = rango(tierActual);
  if (rangoActual < 0) return [];
  // TIERS 04 §12.6 #4 (P3a): quien NO tiene suscripción viva puede comprar un
  // plan MENOR al suyo —p.ej. un PRO que canceló y vuelve en BÁSICO—; el que
  // llama decide si cabe (R4, `cabeEnPlan`). NUNCA para LAB: son cortesías y
  // ofrecerles un plan menor sería invitarlas a bajarse por accidente.
  const permitirMenores = opciones.incluirMenores === true && tierActual !== 'LAB';

  const filas = await db.tierPrice.findMany({ where: { activo: true } });
  const planes: PlanVendible[] = [];

  for (const fila of filas) {
    if (fila.tier === 'LAB') continue;
    const r = rango(fila.tier);
    if (r < 0 || (r < rangoActual && !permitirMenores)) continue;

    try {
      const price = await cliente.prices.retrieve(fila.stripePriceId);
      if (!price.active || !price.recurring || price.unit_amount == null) continue;
      planes.push({
        tier: fila.tier as DoctorTier,
        label: TIER_LABELS[fila.tier as DoctorTier],
        stripePriceId: fila.stripePriceId,
        montoCentavos: price.unit_amount,
        moneda: price.currency.toUpperCase(),
        intervalo: price.recurring.interval,
        baja: r < rangoActual,
      });
    } catch (e) {
      // Un id que Stripe no reconoce (p.ej. uno de prueba tras pasar a vivo) no
      // se ofrece. La pantalla del admin es donde se ve y se arregla.
      console.warn('[COBRO] precio no vendible', fila.tier, fila.stripePriceId, e);
    }
  }

  return planes.sort((a, b) => rango(a.tier) - rango(b.tier));
}

/**
 * Status de Stripe que significan "ya tiene una suscripción viva". Con
 * cualquiera de estos NO se ofrece otro checkout: un segundo checkout crearía
 * una SEGUNDA suscripción y le cobraría dos veces (decisión del usuario: en C3
 * sólo se suscribe quien no tiene suscripción; cambiar de plan es por el admin).
 */
export const STATUS_VIVOS = ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'] as const;

export function esSuscripcionViva(status: string | null | undefined): boolean {
  return !!status && (STATUS_VIVOS as readonly string[]).includes(status);
}

/**
 * ¿Su suscripción impide OFRECERLE otro plan? Es `esSuscripcionViva` menos
 * `incomplete`, y la diferencia es la de "se le está cobrando" contra "existe
 * un objeto en Stripe".
 *
 * 🔴 `incomplete` NUNCA se cobró: el Checkout se completó pero el pago quedó
 * pendiente de 3DS o la tarjeta se rechazó. Contarla aquí le quitaba al doctor
 * el botón de «Suscribirme» durante las ~23 h que Stripe tarda en expirarla,
 * sin decirle por qué y sin nada que pudiera hacer —ni el portal de Stripe
 * puede pagar esa primera factura— (hallazgo #1 del review de C3).
 *
 * No hay riesgo de cobro doble: `POST /api/billing/checkout` cancela esa
 * suscripción muerta en Stripe ANTES de abrir la nueva, y sólo después de
 * confirmar contra Stripe que sigue en `incomplete`.
 */
export function bloqueaOtroCheckout(status: string | null | undefined): boolean {
  return esSuscripcionViva(status) && status !== 'incomplete';
}

/**
 * La fila de cobro del doctor, SÓLO si su Customer existe en el modo actual de
 * Stripe. Si no existe, la fila es de OTRO modo (o se borró en el dashboard) y
 * se trata como si no hubiera fila.
 *
 * 🔴 Existe por el review de C3 (#2). "Pasar a vivo" es cambiar
 * STRIPE_BILLING_SECRET_KEY, pero cada doctor de la lista de prueba que intentó
 * pagar dejó guardado un Customer de MODO PRUEBA (`cus_…` que la clave viva no
 * reconoce) y, si llegó a pagar, una suscripción en `active`. Sin esto, tras el
 * cambio de clave: el checkout reventaba con "No such customer", el portal daba
 * 409 aunque `status` decía que había portal, y —peor— el `active` de prueba lo
 * bloqueaba como "ya tienes suscripción". Ninguno podía suscribirse de verdad,
 * y no había salida porque el Customer sólo se crea cuando la columna es null.
 *
 * `customerObsoleto` devuelve el id viejo para que el checkout lo reemplace.
 * Cualquier error de Stripe que NO sea "no existe" se PROPAGA: una caída de
 * Stripe no puede leerse como "tus datos de pago ya no existen".
 */
export async function filaDeCobroVigente(
  db: PrismaClient,
  cliente: Stripe,
  doctorId: string,
) {
  const fila = await db.subscription.findUnique({ where: { doctorId } });
  if (!fila?.stripeCustomerId) return { fila, customerObsoleto: null as string | null };

  try {
    const customer = await cliente.customers.retrieve(fila.stripeCustomerId);
    if ((customer as { deleted?: boolean }).deleted) {
      return { fila: null, customerObsoleto: fila.stripeCustomerId };
    }
    return { fila, customerObsoleto: null as string | null };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === 'resource_missing') {
      return { fila: null, customerObsoleto: fila.stripeCustomerId };
    }
    throw e;
  }
}

/**
 * El margen de «dejar de pagar» (TIERS 04 §11, decisión del usuario): 15 días
 * contados desde el fin del último periodo PAGADO (`subscriptions.pagado_hasta`,
 * no `current_period_end`: ver B2a). Una sola fuente para la pantalla y el cron,
 * para que la fecha que ve el doctor sea la misma en que actúa el cron.
 */
export const DIAS_DE_MARGEN = 15;

export function finDelMargen(pagadoHasta: Date): Date {
  return new Date(pagadoHasta.getTime() + DIAS_DE_MARGEN * 24 * 60 * 60 * 1000);
}
