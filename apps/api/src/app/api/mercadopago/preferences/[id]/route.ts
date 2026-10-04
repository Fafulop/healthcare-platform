// DELETE /api/mercadopago/preferences/[id]
// Deactivates a payment preference: EXPIRES it on MP's side (a preference can't be deleted, but
// once `expiration_date_to` is past MP's checkout answers «ya no se encuentra disponible» —
// verified 2026-10-04) and marks it CANCELLED here. Before, only our row changed and the patient
// could still pay the link (H-010).

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctorStripe, AuthError } from '@/lib/auth';
import { expirarPreferenciaMp, STATUS_VIVOS } from '@/lib/desactivar-link';

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
      select: { id: true, doctorId: true, status: true, mpPreferenceId: true },
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

    // If MP fails, nothing changes here: the link may still take money, so it must keep showing
    // as active — and the doctor can retry. (No MP account left = nothing to call: mark it.)
    const r = await expirarPreferenciaMp(doctor.id, preference.mpPreferenceId);
    if (r === 'error') {
      return NextResponse.json(
        { error: 'Mercado Pago no respondió; el link sigue activo. Intenta de nuevo.' },
        { status: 502 }
      );
    }

    // Conditional: a payment the webhook recorded meanwhile stays PAID.
    const { count } = await prisma.mpPaymentPreference.updateMany({
      where: { id, status: { in: [...STATUS_VIVOS] } },
      data: {
        status: 'CANCELLED',
        isActive: false,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Este link ya no está pendiente (puede que el paciente lo acabe de pagar). Recarga la página.' },
        { status: 409 }
      );
    }
    // 'imposible': we can't switch it off from here (no account connected, or Mercado Pago refuses for
    // good). The doctor asked to deactivate it, so it's marked here — but they must know the link
    // may still take payments in Mercado Pago.
    return NextResponse.json({
      success: true,
      ...(r === 'imposible'
        ? { aviso: 'Se marcó como desactivado aquí, pero no pudimos desactivarlo en Mercado Pago: desactívalo también desde tu cuenta de Mercado Pago.' }
        : {}),
    });
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
