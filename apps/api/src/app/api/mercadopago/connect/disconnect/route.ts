// POST /api/mercadopago/connect/disconnect
// Clears all MP fields from the doctor record.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        mpUserId: null,
        mpAccessToken: null,
        mpRefreshToken: null,
        mpPublicKey: null,
        mpTokenExpiresAt: null,
        mpConnected: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Error al desconectar Mercado Pago' },
      { status: 500 }
    );
  }
}
