import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@healthcare/database';
import { stripe } from '@/lib/stripe';
import { sendTelegramMessage } from '@/lib/telegram';
import { createPaymentLedgerEntry, textoAvisoRevisionPago } from '@/lib/practice-utils';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Account status changes ──
      case 'account.updated': {
        const account = event.data.object;
        const stripeAccountId = account.id;

        await prisma.doctor.updateMany({
          where: { stripeAccountId },
          data: {
            stripeChargesEnabled: account.charges_enabled ?? false,
            stripePayoutsEnabled: account.payouts_enabled ?? false,
            stripeOnboardingComplete: account.details_submitted ?? false,
          },
        });

        // Notify doctor if account got restricted or disabled
        const disabledReason = account.requirements?.disabled_reason;
        if (disabledReason) {
          const doctor = await prisma.doctor.findFirst({
            where: { stripeAccountId },
            select: { telegramChatId: true, doctorFullName: true },
          });
          if (doctor?.telegramChatId) {
            const reasonMessages: Record<string, string> = {
              'requirements.past_due': 'Stripe necesita informacion adicional que no fue proporcionada a tiempo. Tu cuenta esta deshabilitada.',
              'requirements.pending_verification': 'Stripe esta revisando tu documentacion. Tu cuenta esta temporalmente restringida.',
              'under_review': 'Stripe esta revisando tu cuenta. No se requiere accion de tu parte.',
              'rejected.fraud': 'Tu cuenta de Stripe fue rechazada permanentemente.',
              'rejected.terms_of_service': 'Tu cuenta de Stripe fue rechazada por violacion de terminos.',
              'rejected.incomplete_verification': 'Tu cuenta fue rechazada porque la verificacion no se pudo completar.',
            };
            const msg = reasonMessages[disabledReason] || `Tu cuenta de Stripe tiene un problema: ${disabledReason}`;
            await sendTelegramMessage(
              doctor.telegramChatId,
              `⚠️ <b>Alerta de Stripe</b>\n\n${msg}\n\nRevisa tu estado en la seccion de Pagos de tu panel.`
            );
          }
        }
        break;
      }

      // ── Doctor disconnected from platform ──
      case 'account.application.deauthorized': {
        const account = event.data.object;
        const stripeAccountId = account.id;

        // Clear Stripe fields since account is no longer connected
        await prisma.doctor.updateMany({
          where: { stripeAccountId },
          data: {
            stripeAccountId: null,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
            stripeOnboardingComplete: false,
          },
        });
        console.log(`[stripe-webhook] Account ${stripeAccountId} deauthorized — doctor disconnected`);
        break;
      }

      // ── Payment completed (card = immediate) ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        if (paymentLinkId && typeof paymentLinkId === 'string') {
          // For immediate payments (card), mark as PAID
          if (session.payment_status === 'paid') {
            await recordStripePayment(paymentLinkId, session, new Date(event.created * 1000), 'tarjeta');
          }
          // For async methods (OXXO), payment_status will be 'unpaid'
          // and we wait for checkout.session.async_payment_succeeded
        }
        break;
      }

      // ── Checkout session expired (customer abandoned after 24h) ──
      case 'checkout.session.expired': {
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        // Note: Payment Links can be reused (until completed_sessions limit).
        // A session expiring doesn't mean the link is dead — just that one
        // attempt timed out. We log it but don't change link status.
        if (paymentLinkId && typeof paymentLinkId === 'string') {
          console.log(`[stripe-webhook] Checkout session expired for payment link ${paymentLinkId}`);
        }
        break;
      }

      // ── Async payment succeeded (OXXO) ──
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        if (paymentLinkId && typeof paymentLinkId === 'string') {
          await recordStripePayment(paymentLinkId, session, new Date(event.created * 1000), 'efectivo');
        }
        break;
      }

      // ── Async payment failed (OXXO voucher expired) ──
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        if (paymentLinkId && typeof paymentLinkId === 'string') {
          await prisma.paymentLink.updateMany({
            where: {
              stripePaymentLinkId: paymentLinkId,
              status: 'PENDING',
            },
            data: {
              status: 'EXPIRED',
            },
          });
        }
        break;
      }

      // ── Dispute/chargeback opened ──
      case 'charge.dispute.created': {
        const dispute = event.data.object;
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
        const amount = dispute.amount / 100;
        const currency = dispute.currency?.toUpperCase() || 'MXN';
        const stripeAccountId = event.account;

        console.log(`[stripe-webhook] Dispute created: ${dispute.id} for charge ${chargeId} ($${amount} ${currency}) on account ${stripeAccountId}`);

        // Notify doctor via Telegram
        if (stripeAccountId) {
          const doctor = await prisma.doctor.findFirst({
            where: { stripeAccountId },
            select: { telegramChatId: true },
          });
          if (doctor?.telegramChatId) {
            await sendTelegramMessage(
              doctor.telegramChatId,
              `🚨 <b>Disputa de pago recibida</b>\n\n` +
              `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}\n` +
              `Razon: ${dispute.reason || 'No especificada'}\n\n` +
              `Ingresa a tu panel de Stripe para responder con evidencia. ` +
              `Tienes un plazo limitado para responder.`
            );
          }
        }
        break;
      }

      // ── Dispute resolved ──
      case 'charge.dispute.closed': {
        const dispute = event.data.object;
        const amount = dispute.amount / 100;
        const currency = dispute.currency?.toUpperCase() || 'MXN';
        const won = dispute.status === 'won';
        const stripeAccountId = event.account;

        console.log(`[stripe-webhook] Dispute ${dispute.id} closed: ${dispute.status}`);

        if (stripeAccountId) {
          const doctor = await prisma.doctor.findFirst({
            where: { stripeAccountId },
            select: { telegramChatId: true },
          });
          if (doctor?.telegramChatId) {
            const emoji = won ? '✅' : '❌';
            const result = won ? 'a tu favor' : 'en contra';
            await sendTelegramMessage(
              doctor.telegramChatId,
              `${emoji} <b>Disputa resuelta ${result}</b>\n\n` +
              `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}\n` +
              (won
                ? 'El monto ha sido devuelto a tu cuenta.'
                : 'El monto fue devuelto al paciente.')
            );
          }
        }
        break;
      }

      // ── Refund issued (from Express Dashboard or API) ──
      case 'charge.refunded': {
        const charge = event.data.object;
        const refundedAmount = (charge.amount_refunded || 0) / 100;
        const currency = charge.currency?.toUpperCase() || 'MXN';
        const stripeAccountId = event.account;

        console.log(`[stripe-webhook] Charge ${charge.id} refunded: $${refundedAmount} ${currency} on account ${stripeAccountId}`);
        break;
      }

      // ── Payout succeeded ──
      case 'payout.paid': {
        const payout = event.data.object;
        const amount = payout.amount / 100;
        const currency = payout.currency?.toUpperCase() || 'MXN';
        const stripeAccountId = event.account;

        console.log(`[stripe-webhook] Payout ${payout.id} paid: $${amount} ${currency} to account ${stripeAccountId}`);
        break;
      }

      // ── Payout failed — bank account disabled ──
      case 'payout.failed': {
        const payout = event.data.object;
        const amount = payout.amount / 100;
        const currency = payout.currency?.toUpperCase() || 'MXN';
        const stripeAccountId = event.account;

        console.log(`[stripe-webhook] Payout FAILED: ${payout.id} ($${amount} ${currency}) on account ${stripeAccountId} — ${payout.failure_code}: ${payout.failure_message}`);

        // Critical: Notify doctor that their bank account is disabled
        if (stripeAccountId) {
          const doctor = await prisma.doctor.findFirst({
            where: { stripeAccountId },
            select: { telegramChatId: true },
          });
          if (doctor?.telegramChatId) {
            await sendTelegramMessage(
              doctor.telegramChatId,
              `🏦 <b>Pago a tu banco fallido</b>\n\n` +
              `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}\n` +
              `Razon: ${payout.failure_message || payout.failure_code || 'Desconocida'}\n\n` +
              `Tu cuenta bancaria ha sido deshabilitada. Ingresa a tu panel de Stripe para actualizar tus datos bancarios.`
            );
          }
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Helper: record a paid checkout session of one of our payment links — income in Flujo, link
 * marked PAID, Telegram to the doctor.
 *
 * Idempotent on the CHECKOUT SESSION id (`ledger_entries.provider_payment_id`), not on the link's
 * status (H-010 / H-054, 2026-10-04): deactivating a link on Stripe doesn't stop a checkout already
 * in flight (an OXXO voucher issued before, a second device), and that money is real — it reaches
 * Flujo flagged «⚠️ Revisar…», never dropped. The income is written FIRST; if that throws, the
 * error propagates and the route answers 500, so Stripe retries the event.
 */
/** Deploy of the provider-payment-id dedupe (H-010). Links paid before it were recorded without one. */
const CORTE_IDEMPOTENCIA_POR_PAGO = new Date('2026-10-04T00:00:00Z');

async function recordStripePayment(
  stripePaymentLinkId: string,
  session: { id: string; amount_total: number | null },
  fechaPago: Date,
  formaDePago: string
) {
  const link = await prisma.paymentLink.findUnique({
    where: { stripePaymentLinkId },
    select: {
      id: true,
      status: true,
      doctorId: true,
      amount: true,
      currency: true,
      description: true,
      bookingId: true,
      paidAt: true,
      doctor: { select: { telegramChatId: true } },
    },
  });
  if (!link) return;
  // Paid under the code before 2026-10-04: its ledger row has no provider id, so the dedupe can't
  // see it — a re-delivered event (or a dashboard «Resend») would book it twice. The link takes
  // ONE checkout (`completed_sessions: { limit: 1 }`), so a PAID-before-the-cut link is that one.
  if (link.status === 'PAID' && link.paidAt && link.paidAt < CORTE_IDEMPOTENCIA_POR_PAGO) return;

  // What was actually charged; the link's configured amount only as a fallback.
  const amount = session.amount_total != null ? session.amount_total / 100 : Number(link.amount);
  const entry = await createPaymentLedgerEntry({
    doctorId: link.doctorId,
    amount,
    concept: link.description || 'Pago recibido via Stripe',
    bookingId: link.bookingId,
    formaDePago,
    paymentProvider: 'stripe',
    providerPaymentId: `stripe:${session.id}`,
    linkStatusPrevio: link.status,
    fechaPago,
  });

  // Also when `yaRegistrado`: a retry after this update failed must still bring the link to PAID.
  await prisma.paymentLink.update({
    where: { id: link.id },
    data: { status: 'PAID', isActive: false, ...(link.status === 'PAID' ? {} : { paidAt: fechaPago }) },
  });
  // A retry of a recorded payment notifies only if the first attempt died before marking the link
  // (so it never notified either); otherwise it was already told.
  if (entry.yaRegistrado && link.status === 'PAID') return;

  const chatId = link.doctor?.telegramChatId;
  if (chatId) {
    await sendTelegramMessage(
      chatId,
      `💰 <b>Pago recibido</b>\n\n` +
      `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${link.currency}\n` +
      (link.description ? `Concepto: ${link.description}` : '')
    ).catch(err => console.error('[stripe-webhook] Telegram error:', err));
    if (entry.motivoRevision) {
      await sendTelegramMessage(chatId, textoAvisoRevisionPago(entry.motivoRevision, amount, entry.internalId))
        .catch(err => console.error('[stripe-webhook] Telegram error:', err));
    }
  }
}
