/**
 * TIERS — «volvió a pagar»: manda un `invoice.paid` FIRMADO al webhook real.
 *
 * Es la única pata del ciclo que no se puede provocar desde la BD: descongelar
 * y restaurar el plan los hace el webhook, y hasta hoy nadie lo había visto
 * hacerlo (lo probado en prod fueron pagos que SUBÍAN el plan, ninguno sobre
 * una cuenta congelada).
 *
 * El evento es sintético pero la puerta es la de verdad: se firma con
 * `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` y entra por
 * `POST /api/stripe/subscription-webhook`, que verifica la firma antes de nada.
 * Y lleva una SUSCRIPCIÓN REAL de Stripe, porque el handler la va a consultar
 * (`obtenerSuscripcion`) para leer su precio: con un id inventado no pasaría de
 * ahí.
 *
 * Uso:
 *   WEBHOOK_SECRET=… API_URL=… SUB_ID=sub_… node pago.cjs
 */

const crypto = require('crypto');

const API = process.env.API_URL;
const SECRETO = process.env.WEBHOOK_SECRET;
const SUB_ID = process.env.SUB_ID;

async function main() {
  if (!API || !SECRETO || !SUB_ID) {
    console.log('🔴 Faltan API_URL, WEBHOOK_SECRET o SUB_ID.');
    process.exitCode = 1;
    return;
  }

  const ahora = Math.floor(Date.now() / 1000);
  const unMes = ahora + 30 * 24 * 60 * 60;

  const evento = {
    id: `evt_prueba_${ahora}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: ahora,
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_prueba_${ahora}`,
        object: 'invoice',
        status: 'paid',
        status_transitions: { paid_at: ahora },
        // La forma que lee `suscripcionDeFactura()`: la suscripción vive en
        // `parent.subscription_details`, no en un campo `subscription` suelto.
        parent: { subscription_details: { subscription: SUB_ID } },
        // De aquí sale `pagado_hasta`: el fin MÁS TARDÍO de los renglones.
        lines: { data: [{ period: { start: ahora, end: unMes } }] },
      },
    },
  };

  const cuerpo = JSON.stringify(evento);
  const firmado = `${ahora}.${cuerpo}`;
  const v1 = crypto.createHmac('sha256', SECRETO).update(firmado).digest('hex');

  const res = await fetch(`${API}/api/stripe/subscription-webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${ahora},v1=${v1}`,
    },
    body: cuerpo,
  });
  const texto = await res.text();
  console.log(`webhook respondió ${res.status}: ${texto.slice(0, 300)}`);
  // 400 = firma rechazada (secreto equivocado). 200 = lo procesó o lo ignoró.
  if (res.status !== 200) process.exitCode = 1;
}

main().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1; });
