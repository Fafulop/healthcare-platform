/**
 * Gate de las FORMAS del webhook de cobro (TIERS C3) — la red que faltaba el
 * día que una cancelación se guardó como "no cancela".
 *
 * Run: pnpm gate:cobro
 *
 * Por qué existe: `extraerDatos` lee una suscripción de Stripe campo por campo,
 * y en la API `2026-04-22.dahlia` varios de esos campos NO están donde la
 * intuición (y la mayoría de los ejemplos de internet) dicen. Ya van TRES:
 *
 *   1. `current_period_end` vive en el ITEM, no en la suscripción.
 *   2. La suscripción de una factura vive en `parent.subscription_details`.
 *   3. 🔴 Una cancelación programada NO prende `cancel_at_period_end`: Stripe
 *      deja ese flag en `false`, el status en `active`, y expresa la baja en
 *      `cancel_at` + `canceled_at`. Medido en prod el 2026-09-17 con una
 *      cancelación real: la fila quedó diciendo que no cancelaba, y «Mi Cuenta»
 *      le prometió al doctor un «próximo cargo» el día exacto en que se le
 *      acababa el servicio.
 *
 * Los tres son el MISMO error: leer un campo que existe, responde sin lanzar, y
 * miente. Un type-check no los ve —los campos son válidos en el tipo— y no hay
 * suite de unit tests en el monorepo. Por eso esto es un gate: le pasa a
 * `extraerDatos` y a `suscripcionDeFactura` payloads con la forma REAL que
 * devolvió prod, y exige la lectura correcta.
 *
 * Al agregar un campo a `DatosSuscripcion`, agrega aquí su caso.
 */
import type Stripe from 'stripe';
import { extraerDatos, suscripcionDeFactura } from '../apps/api/src/lib/cobro-webhook';
import { bloqueaOtroCheckout, esSuscripcionViva } from '../apps/api/src/lib/cobro-planes';
import { DOCTOR_TIERS } from '../packages/database/src/permissions';

const fallos: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);

function revisar(nombre: string, condicion: boolean, detalle: string) {
  if (condicion) ok(nombre);
  else fallos.push(`${nombre} — ${detalle}`);
}

const SEG = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Suscripción base con la forma de dahlia. `extra` la muta para cada caso. */
function suscripcion(extra: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_TEST',
    customer: 'cus_TEST',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: { id: 'price_TEST' },
          // 🔴 En el ITEM. Si alguien lo "arregla" moviéndolo a la suscripción,
          // este gate se cae.
          current_period_end: SEG('2026-10-17T22:49:59Z'),
        },
      ],
    },
    ...extra,
  } as unknown as Stripe.Subscription;
}

console.log('Formas del webhook de cobro (dahlia):\n');

// ── 1. Suscripción viva y corriente ──────────────────────────────────────────
{
  const d = extraerDatos(suscripcion());
  revisar('viva: no marca cancelación', d.cancelAtPeriodEnd === false, `dio ${d.cancelAtPeriodEnd}`);
  revisar(
    'viva: lee current_period_end DEL ITEM',
    d.currentPeriodEnd?.toISOString() === '2026-10-17T22:49:59.000Z',
    `dio ${d.currentPeriodEnd?.toISOString()}`,
  );
  revisar('viva: lee el price del item', d.priceId === 'price_TEST', `dio ${d.priceId}`);
}

// ── 2. 🔴 El caso de 2026-09-17: cancelación programada, forma EXACTA de prod ─
{
  const d = extraerDatos(
    suscripcion({
      status: 'active', // sigue activa
      cancel_at_period_end: false, // ← el flag NO se prende
      cancel_at: SEG('2026-10-17T22:49:59Z'),
      canceled_at: SEG('2026-09-17T22:58:21Z'),
    } as Partial<Stripe.Subscription>),
  );
  revisar(
    'cancelación programada: SE DETECTA aunque cancel_at_period_end sea false',
    d.cancelAtPeriodEnd === true,
    'volvió el bug de 2026-09-17: la baja se guardaría como "no cancela"',
  );
  revisar(
    'cancelación programada: termina el día de cancel_at',
    d.terminaEn?.toISOString() === '2026-10-17T22:49:59.000Z',
    `dio ${d.terminaEn?.toISOString()}`,
  );
}

// ── 3. Cancelación a una fecha PROPIA (cancel_at ≠ fin de periodo) ───────────
{
  const d = extraerDatos(
    suscripcion({
      cancel_at: SEG('2026-12-01T00:00:00Z'),
      canceled_at: SEG('2026-09-17T22:58:21Z'),
    } as Partial<Stripe.Subscription>),
  );
  revisar(
    'cancel_at arbitrario: manda sobre el fin de periodo',
    d.terminaEn?.toISOString() === '2026-12-01T00:00:00.000Z',
    `dio ${d.terminaEn?.toISOString()} — se usó el fin de periodo y la pantalla diría mal la fecha`,
  );
}

