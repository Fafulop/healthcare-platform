// POST /api/mercadopago/preferences — Create a payment preference (payment link)
// GET  /api/mercadopago/preferences — List doctor's preferences
// v0.1.2 — payer.email, items.description, statement_descriptor, no back_urls

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { decrypt, mpFetch } from '@/lib/mercadopago';
import { checkBookingLinkSlot } from '@/lib/payment-link-guard';

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

    const { amount, description: rawDescription, patientEmail: rawEmail, bookingId: rawBookingId } = await request.json();
    const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
    const patientEmail = typeof rawEmail === 'string' ? rawEmail.trim() : '';
    const bookingId = typeof rawBookingId === 'string' && rawBookingId ? rawBookingId : null;

    // Validate email format if provided
    if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      return NextResponse.json(
        { error: 'Formato de email invalido' },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10 || parsedAmount > 100000) {
      return NextResponse.json(
        { error: 'El monto debe ser entre $10 y $100,000 MXN' },
        { status: 400 }
      );
    }

    // Validate bookingId belongs to this doctor + no paid/active link on either provider
    let staleMpPreferenceId: string | null = null;
    if (bookingId) {
      const slot = await checkBookingLinkSlot(doctor.id, bookingId);
      if (!slot.ok) {
        return NextResponse.json({ error: slot.error }, { status: 400 });
      }
      staleMpPreferenceId = slot.staleMpPreferenceId;
    }

    const accessToken = decrypt(doctorData.mpAccessToken);
    const externalReference = `mp-${doctor.id}-${Date.now()}`;

    // Create preference on MP using seller's access token
    // NOTE: No back_urls — MP shows its own default completion screen.
    // back_urls must NEVER point to the doctor app (patients would land on the doctor dashboard).
    const response = await mpFetch('/checkout/preferences', {
      method: 'POST',
      accessToken,
      body: {
        items: [
          {
            id: externalReference,
            title: description || 'Consulta Medica',
            description: description || 'Consulta Medica',
            quantity: 1,
            unit_price: parsedAmount,
            currency_id: 'MXN',
          },
        ],
        ...(patientEmail && {
          payer: { email: patientEmail },
        }),
        statement_descriptor: (doctorData.doctorFullName || 'Consulta Medica').slice(0, 22),
        notification_url: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/mercadopago/webhook`,
        external_reference: externalReference,
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

    // Save to database. Freeing the stale link's @unique bookingId slot happens HERE, in the
    // same transaction as the create — never before the MP call, so a failed create can't
    // orphan the old booking↔link association.
    let saved;
    try {
      const create = prisma.mpPaymentPreference.create({
        data: {
          doctorId: doctor.id,
          mpPreferenceId: preference.id,
          mpInitPoint: preference.init_point,
          description: description || null,
          amount: parsedAmount,
          externalReference,
          bookingId: bookingId || undefined,
        },
      });
      if (staleMpPreferenceId) {
        [, saved] = await prisma.$transaction([
          prisma.mpPaymentPreference.update({
            where: { id: staleMpPreferenceId },
            data: { bookingId: null },
          }),
          create,
        ]);
      } else {
        saved = await create;
      }
    } catch (dbError: any) {
      if (dbError?.code === 'P2002') {
        // Race loser: a concurrent request took the bookingId slot between guard and create.
        return NextResponse.json(
          { error: 'Ya existe un link de pago activo para esta cita' },
          { status: 400 }
        );
      }
      throw dbError;
    }

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
