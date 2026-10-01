import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { AuthError, getAuthenticatedDoctor } from '@/lib/auth';
import { createTratamientoPagoEntry } from '@/lib/practice-utils';

/**
 * POST /api/practice-management/ledger/tratamiento-pago — { tratamientoId, amount, formaDePago?, fecha? }
 *
 * TRATAMIENTOS T6 — «Registrar pago del paquete»: un ingreso de Flujo de Dinero ligado al
 * tratamiento (adelanto o abono, de cualquier monto, en cualquier momento). Cuelga de
 * `practice-management/ledger` ⇒ para un ayudante exige `flujo` (el mapa de rutas lo revisa en
 * `validateAuthToken`), igual que cualquier movimiento. Sólo tratamientos de este doctor CON precio
 * de paquete: sin paquete, el doctor cobra por sesión y no hay «pago del paquete».
 */
export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json().catch(() => null);
    const tratamientoId = body?.tratamientoId;
    const amount = body?.amount;
    if (typeof tratamientoId !== 'string' || !tratamientoId) {
      return NextResponse.json({ error: 'tratamientoId inválido' }, { status: 400 });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const tratamiento = await prisma.tratamiento.findFirst({
      where: { id: tratamientoId, doctorId: doctor.id },
      select: { id: true, nombre: true, patientId: true, precioPaquete: true },
    });
    if (!tratamiento) {
      return NextResponse.json({ error: 'Tratamiento no encontrado' }, { status: 404 });
    }
    if (tratamiento.precioPaquete === null) {
      return NextResponse.json(
        { error: 'El tratamiento no tiene precio de paquete: sus sesiones se cobran una por una al completarlas.' },
        { status: 409 },
      );
    }

    const entry = await createTratamientoPagoEntry({
      doctorId: doctor.id,
      tratamiento,
      amount: Math.round(amount * 100) / 100,
      formaDePago: typeof body?.formaDePago === 'string' ? body.formaDePago : 'efectivo',
      fecha: typeof body?.fecha === 'string' ? body.fecha : null,
    });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[tratamientos] pago del paquete falló:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 });
  }
}
