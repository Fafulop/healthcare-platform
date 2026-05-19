// DELETE /api/mercadopago/preferences/[id]
// Deactivates a payment preference (marks as CANCELLED).
// MP preferences can't be deactivated on MP's side — we just stop sharing the link.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctorStripe(request);
    const { id } = await params;

    // Find and verify ownership
    const preference = await prisma.mpPaymentPreference.findUnique({
      where: { id },
      select: { id: true, doctorId: true, status: true },
    });

    if (!preference) {
      return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
    }

    if (preference.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (preference.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar links pendientes' },
        { status: 400 }
      );
    }

    await prisma.mpPaymentPreference.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        isActive: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[MP] Error deactivating preference:', error);
    return NextResponse.json(
      { error: 'Error al desactivar link de pago' },
      { status: 500 }
    );
  }
}
