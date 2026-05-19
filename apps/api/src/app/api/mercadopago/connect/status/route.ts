// GET /api/mercadopago/connect/status
// Returns the doctor's Mercado Pago connection status.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);

    const doctorData = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: {
        mpUserId: true,
        mpConnected: true,
        mpTokenExpiresAt: true,
      },
    });

    if (!doctorData) {
      return NextResponse.json({ error: 'Doctor no encontrado' }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = doctorData.mpTokenExpiresAt;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      connected: doctorData.mpConnected,
      mpUserId: doctorData.mpUserId,
      tokenExpiresAt: expiresAt?.toISOString() || null,
      tokenExpiresSoon: expiresAt ? (expiresAt.getTime() - now.getTime()) < thirtyDays : false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error fetching status:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado de Mercado Pago' },
      { status: 500 }
    );
  }
}
