// POST /api/mercadopago/preferences — Create a payment preference (payment link)
// GET  /api/mercadopago/preferences — List doctor's preferences

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { decrypt, mpFetch } from '@/lib/mercadopago';

export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    // Get MP credentials
    const doctorData = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: {
        mpConnected: true,
        mpAccessToken: true,
        mpTokenExpiresAt: true,
        doctorFullName: true,
      },
    });

    if (!doctorData?.mpConnected || !doctorData.mpAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no esta conectado' },
        { status: 400 }
      );
    }

    // Check token expiry
    if (doctorData.mpTokenExpiresAt && doctorData.mpTokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Tu token de Mercado Pago ha expirado. Reconecta tu cuenta.' },
        { status: 400 }
      );
    }

    const { amount, description: rawDescription } = await request.json();
    const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10 || parsedAmount > 100000) {
      return NextResponse.json(
        { error: 'El monto debe ser entre $10 y $100,000 MXN' },
        { status: 400 }
      );
    }

    const accessToken = decrypt(doctorData.mpAccessToken);
    const externalReference = `mp-${doctor.id}-${Date.now()}`;
    const doctorAppUrl = process.env.DOCTOR_APP_URL || '';

    // Create preference on MP using seller's access token
    const response = await mpFetch('/checkout/preferences', {
      method: 'POST',
      accessToken,
      body: {
        items: [
          {
            id: externalReference,
            title: description || 'Consulta Medica',
            quantity: 1,
            unit_price: parsedAmount,
            currency_id: 'MXN',
          },
        ],
        back_urls: {
          success: `${doctorAppUrl}/dashboard/pagos?mp_payment=success`,
          failure: `${doctorAppUrl}/dashboard/pagos?mp_payment=failure`,
          pending: `${doctorAppUrl}/dashboard/pagos?mp_payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/mercadopago/webhook`,
        external_reference: externalReference,
        payment_methods: {
          installments: 12,
          default_installments: 1,
        },
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[MP] Preference creation failed:', response.status, errorData);
      return NextResponse.json(
        { error: 'Error al crear link de pago en Mercado Pago' },
        { status: 400 }
      );
    }

    const preference = await response.json();

    // Save to database
    const saved = await prisma.mpPaymentPreference.create({
      data: {
        doctorId: doctor.id,
        mpPreferenceId: preference.id,
        mpInitPoint: preference.init_point,
        description: description || null,
        amount: parsedAmount,
        externalReference,
      },
    });

    return NextResponse.json({
      id: saved.id,
      url: preference.init_point,
      description: saved.description,
      amount: parsedAmount,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error creating preference:', error);
    return NextResponse.json(
      { error: 'Error al crear link de pago' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    const preferences = await prisma.mpPaymentPreference.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { serviceName: true } },
        booking: { select: { id: true, patientName: true } },
      },
    });

    // Normalize Decimal → string for JSON serialization
    const normalized = preferences.map(p => ({
      ...p,
      amount: p.amount.toString(),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Error al obtener links de pago' },
      { status: 500 }
    );
  }
}
