/**
 * El cliente de Stripe del COBRO DE SUSCRIPCIONES (lo que los doctores nos
 * pagan a NOSOTROS).
 *
 * TIERS C3. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.6
 *
 * 🔴 NO es `@/lib/stripe`. Ése usa STRIPE_SECRET_KEY —que en prod es `sk_live`—
 * y mueve el dinero de los PACIENTES hacia los doctores (Connect). Éste usa su
 * propia variable, STRIPE_BILLING_SECRET_KEY, por decisión del usuario
 * (2026-09-14): el cobro de suscripciones arranca con una clave de MODO PRUEBA
 * en producción, sin tocar la clave viva de los pagos de pacientes. Pasar a
 * vivo es cambiar ESTA variable, no la otra.
 *
 * Tampoco revienta al importarse si falta la variable (el otro sí lo hace): el
 * cobro es opcional mientras no esté configurado, y un `throw` a nivel módulo
 * tumbaría cada ruta que lo importe — incluida la pantalla del admin que sirve
 * precisamente para descubrir que falta.
 */

import Stripe from 'stripe';

let cliente: Stripe | null | undefined;

/** `null` ⇒ el cobro no está configurado. Nunca lanza. */
export function stripeCobro(): Stripe | null {
  if (cliente !== undefined) return cliente;
  // `.trim()`: un espacio o un salto de línea pegado en la UI de Railway
  // viaja con el valor. Antes eso además tiraba el modo a 'live' y apagaba la
  // lista de doctores de prueba (hallazgo #2 del review).
  const clave = process.env.STRIPE_BILLING_SECRET_KEY?.trim();
  cliente = clave ? new Stripe(clave, { typescript: true }) : null;
  return cliente;
}

/** 'test' | 'live' según el prefijo de la clave; `null` si no hay clave. */
export function modoCobro(): 'test' | 'live' | null {
  const clave = process.env.STRIPE_BILLING_SECRET_KEY?.trim() ?? '';
  if (clave.startsWith('sk_test') || clave.startsWith('rk_test')) return 'test';
  if (clave.startsWith('sk_live') || clave.startsWith('rk_live')) return 'live';
  // 🔴 Un prefijo que no reconocemos cae en 'test', NO en 'live'. Fallar hacia
  // 'live' apagaba la lista de STRIPE_BILLING_TEST_DOCTORS —que sólo existe en
  // modo prueba—, así que una clave rara dejaba a CUALQUIER doctor "pagar" con
  // 4242 4242… y subir de plan gratis. Equivocarse hacia 'test' sólo esconde el
  // cobro; equivocarse hacia 'live' lo regala (hallazgo #2 del review).
  return clave ? 'test' : null;
}

/**
 * ¿Se le puede OFRECER a alguien que pague?
 *
 * 🔴 Exige las DOS variables, no sólo la clave. Sin el secreto del webhook,
 * Stripe cobraría y nosotros nunca nos enteraríamos: el doctor pagaría y su
 * plan jamás subiría. Cobrar sin poder cumplir es peor que no cobrar.
 */
export function cobroListo(): boolean {
  return !!stripeCobro() && !!process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
}

/**
 * ¿Este doctor puede ver y usar el cobro AHORA?
 *
 * 🔴 En MODO PRUEBA, sólo los doctores de STRIPE_BILLING_TEST_DOCTORS (slugs
 * separados por coma). Sin esto, con una clave de prueba en producción
 * CUALQUIER doctor podría "pagar" con la tarjeta de prueba 4242 4242… y el
 * webhook le subiría el plan a PRO gratis. Lista vacía en modo prueba ⇒ nadie.
 * En modo vivo no hay lista: el cobro es real para todos.
 */
export function doctorPuedeUsarCobro(slug: string): boolean {
  if (!cobroListo()) return false;
  if (modoCobro() !== 'test') return true;
  const permitidos = (process.env.STRIPE_BILLING_TEST_DOCTORS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return permitidos.includes(slug);
}

export function esErrorDeStripe(e: unknown): e is InstanceType<typeof Stripe.errors.StripeError> {
  return e instanceof Stripe.errors.StripeError;
}
