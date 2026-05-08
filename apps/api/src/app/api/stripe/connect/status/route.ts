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

    // Extract account problem details
    const disabledReason = account.requirements?.disabled_reason || null;
    const currentlyDue = account.requirements?.currently_due || [];
    const pastDue = account.requirements?.past_due || [];
    const errors = (account.requirements?.errors || []).map((e) => ({
      code: e.code,
      reason: e.reason,
      requirement: e.requirement,
    }));
    const currentDeadline = account.requirements?.current_deadline
      ? new Date(account.requirements.current_deadline * 1000).toISOString()
      : null;

    // Fetch recent payouts for the connected account
    let lastPayout = null;
    try {
      const payouts = await stripe.payouts.list(
        { limit: 1 },
        { stripeAccount: fullDoctor.stripeAccountId }
      );
      if (payouts.data.length > 0) {
        const p = payouts.data[0];
        lastPayout = {
          amount: p.amount / 100,
          currency: p.currency.toUpperCase(),
          status: p.status,
          arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
          failureCode: p.failure_code || null,
          failureMessage: p.failure_message || null,
        };
      }
    } catch {
      // Payout fetch is best-effort — don't fail the whole request
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete: detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      // Detailed status
      disabledReason,
      currentlyDue,
      pastDue,
      errors,
      currentDeadline,
      // Payout info
      lastPayout,
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
