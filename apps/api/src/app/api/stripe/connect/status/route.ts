import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: {
        stripeAccountId: true,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });

    if (!fullDoctor?.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // Fetch latest status from Stripe
    const account = await stripe.accounts.retrieve(fullDoctor.stripeAccountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    // Update local DB if status changed
    if (
      fullDoctor.stripeChargesEnabled !== chargesEnabled ||
      fullDoctor.stripePayoutsEnabled !== payoutsEnabled ||
      fullDoctor.stripeOnboardingComplete !== detailsSubmitted
    ) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          stripeChargesEnabled: chargesEnabled,
          stripePayoutsEnabled: payoutsEnabled,
          stripeOnboardingComplete: detailsSubmitted,
        },
      });
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete: detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching Stripe status:', error);
    return NextResponse.json(
      { error: 'Error al obtener el estado de Stripe' },
      { status: 500 }
    );
  }
}
