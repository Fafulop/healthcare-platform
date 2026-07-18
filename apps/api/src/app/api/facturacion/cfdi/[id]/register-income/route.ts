import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { generateLedgerInternalId, getDefaultArea } from '@/lib/practice-utils';
import { mapFormaPago } from '@/lib/sat-auto-register';

/**
 * POST /api/facturacion/cfdi/:id/register-income — money-model #5.
 *
 * A CFDI emitted WITHOUT a linked ledger entry (the "extras" factura under the
 * separation pattern: insumos/quirófano/resto de consulta invoiced apart from
 * the cita) leaves real income missing from the ledger. This creates the 1:1
 * matching income entry — amount = the CFDI's total, born hasFactura with the
 * CFDI's uuid stamped — and backfills cfdis_emitted.ledger_entry_id so cancel
 * (H8) and evidence resolve through the normal link.
 *
 * Declining the offer is safe: the uuid then exists nowhere in the ledger, so
 * a future SAT emitted sync auto-registers the income (correct — it truly was
 * missing).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const cfdiId = parseInt(id);
    if (isNaN(cfdiId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Perfil fiscal no encontrado' }, { status: 404 });
    }

    const cfdi = await prisma.cfdiEmitted.findFirst({
      where: { id: cfdiId, fiscalProfileId: profile.id },
    });
    if (!cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 });
    }
    if (cfdi.status !== 'active') {
      return NextResponse.json(
        { error: `El CFDI está ${cfdi.status} — solo se registra ingreso de facturas vigentes` },
        { status: 400 }
      );
    }
    if (cfdi.ledgerEntryId) {
      return NextResponse.json(
        { error: 'Esta factura ya tiene un ingreso ligado' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const porCobrar = body.porCobrar === true;
    const concept: string = (typeof body.concept === 'string' && body.concept.trim())
      ? body.concept.trim().substring(0, 500)
      : `Factura${cfdi.folio ? ` folio ${cfdi.folio}` : ''} — ${cfdi.nombreReceptor}`.substring(0, 500);

    // transactionDate: caller's YYYY-MM-DD, default = the CFDI's emission date
    let transactionDate = new Date(cfdi.issuedAt.toISOString().split('T')[0] + 'T00:00:00Z');
    if (typeof body.transactionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.transactionDate)) {
      transactionDate = new Date(body.transactionDate + 'T00:00:00Z');
    }

    // Optional patient link (page state knows it when the receptor dropdown or
    // ?patient= was used) — validated against tenancy, never trusted blindly.
    let patientId: string | null = null;
    if (typeof body.patientId === 'string' && body.patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: body.patientId, doctorId: doctor.id },
        select: { id: true },
      });
      if (!patient) {
        return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
      }
      patientId = patient.id;
    }

    const esPG = cfdi.rfcReceptor.toUpperCase() === 'XAXX010101000';
    const amount = Number(cfdi.total);

    const entry = await prisma.$transaction(async (tx) => {
      const internalId = await generateLedgerInternalId(doctor.id, 'ingreso', tx);
      const defaultArea = await getDefaultArea(doctor.id, 'INGRESO', tx);

      const created = await tx.ledgerEntry.create({
        data: {
          doctorId: doctor.id,
          amount,
          concept,
          entryType: 'ingreso',
          transactionDate,
          internalId,
          formaDePago: mapFormaPago(cfdi.formaPago),
          area: defaultArea.area,
          subarea: defaultArea.subarea,
          origin: 'manual',
          transactionType: 'N/A',
          paymentStatus: porCobrar ? 'PENDING' : 'PAID',
          amountPaid: porCobrar ? 0 : amount,
          porRealizar: false,
          // Born facturada: this income IS the stamped CFDI's money. The uuid
          // makes the SAT sync recognize it (no duplicate) and lets H8 reset
          // it if the CFDI is later cancelled.
          hasFactura: true,
          satCfdiUuid: cfdi.uuid.toUpperCase(),
          // PG has no real RFC — don't plant a fake matching signal
          counterpartyRfc: esPG ? null : cfdi.rfcReceptor.toUpperCase(),
          counterpartyName: esPG ? 'Público en General' : cfdi.nombreReceptor?.slice(0, 300),
          ...(patientId ? { patientId } : {}),
        },
      });

      await tx.cfdiEmitted.update({
        where: { id: cfdi.id },
        data: { ledgerEntryId: created.id },
      });

      return created;
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un ingreso con el UUID de esta factura' },
        { status: 409 }
      );
    }
    console.error('Error registering CFDI income:', error);
    return NextResponse.json({ error: 'Error al registrar el ingreso' }, { status: 500 });
  }
}
