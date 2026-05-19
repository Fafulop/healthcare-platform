// POST /api/mercadopago/connect/authorize
// Generates OAuth authorization URL for doctor to connect their MP account.
// Returns the URL — doctor app redirects to it.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctorStripe(request);

    // Check if already connected
    const doctorData = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { mpConnected: true },
    });

    if (doctorData?.mpConnected) {
      return NextResponse.json(
        { error: 'Ya tienes una cuenta de Mercado Pago conectada' },
        { status: 400 }
      );
    }

    const clientId = process.env.MP_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Mercado Pago no esta configurado' },
        { status: 500 }
      );
    }

    // Generate cryptographic state for CSRF protection
    // Format: doctorId:randomHex — we'll validate doctorId on callback
    const randomHex = crypto.randomBytes(16).toString('hex');
    const state = `${doctor.id}:${randomHex}`;

    const redirectUri = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/mercadopago/connect/callback`;

    const authUrl = new URL('https://auth.mercadopago.com/authorization');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Error al generar enlace de autorizacion' },
      { status: 500 }
    );
  }
}
