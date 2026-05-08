import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@healthcare/database';
import { stripe } from '@/lib/stripe';
import { sendTelegramMessage } from '@/lib/telegram';

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
            const updated = await prisma.paymentLink.updateMany({
              where: {
                stripePaymentLinkId: paymentLinkId,
                status: 'PENDING',
              },
              data: {
                status: 'PAID',
                paidAt: new Date(),
              },
            });

            // Notify doctor of payment received
            if (updated.count > 0) {
              await notifyPaymentReceived(paymentLinkId);
            }
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
          const updated = await prisma.paymentLink.updateMany({
            where: {
              stripePaymentLinkId: paymentLinkId,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });

          if (updated.count > 0) {
            await notifyPaymentReceived(paymentLinkId);
          }
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
 * Helper: notify doctor via Telegram when a payment is received
 */
async function notifyPaymentReceived(stripePaymentLinkId: string) {
  try {
    const link = await prisma.paymentLink.findFirst({
      where: { stripePaymentLinkId },
      select: {
        amount: true,
        currency: true,
        description: true,
        doctor: {
          select: { telegramChatId: true },
        },
      },
    });

    if (link?.doctor?.telegramChatId) {
      const amount = Number(link.amount);
      await sendTelegramMessage(
        link.doctor.telegramChatId,
        `💰 <b>Pago recibido</b>\n\n` +
        `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${link.currency}\n` +
        (link.description ? `Concepto: ${link.description}` : '')
      );
    }
  } catch (err) {
    console.error('Error sending payment notification:', err);
  }
}
