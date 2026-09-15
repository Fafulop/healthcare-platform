/**
 * GET /api/billing/status — lo que la pantalla «Mi Cuenta» necesita para la
 * sección de pago: si hay cobro, en qué estado va la suscripción y qué planes
 * se le pueden ofrecer. TIERS C3.
 *
 * `disponible: false` (con 200) cuando el cobro no está configurado o la cuenta
 * no está en la lista de prueba: la pantalla simplemente no pinta la sección.
 * No es un error — es "esto todavía no existe para ti".
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { stripeCobro, modoCobro, doctorPuedeUsarCobro } from '@/lib/stripe-cobro';
import { puertaDeCobro } from '@/lib/cobro-auth';
import { planesVendibles, esSuscripcionViva, filaDeCobroVigente } from '@/lib/cobro-planes';

export async function GET(request: Request) {
  const puerta = await puertaDeCobro(request);
  if (!puerta.ok) return puerta.respuesta;
  const { ctx } = puerta;

  const cliente = stripeCobro();
  if (!cliente || !doctorPuedeUsarCobro(ctx.slug)) {
    return NextResponse.json({ disponible: false });
  }

  try {
    // `filaDeCobroVigente`, no un findUnique pelado: una fila de OTRO modo de
    // Stripe (p.ej. de prueba, ya en vivo) se trata como inexistente — si no, su
    // `active` bloquearía la suscripción real y ofrecería un portal que falla.
    const [{ fila }, planes] = await Promise.all([
      filaDeCobroVigente(prisma, cliente, ctx.doctorId),
      planesVendibles(prisma, cliente, ctx.tier),
    ]);
    const viva = esSuscripcionViva(fila?.status);

    return NextResponse.json({
      disponible: true,
      modo: modoCobro(),
      tier: ctx.tier,
      suscripcion: fila
        ? {
            status: fila.status,
            currentPeriodEnd: fila.currentPeriodEnd,
            cancelAtPeriodEnd: fila.cancelAtPeriodEnd,
            lastPaymentAt: fila.lastPaymentAt,
          }
        : null,
      // Con una suscripción viva no se ofrece otro checkout: cobraría doble.
      planes: viva ? [] : planes,
      puedeSuscribirse: !viva && planes.length > 0,
      // El portal necesita un Customer de Stripe, que existe desde el primer
      // intento de checkout.
      tienePortal: !!fila?.stripeCustomerId,
    });
  } catch (e) {
    console.error('[COBRO] GET /api/billing/status', e);
    return NextResponse.json({ error: 'No se pudo leer el estado del cobro' }, { status: 500 });
  }
}
