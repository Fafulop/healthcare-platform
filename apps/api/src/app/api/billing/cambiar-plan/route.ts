/**
 * POST /api/billing/cambiar-plan — SUBIR de plan teniendo ya una suscripción
 * (TIERS 04 §12.2 B4 · §12.6 #3). Body: `{ tier, confirmar?, prorationDate? }`.
 *
 *   - sin `confirmar` ⇒ NO cambia nada: le pregunta a Stripe cuánto cobraría
 *     HOY (el prorrateo) y lo devuelve para que el doctor lo vea antes.
 *   - `confirmar: true` ⇒ cambia el precio de la suscripción y cobra la
 *     diferencia a la tarjeta guardada.
 *
 * Por qué hace falta: el checkout sólo sirve a quien NO tiene suscripción (un
 * segundo checkout crearía otra y cobraría doble) y el portal de Stripe tiene
 * el cambio de plan APAGADO a propósito (03 §H4). Sin esto, un BÁSICO que
 * paga no tenía forma de pasar a PRO.
 *
 * 🔴 NO sube el plan. Lo sube el webhook con el `invoice.paid` del prorrateo,
 * igual que en el checkout: el veredicto lo da el dinero cobrado.
 *
 * 🔴 TODO O NADA (`payment_behavior: 'error_if_incomplete'`, decisión del
 * usuario 2026-09-18): una sola llamada cambia el precio, cobra la diferencia
 * y QUITA una cancelación agendada (regla R8). Si el cobro no pasa —rechazo, o
 * el banco pide 3DS— Stripe no cambia NADA. No soporta 3DS a propósito: la
 * alternativa (pending updates) no admite quitar la cancelación en la misma
 * llamada y necesitaba pasos extra en el webhook. Si 3DS empieza a aparecer, se
 * agrega entonces.
 *
 * SEGURIDAD (§3.7): el doctor sale de la SESIÓN y el precio del mapa
 * `tier_prices` vía `planesVendibles`. Del navegador sólo viaja el tier.
 */

import { NextResponse } from 'next/server';
import { prisma, DOCTOR_TIERS } from '@healthcare/database';
import { stripeCobro, doctorPuedeUsarCobro, esErrorDeStripe } from '@/lib/stripe-cobro';
import { puertaDeCobro, cobroNoDisponible } from '@/lib/cobro-auth';
import { planesVendibles, filaDeCobroVigente } from '@/lib/cobro-planes';

const rango = (t: string) => (DOCTOR_TIERS as readonly string[]).indexOf(t);

/** Cuánto vale un preview: pasado esto se pide recalcular en vez de cobrar otro monto. */
const MAX_EDAD_PRORRATEO_S = 30 * 60;

