/**
 * POST /api/stripe/subscription-webhook — Stripe nos avisa del COBRO de
 * suscripciones (lo que los doctores nos pagan a NOSOTROS).
 *
 * TIERS C3. La lógica vive en `@/lib/cobro-webhook` (ejecutable en pruebas);
 * esta ruta sólo verifica la firma y traduce el resultado a HTTP.
 *
 * 🔴 NO es `/api/stripe/webhook`. Ése es de Connect y de los pagos de PACIENTES,
 * con su propio secreto. Mezclar "dinero que el doctor recibe" con "dinero que
 * el doctor debe" en un mismo `switch` es exactamente el acoplamiento que el
 * plan prohíbe. Ruta propia, secreto propio (STRIPE_SUBSCRIPTION_WEBHOOK_SECRET).
 *
 * Pública a propósito (la llama Stripe, no una sesión): su frontera es la FIRMA.
 * Por eso está en UNMAPPED_PUBLIC_PREFIXES y no en el route map.
 *
 * Códigos:
 *   400 — firma ausente o inválida (no es Stripe, o es otro secreto).
 *   503 — el cobro no está configurado. Stripe reintenta, y está bien.
 *   500 — falló la infraestructura (BD, Stripe). Stripe reintenta; el cambio de
 *         plan es idempotente por evento, así que reintentar es seguro.
 *   200 — procesado o ignorado a propósito. Lo que no se arregla reintentando
 *         (cliente desconocido, precio fuera del mapa) ya se avisó y responde 200.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { stripeCobro } from '@/lib/stripe-cobro';
import { avisarAdmin } from '@/lib/cobro-avisos';
import { procesarEventoCobro } from '@/lib/cobro-webhook';

export async function POST(request: Request) {
  const secreto = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
  const cliente = stripeCobro();
  if (!secreto || !cliente) {
    console.error('[COBRO] webhook recibido pero el cobro no está configurado');
    return NextResponse.json({ error: 'Cobro no configurado' }, { status: 503 });
  }

  // El cuerpo CRUDO: la firma se calcula sobre los bytes exactos. Parsearlo
  // antes a JSON y re-serializarlo rompería la verificación.
  const cuerpo = await request.text();
  const firma = request.headers.get('stripe-signature');
  if (!firma) {
    return NextResponse.json({ error: 'Falta stripe-signature' }, { status: 400 });
  }

  let evento;
  try {
    evento = cliente.webhooks.constructEvent(cuerpo, firma, secreto);
  } catch (e) {
    console.error('[COBRO] firma de webhook inválida', e);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  try {
    const resultado = await procesarEventoCobro(evento, {
      db: prisma,
      obtenerSuscripcion: (id) => cliente.subscriptions.retrieve(id),
      avisar: avisarAdmin,
    });
    console.log('[COBRO] evento', evento.type, evento.id, '→', resultado.accion);
    return NextResponse.json({ received: true, accion: resultado.accion });
  } catch (e) {
    console.error('[COBRO] error procesando', evento.type, evento.id, e);
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
  }
}
