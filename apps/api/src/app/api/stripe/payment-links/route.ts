import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { stripe, isStripeError } from '@/lib/stripe';
import { checkBookingLinkSlot } from '@/lib/payment-link-guard';

/**
 * POST /api/stripe/payment-links
 * Create a new payment link for the authenticated doctor
 */
export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    // Verify doctor has a fully set up Stripe account
    const fullDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    });

    if (!fullDoctor?.stripeAccountId || !fullDoctor.stripeChargesEnabled) {
      return NextResponse.json(
        { error: 'Tu cuenta de Stripe no está completamente configurada' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, description, serviceId, bookingId } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount < 10) {
      return NextResponse.json(
        { error: 'El monto minimo es $10 MXN' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: 'El monto maximo es $100,000 MXN' },
        { status: 400 }
      );
    }

    // Validate serviceId belongs to this doctor
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, doctorId: doctor.id },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json(
          { error: 'Servicio no encontrado' },
          { status: 400 }
        );
      }
    }

    // Validate bookingId belongs to this doctor + no paid/active link on either provider
    let staleStripeLinkId: string | null = null;
    if (bookingId) {
      const slot = await checkBookingLinkSlot(doctor.id, bookingId);
      if (!slot.ok) {
        return NextResponse.json({ error: slot.error }, { status: 400 });
      }
      staleStripeLinkId = slot.staleStripeLinkId;
    }

    // Create product and price on the connected account
    const productName = description || 'Consulta Medica';

    const product = await stripe.products.create(
      { name: productName },
      { stripeAccount: fullDoctor.stripeAccountId }
    );

    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: Math.round(amount * 100), // Convert to centavos
        currency: 'mxn',
      },
      { stripeAccount: fullDoctor.stripeAccountId }
    );

    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        payment_method_types: amount <= 10000 ? ['card', 'oxxo'] : ['card'],
        restrictions: {
          completed_sessions: { limit: 1 },
        },
        metadata: {
          doctorId: doctor.id,
          serviceId: serviceId || '',
          bookingId: bookingId || '',
        },
      },
      { stripeAccount: fullDoctor.stripeAccountId }
    );

    // Save to database. Freeing the stale link's @unique bookingId slot happens HERE, in the
    // same transaction as the create — never before the Stripe calls, so a failed create can't
    // orphan the old booking↔link association.
    let dbPaymentLink;
    try {
      const create = prisma.paymentLink.create({
        data: {
          doctorId: doctor.id,
          stripePaymentLinkId: paymentLink.id,
          stripePaymentLinkUrl: paymentLink.url,
          description: productName,
          amount,
          currency: 'MXN',
          serviceId: serviceId || undefined,
          bookingId: bookingId || undefined,
        },
      });
      if (staleStripeLinkId) {
        [, dbPaymentLink] = await prisma.$transaction([
          prisma.paymentLink.update({
            where: { id: staleStripeLinkId },
            data: { bookingId: null },
          }),
          create,
        ]);
      } else {
        dbPaymentLink = await create;
      }
    } catch (dbError: any) {
      if (dbError?.code === 'P2002') {
        // Race loser: a concurrent request took the bookingId slot between guard and create.
        // Deactivate the Stripe link we just created so an unrecorded live link can't be paid.
        try {
          await stripe.paymentLinks.update(
            paymentLink.id,
            { active: false },
            { stripeAccount: fullDoctor.stripeAccountId }
          );
        } catch {
          console.error('[stripe] Could not deactivate orphaned payment link', paymentLink.id);
        }
        return NextResponse.json(
          { error: 'Ya existe un link de pago activo para esta cita' },
          { status: 400 }
        );
      }
      throw dbError;
    }

    return NextResponse.json({
      id: dbPaymentLink.id,
      url: paymentLink.url,
      description: productName,
      amount,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating payment link:', error);
    if (isStripeError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error al crear el link de pago' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/payment-links
 * List all payment links for the authenticated doctor
 */
export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    const paymentLinks = await prisma.paymentLink.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        stripePaymentLinkUrl: true,
        description: true,
        amount: true,
        currency: true,
        isActive: true,
        status: true,
        paidAt: true,
        createdAt: true,
        service: {
          select: { serviceName: true },
        },
        booking: {
          select: {
            id: true,
            patientName: true,
          },
        },
      },
    });

    // Convert Prisma Decimal to string for JSON serialization
    const normalized = paymentLinks.map((pl) => ({
      ...pl,
      amount: pl.amount.toString(),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing payment links:', error);
    return NextResponse.json(
      { error: 'Error al obtener los links de pago' },
      { status: 500 }
    );
  }
}