export async function POST(request: Request) {
  const puerta = await puertaDeCobro(request);
  if (!puerta.ok) return puerta.respuesta;
  const { ctx } = puerta;

  const cliente = stripeCobro();
  if (!cliente || !doctorPuedeUsarCobro(ctx.slug)) return cobroNoDisponible();

  const body = await request.json().catch(() => null);
  const tierPedido = typeof body?.tier === 'string' ? body.tier : '';
  const confirmar = body?.confirmar === true;

  try {
    const { fila } = await filaDeCobroVigente(prisma, cliente, ctx.doctorId);
    if (!fila?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No tienes una suscripción activa.' }, { status: 409 });
    }

    // Fresca de Stripe, no la fila: es la que se va a modificar.
    const sub = await cliente.subscriptions.retrieve(fila.stripeSubscriptionId);
    if (sub.status !== 'active') {
      // `past_due`/`unpaid`: primero hay que ponerse al corriente. Subir de plan
      // con un cobro fallando cobraría OTRA cosa encima de la deuda.
      return NextResponse.json(
        { error: 'Tu suscripción no está al corriente. Revisa tu tarjeta antes de cambiar de plan.' },
        { status: 409 },
      );
    }
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1) {
      console.error('[COBRO] cambiar-plan: suscripción con items inesperados', ctx.slug, sub.id);
      return NextResponse.json({ error: 'No se pudo cambiar el plan. Escríbenos.' }, { status: 409 });
    }

    // Sólo planes POR ENCIMA del actual. Bajar es otro flujo (§12.6 #7), al
    // final del periodo y sólo si cabe (R4) — no un cobro inmediato.
    const planes = await planesVendibles(prisma, cliente, ctx.tier);
    const plan = planes.find((p) => p.tier === tierPedido && rango(p.tier) > rango(ctx.tier));
    if (!plan) {
      return NextResponse.json({ error: 'Ese plan no está disponible para tu cuenta.' }, { status: 400 });
    }
    if (item.price.id === plan.stripePriceId) {
      return NextResponse.json({ error: 'Ya pagas ese plan.' }, { status: 409 });
    }
    // Todo el texto de la pantalla («lo que resta de tu periodo», «desde el X
    // pagarás…») supone el MISMO intervalo. Mensual→anual reiniciaría el ciclo
    // y esas frases mentirían (review de #3, hallazgo 2). Hoy todo es mensual.
    if (item.price.recurring?.interval !== plan.intervalo) {
      console.error('[COBRO] cambiar-plan: intervalos distintos', ctx.slug, item.price.recurring?.interval, plan.intervalo);
      return NextResponse.json({ error: 'No se pudo cambiar el plan. Escríbenos.' }, { status: 409 });
    }

    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const nuevoItem = [{ id: item.id, price: plan.stripePriceId }];

    // ── Preview: cuánto se cobra HOY. No cambia nada. ────────────────────────
    if (!confirmar) {
      const prorationDate = Math.floor(Date.now() / 1000);
      const preview = await cliente.invoices.createPreview({
        customer,
        subscription: sub.id,
        subscription_details: {
          items: nuevoItem,
          proration_behavior: 'always_invoice',
          proration_date: prorationDate,
        },
      });
      return NextResponse.json({
        tier: plan.tier,
        label: plan.label,
        montoHoyCentavos: preview.amount_due,
        moneda: preview.currency.toUpperCase(),
        precioCentavos: plan.montoCentavos,
        intervalo: plan.intervalo,
        // En el ITEM, no en la suscripción (dahlia).
        renuevaEl: new Date(item.current_period_end * 1000).toISOString(),
        prorationDate,
      });
    }

    // ── Confirmar: cambia y cobra, todo o nada. ──────────────────────────────
    // El mismo `proration_date` del preview, para que se cobre EXACTAMENTE lo
    // que el doctor vio. Si el preview es viejo (o no viene), no se cobra otro
    // monto en silencio: se le pide recalcular (review de #3, hallazgo 3).
    const ahora = Math.floor(Date.now() / 1000);
    const prorationDate = body?.prorationDate;
    if (
      typeof prorationDate !== 'number' ||
      prorationDate > ahora ||
      ahora - prorationDate > MAX_EDAD_PRORRATEO_S ||
      prorationDate < item.current_period_start
    ) {
      return NextResponse.json(
        { error: 'El monto cambió desde que lo calculamos. Vuelve a calcularlo.', recalcular: true },
        { status: 409 },
      );
    }

    await cliente.subscriptions.update(
      sub.id,
      {
        items: nuevoItem,
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
        payment_behavior: 'error_if_incomplete',
        metadata: { ...sub.metadata, tier: plan.tier },
        // R8: pagar un plan mayor QUITA la cancelación agendada. En dahlia el
        // portal la expresa en `cancel_at` (con el flag en false); por API
        // puede venir en el flag. Se quita la que esté puesta.
        ...(sub.cancel_at_period_end
          ? { cancel_at_period_end: false }
          : sub.cancel_at
            ? { cancel_at: '' as const }
            : {}),
      },
      // Doble clic ⇒ un solo cambio y un solo cobro.
      { idempotencyKey: `cobro-subir-${sub.id}-${plan.tier}-${prorationDate}` },
    );

    return NextResponse.json({ ok: true, tier: plan.tier });
  } catch (e) {
    // 402 / error de tarjeta con `error_if_incomplete` ⇒ Stripe NO cambió nada.
    if (esErrorDeStripe(e) && (e.type === 'StripeCardError' || e.statusCode === 402)) {
      console.warn('[COBRO] cambiar-plan: cobro rechazado', ctx.slug, e.code);
      return NextResponse.json(
        {
          error:
            'Tu banco rechazó el cobro o pidió confirmarlo, así que no se hizo ningún cargo ni ' +
            'cambio. Revisa tu tarjeta en «Tarjeta, recibos y cancelación» e intenta de nuevo.',
        },
        { status: 402 },
      );
    }
    console.error('[COBRO] POST /api/billing/cambiar-plan', e);
    return NextResponse.json(
      { error: esErrorDeStripe(e) ? `Stripe: ${e.message}` : 'No se pudo cambiar el plan' },
      { status: 500 },
    );
  }
}
