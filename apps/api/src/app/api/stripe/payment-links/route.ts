import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/stripe/payment-links
 * Create a new payment link for the authenticated doctor
 */
export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

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
        { error: 'Tu cuenta de Stripe no esta completamente configurada' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, description, serviceId, bookingId } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser un numero positivo' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: 'El monto maximo es $100,000 MXN' },
        { status: 400 }
      );
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
        metadata: {
          doctorId: doctor.id,
          serviceId: serviceId || '',
          bookingId: bookingId || '',
        },
      },
      { stripeAccount: fullDoctor.stripeAccountId }
    );

    // Save to database
    const dbPaymentLink = await prisma.paymentLink.create({
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
    const { doctor } = await getAuthenticatedDoctor(request);

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
          select: { name: true },
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
