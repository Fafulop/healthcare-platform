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
import { prisma } from '@healthcare/database';
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

    // Decisión del usuario: en C3 sólo se suscribe quien NO tiene suscripción.
    // Un segundo checkout crearía una segunda suscripción y cobraría doble.
    if (esSuscripcionViva(fila?.status)) {
      return NextResponse.json(
        {
          error:
            'Ya tienes una suscripción activa. Para cambiar de plan escríbenos y lo hacemos por ti.',
        },
        { status: 409 },
      );
    }

    const planes = await planesVendibles(prisma, cliente, ctx.tier);
    const plan = planes.find((p) => p.tier === tierPedido);
    if (!plan) {
      return NextResponse.json({ error: 'Ese plan no está disponible para tu cuenta.' }, { status: 400 });
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
