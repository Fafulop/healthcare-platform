import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/stripe/connect/dashboard-link
 * Generate a single-use login link for the doctor's Express Dashboard
 */
export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { stripeAccountId: true },
    });

    if (!fullDoctor?.stripeAccountId) {
      return NextResponse.json(
        { error: 'No tienes una cuenta de Stripe conectada' },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      fullDoctor.stripeAccountId
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating dashboard link:', error);
    return NextResponse.json(
      { error: 'Error al generar el enlace del panel de Stripe' },
      { status: 500 }
    );
  }
}
