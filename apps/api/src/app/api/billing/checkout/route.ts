/**
 * POST /api/billing/checkout — abre un Checkout de Stripe para suscribirse.
 * TIERS C3. Body: `{ tier }`. Devuelve `{ url }` para redirigir.
 *
 * 🔴 SEGURIDAD (§3.7, la lección del review de Q4): el cliente NO manda ni el
 * doctor ni el precio. El doctor sale de la SESIÓN; el precio, del mapa
 * `tier_prices` filtrado por `planesVendibles` —la MISMA función que decide qué
 * pinta la pantalla—. Lo único que viaja del navegador es a qué plan quiere ir.
 *
 * NO sube el plan. Lo sube el webhook cuando Stripe confirma el cobro.
 */

import { NextResponse } from 'next/server';
import { prisma, cabeEnPlan } from '@healthcare/database';
import { stripeCobro, doctorPuedeUsarCobro, esErrorDeStripe } from '@/lib/stripe-cobro';
import { puertaDeCobro, cobroNoDisponible } from '@/lib/cobro-auth';
import { planesVendibles, esSuscripcionViva, filaDeCobroVigente } from '@/lib/cobro-planes';

export async function POST(request: Request) {
  const puerta = await puertaDeCobro(request);
  if (!puerta.ok) return puerta.respuesta;
  const { ctx } = puerta;

  const cliente = stripeCobro();
  if (!cliente || !doctorPuedeUsarCobro(ctx.slug)) return cobroNoDisponible();

  const appUrl = process.env.DOCTOR_APP_URL;
  if (!appUrl) {
    console.error('[COBRO] falta DOCTOR_APP_URL: no hay a dónde regresar del checkout');
    return NextResponse.json({ error: 'Cobro mal configurado' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const tierPedido = typeof body?.tier === 'string' ? body.tier : '';

  try {
    // Vigente en el modo ACTUAL de Stripe (review de C3, #2). Una fila de otro
    // modo cuenta como inexistente y su Customer se reemplaza abajo.
    const { fila, customerObsoleto } = await filaDeCobroVigente(prisma, cliente, ctx.doctorId);

    // 🔴 `incomplete` = la suscripción se CREÓ pero nunca se cobró: el pago
    // pedía 3DS o la tarjeta se rechazó DESPUÉS de completar el Checkout.
    // Stripe la expira sola en ~23 h y, mientras tanto, contaba como
    // suscripción viva: el doctor se quedaba sin botón de «Suscribirme» y con
    // un 409 que le AFIRMABA que ya tenía una suscripción activa —falso, nadie
    // le cobró— y sin forma de reintentar (el portal de Stripe tampoco puede
    // pagar la primera factura de una `incomplete`). Se cancela ANTES de abrir
    // otra, así que nunca quedan dos (hallazgo #1 del review de C3).
    //
    // ⚠️ Se le pregunta a STRIPE en qué status está de verdad antes de
    // cancelar: si nos perdimos un webhook, nuestra fila puede decir
    // `incomplete` mientras allá ya está `active` — y entonces cancelar sería
    // darle de baja una suscripción PAGADA. Si Stripe dice que está viva, se
    // guarda ese status y el 409 de abajo hace lo correcto, con el mensaje que
    // sí es cierto.
    let statusVigente = fila?.status ?? null;
    if (fila && statusVigente === 'incomplete' && fila.stripeSubscriptionId) {
      const enStripe = await cliente.subscriptions
        .retrieve(fila.stripeSubscriptionId)
        .catch((e: unknown) => {
          // Ya no existe allá ⇒ el objetivo (que no bloquee) ya se cumplió.
          if (esErrorDeStripe(e) && e.code === 'resource_missing') return null;
          throw e;
        });

      if (enStripe && enStripe.status === 'incomplete') {
        await cliente.subscriptions.cancel(fila.stripeSubscriptionId);
        console.warn(
          '[COBRO] suscripción incomplete cancelada para permitir el reintento',
          ctx.slug,
          fila.stripeSubscriptionId,
        );
      }

      // `incomplete_expired` (expiró sola) y la que ya no existe caen aquí
      // también: en los tres casos deja de bloquear.
      statusVigente = enStripe && enStripe.status !== 'incomplete' ? enStripe.status : 'canceled';
      await prisma.subscription.update({
        where: { id: fila.id },
        data: { status: statusVigente },
      });
    }

    // Decisión del usuario: en C3 sólo se suscribe quien NO tiene suscripción.
    // Un segundo checkout crearía una segunda suscripción y cobraría doble.
    if (esSuscripcionViva(statusVigente)) {
      return NextResponse.json(
        {
          error:
            'Ya tienes una suscripción activa, así que no puedes abrir otra.',
        },
        { status: 409 },
      );
    }

    // Aquí ya se sabe que NO hay suscripción viva (el 409 de arriba), así que se
    // venden también los planes MENORES — la misma regla que usa la pantalla
    // (04 §12.6 #4). Y el que no cabe se rechaza aquí también (R4): la pantalla
    // no es la frontera.
    const planes = await planesVendibles(prisma, cliente, ctx.tier, { incluirMenores: true });
    const plan = planes.find((p) => p.tier === tierPedido);
    if (!plan) {
      return NextResponse.json({ error: 'Ese plan no está disponible para tu cuenta.' }, { status: 400 });
    }
    if (plan.baja) {
      const r = await cabeEnPlan(prisma, ctx.doctorId, plan.tier);
      if (!r.cabe) return NextResponse.json({ error: r.motivo }, { status: 409 });
    }

    // El Customer de Stripe se crea UNA vez por doctor y se guarda ANTES del
    // checkout: así el webhook siempre sabe de quién es un evento, aunque
    // `invoice.paid` llegue antes que `checkout.session.completed`.
    let customerId = fila?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await cliente.customers.create(
        { email: ctx.email, name: ctx.nombre, metadata: { doctorId: ctx.doctorId, slug: ctx.slug } },
        // Doble clic ⇒ el MISMO Customer, no dos. La llave incluye el Customer
        // obsoleto: si el viejo se borró, reusar la llave de antes podría
        // devolver (dentro de las 24 h de Stripe) justo el Customer que ya no sirve.
        { idempotencyKey: `cobro-customer-${ctx.doctorId}-${customerObsoleto ?? 'nuevo'}` },
      );
      customerId = customer.id;
      await prisma.subscription.upsert({
        where: { doctorId: ctx.doctorId },
        create: { doctorId: ctx.doctorId, stripeCustomerId: customerId, status: 'none' },
        // Si se reemplaza un Customer obsoleto, TODO lo que venía con él era de
        // otro modo: se limpia, para que un `active` de prueba no sobreviva.
        update: customerObsoleto
          ? {
              stripeCustomerId: customerId,
              stripeSubscriptionId: null,
              stripePriceId: null,
              status: 'none',
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              lastPaymentAt: null,
            }
          : { stripeCustomerId: customerId },
      });
    }

    const sesion = await cliente.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      // Sólo tarjeta: los métodos asíncronos (OXXO) no sirven para cobro recurrente.
      payment_method_types: ['card'],
      client_reference_id: ctx.doctorId,
      subscription_data: { metadata: { doctorId: ctx.doctorId, tier: plan.tier } },
      locale: 'es-419',
      success_url: `${appUrl}/dashboard/cuenta?pago=ok`,
      cancel_url: `${appUrl}/dashboard/cuenta?pago=cancelado`,
    });

    if (!sesion.url) {
      return NextResponse.json({ error: 'Stripe no devolvió la liga de pago' }, { status: 502 });
    }
    return NextResponse.json({ url: sesion.url });
  } catch (e) {
    console.error('[COBRO] POST /api/billing/checkout', e);
    return NextResponse.json(
      { error: esErrorDeStripe(e) ? `Stripe: ${e.message}` : 'No se pudo abrir el pago' },
      { status: 500 },
    );
  }
}
