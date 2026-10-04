import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { desactivarLinkStripe, STATUS_VIVOS } from '@/lib/desactivar-link';

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
        status: true,
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

    // Live = active AND not PAID/CANCELLED (EXPIRED = one OXXO voucher died; still payable).
    if (!paymentLink.isActive || !(STATUS_VIVOS as readonly string[]).includes(paymentLink.status)) {
      return NextResponse.json(
        { error: 'Este link ya está desactivado' },
        { status: 400 }
      );
    }

    // Deactivate on Stripe. If Stripe fails, nothing changes here (2026-10-04): before, the row was
    // marked CANCELLED anyway and the link kept taking money while the app said it was off.
    // (No Stripe account left = nothing to call: mark it.)
    const r = await desactivarLinkStripe(doctor.id, paymentLink.stripePaymentLinkId);
    if (r === 'error') {
      return NextResponse.json(
        { error: 'Stripe no respondió; el link sigue activo. Intenta de nuevo.' },
        { status: 502 }
      );
    }

    // Deactivate locally — conditional: a payment the webhook recorded meanwhile stays PAID.
    const { count } = await prisma.paymentLink.updateMany({
      where: { id, status: { in: [...STATUS_VIVOS] } },
      data: {
        isActive: false,
        status: 'CANCELLED',
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Este link ya no está pendiente (puede que el paciente lo acabe de pagar). Recarga la página.' },
        { status: 409 }
      );
    }
    // 'imposible': we can't switch it off from here (no account connected, or Stripe refuses for
    // good). The doctor asked to deactivate it, so it's marked here — but they must know the link
    // may still take payments in Stripe.
    return NextResponse.json({
      success: true,
      ...(r === 'imposible'
        ? { aviso: 'Se marcó como desactivado aquí, pero no pudimos desactivarlo en Stripe: desactívalo también desde tu cuenta de Stripe.' }
        : {}),
    });
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
