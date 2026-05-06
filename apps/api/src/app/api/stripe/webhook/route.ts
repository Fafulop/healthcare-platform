import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@healthcare/database';
import { stripe } from '@/lib/stripe';

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
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        if (paymentLinkId && typeof paymentLinkId === 'string') {
          // For immediate payments (card), mark as PAID
          if (session.payment_status === 'paid') {
            await prisma.paymentLink.updateMany({
              where: {
                stripePaymentLinkId: paymentLinkId,
                status: 'PENDING',
              },
              data: {
                status: 'PAID',
                paidAt: new Date(),
              },
            });
          }
          // For async methods (OXXO), payment_status will be 'unpaid'
          // and we wait for checkout.session.async_payment_succeeded
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        // Handles OXXO and other async payment methods
        const session = event.data.object;
        const paymentLinkId = session.payment_link;

        if (paymentLinkId && typeof paymentLinkId === 'string') {
          await prisma.paymentLink.updateMany({
            where: {
              stripePaymentLinkId: paymentLinkId,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        // OXXO payment expired (not paid within 72h)
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
