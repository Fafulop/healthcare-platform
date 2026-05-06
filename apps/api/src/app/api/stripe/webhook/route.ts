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
