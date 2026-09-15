/**
 * POST /api/billing/portal — abre el portal de clientes de Stripe (tarjeta,
 * recibos, cancelar). TIERS C3. Devuelve `{ url }`.
 *
 * 🔴 El cambio de PLAN tiene que estar APAGADO en la configuración del portal
 * (dashboard de Stripe → Billing → Customer portal). Si Stripe dejara cambiar
 * de plan desde ahí, afirmaría "este doctor es BÁSICO" mientras nuestro guard de
 * cupo lo rechaza: dos sistemas con techos distintos. Eso NO se puede imponer
 * desde este código; es configuración del dashboard y está en el runbook.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { stripeCobro, doctorPuedeUsarCobro, esErrorDeStripe } from '@/lib/stripe-cobro';
import { puertaDeCobro, cobroNoDisponible } from '@/lib/cobro-auth';
import { filaDeCobroVigente } from '@/lib/cobro-planes';

export async function POST(request: Request) {
  const puerta = await puertaDeCobro(request);
  if (!puerta.ok) return puerta.respuesta;
  const { ctx } = puerta;

  const cliente = stripeCobro();
  if (!cliente || !doctorPuedeUsarCobro(ctx.slug)) return cobroNoDisponible();

  const appUrl = process.env.DOCTOR_APP_URL;
  if (!appUrl) return NextResponse.json({ error: 'Cobro mal configurado' }, { status: 500 });

  // Vigente en el modo actual de Stripe (review de C3, #2): un Customer de otro
  // modo no abre portal. Un error de Stripe que no sea "no existe" es 502, no
  // "no tienes datos de pago".
  let fila;
  try {
    ({ fila } = await filaDeCobroVigente(prisma, cliente, ctx.doctorId));
  } catch (e) {
    console.error('[COBRO] portal: no se pudo verificar el cliente en Stripe', e);
    return NextResponse.json({ error: 'No se pudo contactar a Stripe. Intenta de nuevo.' }, { status: 502 });
  }
  if (!fila?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'Todavía no tienes datos de pago vigentes. Suscríbete desde esta pantalla.' },
      { status: 409 },
    );
  }

  try {
    const sesion = await cliente.billingPortal.sessions.create({
      customer: fila.stripeCustomerId,
      return_url: `${appUrl}/dashboard/cuenta`,
    });
    return NextResponse.json({ url: sesion.url });
  } catch (e) {
    console.error('[COBRO] POST /api/billing/portal', e);
    // El caso típico: el portal no se ha configurado en el dashboard de Stripe.
    return NextResponse.json(
      {
        error: esErrorDeStripe(e)
          ? `No se pudo abrir el portal de pagos (${e.message})`
          : 'No se pudo abrir el portal de pagos',
      },
      { status: 409 },
    );
  }
}
