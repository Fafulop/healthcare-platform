import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor, AuthError } from '@/lib/auth';
import { calculatePaymentStatus } from '@/lib/practice-utils';

/**
 * GET /api/appointments/bookings/:id/nota — the data of a cita's «Nota de venta» (VENTAS PACIENTE
 * paso 4, docs/DESDE JUNIO/VENTAS PACIENTE/01-DISENO.md).
 *
 * Decision 2: the cita's nota is ONLY a document of the charge the cita already has (its ledger
 * entry — 1:1, `bookingId` unique). It is NOT a sale and counts no income. Generated on demand — no
 * stored file — so it always matches the charge. Shape = `NotaVentaDatos` (lib/nota-venta-pdf.ts in
 * apps/doctor), drawn by the same PDF code as a venta's nota.
 *
 * Permission: `flujo` (route-permissions: appointments/bookings/*\/nota) — it shows money. Ownership:
 * the booking must be this doctor's. Every «no nota» answer says WHY (404 + reason), never a blank or
 * a misleading sheet:
 *   · no charge;
 *   · a session COVERED by its package ($0): there is no sale to document — the app calls it
 *     «Cubierta», not «Pagada», on purpose; a $0 «Nota de venta … Pagada» would undo that.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;

    // One round-trip: the booking (ownership) and its 1:1 charge.
    const booking = await prisma.booking.findFirst({
      where: { id, doctorId: doctor.id },
      select: {
        id: true, status: true, serviceName: true, patientName: true,
        patient: { select: { firstName: true, lastName: true } },
        ledgerEntry: {
          select: {
            internalId: true, amount: true, amountPaid: true, paymentStatus: true, porRealizar: true,
            formaDePago: true, transactionDate: true, tratamientoId: true, doctorId: true,
          },
        },
      },
    });
    if (!booking) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

    const entry = booking.ledgerEntry && booking.ledgerEntry.doctorId === doctor.id ? booking.ledgerEntry : null;
    if (!entry) {
      return NextResponse.json({ error: 'Esta cita no tiene cobro registrado' }, { status: 404 });
    }
    const amount = Number(entry.amount);
    if (entry.tratamientoId && amount <= 0) {
      return NextResponse.json(
        { error: 'Sesión cubierta por el paquete de su tratamiento: no tiene cobro que documentar' },
        { status: 404 },
      );
    }

    // The package line comes from STRUCTURED data (tratamientoId → its name), not from the free-text
    // concept the doctor can edit in Flujo.
    let paquete = '';
    if (entry.tratamientoId) {
      const t = await prisma.tratamiento.findFirst({
        where: { id: entry.tratamientoId, doctorId: doctor.id },
        select: { nombre: true },
      });
      paquete = t ? ` (paquete + extra «${t.nombre}»)` : ' (paquete + extra)';
    }

    // Same verdict as the rest of the app: a stored status wins; with none, it is derived from what
    // was paid (never assumed «Pagada»). A planned («por realizar») entry is not paid.
    const pagado = entry.amountPaid != null ? Number(entry.amountPaid) : 0;
    const paymentStatus = entry.porRealizar
      ? 'PENDING'
      : entry.paymentStatus ?? calculatePaymentStatus(pagado, amount);

    const nombre = booking.patient
      ? `${booking.patient.firstName} ${booking.patient.lastName}`.trim()
      : booking.patientName;
    const total = amount.toFixed(2);

    return NextResponse.json({
      data: {
        saleNumber: entry.internalId,
        saleDate: entry.transactionDate.toISOString().slice(0, 10),
        // A charge on a cita that was later cancelled / not attended prints «VENTA CANCELADA».
        status: booking.status === 'CANCELLED' || booking.status === 'NO_SHOW' ? 'CANCELLED' : 'CONFIRMED',
        paymentStatus,
        subtotal: total,
        tax: '0',
        total,
        amountPaid: pagado.toFixed(2),
        notes: entry.formaDePago ? `Forma de pago: ${entry.formaDePago}` : null,
        termsAndConditions: null,
        etiquetaComprador: 'Paciente',
        client: { businessName: nombre, rfc: null, contactName: null },
        items: [{
          description: `${booking.serviceName || 'Consulta'}${paquete}`,
          sku: null,
          quantity: '1',
          unit: 'servicio',
          unitPrice: total,
          discountRate: '0',
          taxRate: '0',
          subtotal: total,
        }],
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error al generar la nota de la cita:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
