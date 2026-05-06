import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

/**
 * DELETE /api/stripe/payment-links/[id]
 * Deactivate a payment link
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);
    const { id } = await params;

    // Find the payment link and verify ownership
    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      select: {
        id: true,
        doctorId: true,
        stripePaymentLinkId: true,
        isActive: true,
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Link de pago no encontrado' },
        { status: 404 }
      );
    }

    if (paymentLink.doctorId !== doctor.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para desactivar este link' },
        { status: 403 }
      );
    }

    if (!paymentLink.isActive) {
      return NextResponse.json(
        { error: 'Este link ya está desactivado' },
        { status: 400 }
      );
    }

    // Get doctor's Stripe account to deactivate on Stripe
    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { stripeAccountId: true },
    });

    if (fullDoctor?.stripeAccountId) {
      try {
        await stripe.paymentLinks.update(
          paymentLink.stripePaymentLinkId,
          { active: false },
          { stripeAccount: fullDoctor.stripeAccountId }
        );
      } catch (stripeErr) {
        console.error('Error deactivating on Stripe:', stripeErr);
        // Continue with local deactivation even if Stripe fails
      }
    }

    // Deactivate locally
    await prisma.paymentLink.update({
      where: { id },
      data: {
        isActive: false,
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deactivating payment link:', error);
    return NextResponse.json(
      { error: 'Error al desactivar el link de pago' },
      { status: 500 }
    );
  }
}
