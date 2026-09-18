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
import { prisma, DOCTOR_TIERS, cabeEnPlan } from '@healthcare/database';
import { stripeCobro, modoCobro, doctorPuedeUsarCobro } from '@/lib/stripe-cobro';
import { puertaDeCobro } from '@/lib/cobro-auth';
import { planesVendibles, bloqueaOtroCheckout, filaDeCobroVigente } from '@/lib/cobro-planes';

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
    const { fila } = await filaDeCobroVigente(prisma, cliente, ctx.doctorId);
    // `bloqueaOtroCheckout`, no `esSuscripcionViva`: una `incomplete` que nunca
    // se cobró NO puede dejar la pantalla sin plan que comprar (hallazgo #1).
    const viva = bloqueaOtroCheckout(fila?.status);
    // 04 §12.6 #4: sin suscripción viva también se ofrecen los planes MENORES
    // (un PRO que canceló puede volver en BÁSICO). Con suscripción viva, no:
    // bajar es otro flujo (#7), al final del periodo.
    const vendibles = await planesVendibles(prisma, cliente, ctx.tier, { incluirMenores: !viva });
    // R4: un plan menor sólo se puede elegir si lo que usa CABE. El que no cabe
    // se muestra deshabilitado con los números, en vez de esconderlo.
    const planes = await Promise.all(
      vendibles.map(async (p) => {
        if (!p.baja) return p;
        const r = await cabeEnPlan(prisma, ctx.doctorId, p.tier);
        return r.cabe ? p : { ...p, noCabe: r.motivo };
      }),
    );

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
      // TIERS 04 §12.6 #3: con suscripción ACTIVA, los planes POR ENCIMA del
      // actual se ofrecen como «Cambiar a…» (POST /api/billing/cambiar-plan),
      // que cobra el prorrateo a la tarjeta guardada. `past_due` no: primero
      // hay que ponerse al corriente.
      subir:
        fila?.status === 'active'
          ? planes.filter(
              (p) =>
                (DOCTOR_TIERS as readonly string[]).indexOf(p.tier) >
                (DOCTOR_TIERS as readonly string[]).indexOf(ctx.tier),
            )
          : [],
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
