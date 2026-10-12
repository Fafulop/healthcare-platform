// GET /api/medical-records/patients/[id]/facturas-sin-cita
//
// 2026-10-12 (pedido del usuario) — «Otras facturas del paciente» en su página «Cobros»: las facturas
// emitidas a este paciente que NO son de una cita (una factura manual —insumos, un saldo aparte—, la de una
// venta o la de un tratamiento). Antes no se veían en «Cobros» (sólo en Facturación), y «Cobros» quiere ser su estado de cuenta.
// Se ligan por su INGRESO (`ledger_entries.patient_id`, sin cita) O por el RFC del paciente como receptor
// (una factura manual muchas veces NO tiene ingreso, o su ingreso no lleva paciente — code review: sólo por
// el ingreso la sección se quedaba vacía justo con las manuales). Siempre emitidas por ESTE doctor
// (`fiscalProfile.doctorId`); sin el RFC genérico (XAXX/XEXX: «público en general» no es este paciente).
// Sólo lectura. Permiso: Facturación,
// como las facturas de sus citas (sin él → `data: []` y `permitido: false`, no «no tiene»).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { bookingPermisos } from '@/lib/booking-permisos';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const permisos = bookingPermisos(ctx);
    if (!permisos.facturacion) {
      return NextResponse.json({ success: true, data: [], permitido: false });
    }
    const paciente = await prisma.patient.findFirst({ where: { id: patientId, doctorId: ctx.doctorId }, select: { id: true, rfc: true } });
    if (!paciente) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }
    const rfc = paciente.rfc?.trim().toUpperCase() ?? '';
    const rfcPropio = rfc.length >= 12 && !['XAXX010101000', 'XEXX010101000'].includes(rfc);
    const cfdis = await prisma.cfdiEmitted.findMany({
      where: {
        fiscalProfile: { doctorId: ctx.doctorId },
        // Sólo facturas de INGRESO: las notas de crédito (E) y los complementos de pago (P) van al RFC del
        // paciente sin ingreso y se leían como un cargo más (code review).
        cfdiType: 'I',
        OR: [
          { ledgerEntry: { doctorId: ctx.doctorId, patientId, bookingId: null } },
          // Por RFC: sin ingreso, o con un ingreso que NO es de una cita (las de cita ya salen en «Citas»).
          ...(rfcPropio
            // …y si su ingreso es de OTRO paciente (hermanos con el RFC del papá), no es de éste.
            ? [{ rfcReceptor: rfc, OR: [{ ledgerEntryId: null }, { ledgerEntry: { bookingId: null, OR: [{ patientId: null }, { patientId }] } }] }]
            : []),
        ],
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true, serie: true, folio: true, uuid: true, total: true, status: true, issuedAt: true,
        ledgerEntry: { select: { concept: true, origin: true, saleId: true, tratamientoId: true } },
      },
    });
    const data = cfdis.map((c) => ({
      id: c.id,
      folio: [c.serie, c.folio].filter(Boolean).join('-') || null,
      uuid: c.uuid,
      total: Number(c.total),
      status: c.status,
      issuedAt: c.issuedAt.toISOString(),
      concepto: c.ledgerEntry?.concept ?? null,
      deVenta: c.ledgerEntry?.saleId != null || c.ledgerEntry?.origin === 'venta',
      deTratamiento: c.ledgerEntry?.tratamientoId != null,
    }));
    return NextResponse.json({ success: true, data, permitido: true });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/facturas-sin-cita');
  }
}