// ── 4. La forma VIEJA sigue entendiéndose ───────────────────────────────────
{
  const d = extraerDatos(suscripcion({ cancel_at_period_end: true } as Partial<Stripe.Subscription>));
  revisar('cancel_at_period_end=true sigue contando', d.cancelAtPeriodEnd === true, `dio ${d.cancelAtPeriodEnd}`);
}

// ── 5. La suscripción de una factura ────────────────────────────────────────
{
  const conParent = { parent: { subscription_details: { subscription: 'sub_DESDE_PARENT' } } };
  revisar(
    'factura: lee parent.subscription_details',
    suscripcionDeFactura(conParent as unknown as Stripe.Invoice) === 'sub_DESDE_PARENT',
    'no leyó la suscripción de donde vive en dahlia',
  );
  revisar(
    'factura sin suscripción: null, no revienta',
    suscripcionDeFactura({} as Stripe.Invoice) === null,
    'debía devolver null',
  );
}

// ── 6. Suscripción con varios items ─────────────────────────────────────────
{
  const d = extraerDatos(
    suscripcion({
      items: {
        data: [
          { price: { id: 'price_A' }, current_period_end: SEG('2026-10-17T22:49:59Z') },
          { price: { id: 'price_B' }, current_period_end: SEG('2026-10-17T22:49:59Z') },
        ],
      },
    } as unknown as Partial<Stripe.Subscription>),
  );
  revisar('multi-item: se cuenta para poder avisar', d.numeroDeItems === 2, `dio ${d.numeroDeItems}`);
}

// ── 7. Una cancelación YA EJECUTADA no se queda en "va a cancelar" ──────────
// Stripe deja `cancel_at` puesto después de que la baja ocurre. Sin la guarda
// por status, la fila diría para siempre "cancela, termina <fecha pasada>" en
// vez de "cancelada" (hallazgo #3 del review).
{
  const d = extraerDatos(
    suscripcion({
      status: 'canceled',
      cancel_at: SEG('2026-10-17T22:49:59Z'),
      canceled_at: SEG('2026-09-17T22:58:21Z'),
    } as Partial<Stripe.Subscription>),
  );
  revisar(
    'ya cancelada: deja de decir "va a cancelar"',
    d.cancelAtPeriodEnd === false,
    'se quedaría en "Cancela" con fecha pasada en vez de "Cancelada"',
  );
}

// ── 8. 🔴 El ORDEN de DOCTOR_TIERS carga dinero ─────────────────────────────
// `cobro-planes` y `cobro-webhook` lo usan como ranking POR POSICIÓN para
// "nunca vender por debajo del actual" y "un pago sólo sube el plan".
// Alfabetizarlo (BASICO · FREE · LAB · PRO) invierte las dos en silencio y no
// hay type-check que lo note (hallazgo #6 del review).
{
  const esperado = ['FREE', 'BASICO', 'PRO', 'LAB'];
  revisar(
    'DOCTOR_TIERS conserva su orden por capacidad',
    JSON.stringify([...DOCTOR_TIERS]) === JSON.stringify(esperado),
    `dio ${JSON.stringify([...DOCTOR_TIERS])}; se esperaba ${JSON.stringify(esperado)} — ` +
      `mover un tier de lugar invierte las guardas de venta y de cobro`,
  );
}

// ── 9. 🔴 `incomplete` NO puede bloquear la venta ───────────────────────────
// Se creó la suscripción pero NUNCA se cobró (3DS pendiente o tarjeta
// rechazada tras el Checkout). Contarla como "ya tiene suscripción" dejaba al
// doctor ~23 h sin botón y con un 409 que le afirmaba algo falso, sin salida
// (hallazgo #1 del review). Sigue siendo "viva" para la lógica del webhook.
{
  revisar(
    'incomplete: no bloquea abrir otro checkout',
    bloqueaOtroCheckout('incomplete') === false,
    'el doctor se queda sin botón y con un 409 falso hasta que Stripe la expire',
  );
  revisar(
    'incomplete: sigue contando como viva para el webhook',
    esSuscripcionViva('incomplete') === true,
    'el webhook dejaría de reconocer su propia suscripción a medio pagar',
  );
  const bloqueantes = ['active', 'trialing', 'past_due', 'unpaid'];
  revisar(
    'lo que SÍ se está cobrando sigue bloqueando',
    bloqueantes.every((s) => bloqueaOtroCheckout(s)),
    `alguno de ${JSON.stringify(bloqueantes)} dejó de bloquear — se podría cobrar dos veces`,
  );
}

if (fallos.length > 0) {
  console.error(`\nCOBRO FAIL (${fallos.length}):`);
  for (const f of fallos) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nFormas del webhook de cobro OK.');
