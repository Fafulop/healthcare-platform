import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);

    // Check if doctor already has a Stripe account
    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { stripeAccountId: true },
    });

    if (fullDoctor?.stripeAccountId) {
      return NextResponse.json(
        { error: 'Ya tienes una cuenta de Stripe conectada' },
        { status: 400 }
      );
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'MX',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        oxxo_payments: { requested: true },
      },
      business_profile: {
        mcc: '8011', // Doctors
        name: doctor.doctorFullName,
      },
    });

    // Save Stripe account ID to doctor record
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { stripeAccountId: account.id },
    });

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.DOCTOR_APP_URL}/pagos?refresh=true`,
      return_url: `${process.env.DOCTOR_APP_URL}/pagos?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating Stripe Connect account:', error);
    return NextResponse.json(
      { error: 'Error al crear la cuenta de Stripe' },
      { status: 500 }
    );
  }
}
