// GET /api/mercadopago/connect/callback
// OAuth callback from Mercado Pago. Exchanges authorization code for tokens,
// encrypts and saves them to the doctor record, then redirects to pagos page.
// No JWT auth — this is an OAuth redirect from MP.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { encrypt, mpFetch } from '@/lib/mercadopago';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const doctorAppUrl = process.env.DOCTOR_APP_URL || '';

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=missing_params`);
  }

  // Parse state: "doctorId:randomHex"
  const [doctorId] = state.split(':');
  if (!doctorId) {
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=invalid_state`);
  }

  // Verify doctor exists
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, mpConnected: true },
  });

  if (!doctor) {
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=doctor_not_found`);
  }

  if (doctor.mpConnected) {
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=already_connected`);
  }

  // Exchange authorization code for tokens
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=not_configured`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/mercadopago/connect/callback`;

  try {
    const response = await mpFetch('/oauth/token', {
      method: 'POST',
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[MP] Token exchange failed:', response.status, errorData);
      return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=token_exchange_failed`);
    }

    const data = await response.json();
    // data: { access_token, token_type, expires_in, scope, user_id, refresh_token, public_key }

    if (!data.access_token || !data.refresh_token || !data.user_id) {
      console.error('[MP] Token response missing fields:', Object.keys(data));
      return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=incomplete_response`);
    }

    // Check if another doctor already connected this MP account
    const existingDoctor = await prisma.doctor.findUnique({
      where: { mpUserId: String(data.user_id) },
      select: { id: true },
    });

    if (existingDoctor && existingDoctor.id !== doctorId) {
      return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=account_already_linked`);
    }

    // Save encrypted tokens to doctor record
    await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        mpUserId: String(data.user_id),
        mpAccessToken: encrypt(data.access_token),
        mpRefreshToken: encrypt(data.refresh_token),
        mpPublicKey: data.public_key || null,
        mpTokenExpiresAt: new Date(Date.now() + (data.expires_in || 15552000) * 1000),
        mpConnected: true,
      },
    });

    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=connected`);
  } catch (error) {
    console.error('[MP] OAuth callback error:', error);
    return NextResponse.redirect(`${doctorAppUrl}/dashboard/pagos?mp=error&reason=server_error`);
  }
}
