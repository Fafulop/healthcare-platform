import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { stripeAccountId: true },
    });

    if (!fullDoctor?.stripeAccountId) {
      return NextResponse.json(
        { error: 'No tienes una cuenta de Stripe. Crea una primero.' },
        { status: 400 }
      );
    }

    // Generate a new onboarding/re-onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: fullDoctor.stripeAccountId,
      refresh_url: `${process.env.DOCTOR_APP_URL}/dashboard/pagos?refresh=true`,
      return_url: `${process.env.DOCTOR_APP_URL}/dashboard/pagos?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating Stripe account link:', error);
    return NextResponse.json(
      { error: 'Error al generar el enlace de Stripe' },
      { status: 500 }
    );
  }
}
