import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  let doctorId: string | null = null;

  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);
    doctorId = doctor.id;

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

    // Atomically claim the slot to prevent race conditions
    // Only updates if stripeAccountId is still null
    const claimed = await prisma.doctor.updateMany({
      where: { id: doctor.id, stripeAccountId: null },
      data: { stripeAccountId: '__pending__' },
    });

    if (claimed.count === 0) {
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
      refresh_url: `${process.env.DOCTOR_APP_URL}/dashboard/pagos?refresh=true`,
      return_url: `${process.env.DOCTOR_APP_URL}/dashboard/pagos?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    // Roll back the pending placeholder if Stripe creation failed
    if (doctorId) {
      await prisma.doctor.updateMany({
        where: { id: doctorId, stripeAccountId: '__pending__' },
        data: { stripeAccountId: null },
      }).catch(() => {});
    }

    console.error('Error creating Stripe Connect account:', error);
    return NextResponse.json(
      { error: 'Error al crear la cuenta de Stripe' },
      { status: 500 }
    );
  }
}
