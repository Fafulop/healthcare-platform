import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  createCFDI,
  type CreateCfdiPayload,
  type CfdiResponse,
} from '@/lib/facturama';

// POST /api/facturacion/cfdi/rep - Create a REP (Recibo Electrónico de Pago / Complemento de Pago 2.0)
// Used when the original invoice was PPD (pago diferido/parcialidades) and a payment is received.
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Primero debes configurar tu perfil fiscal' },
        { status: 400 }
      );
    }

    if (!profile.csdUploaded || profile.facturamaStatus !== 'active') {
      return NextResponse.json(
        { error: 'Tus certificados CSD no están activos. Verifica tu configuración.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { receiver, payment, folio, serie } = body;

    // Validate receiver
    if (!receiver?.rfc?.trim() || !receiver?.name?.trim() || !receiver?.fiscalRegime || !receiver?.taxZipCode) {
      return NextResponse.json(
        { error: 'Datos del receptor incompletos (RFC, nombre, régimen fiscal, CP)' },
        { status: 400 }
      );
    }

    // Validate payment data
    if (!payment) {
      return NextResponse.json(
        { error: 'Datos del pago requeridos' },
        { status: 400 }
      );
    }

    const { date, paymentForm, amount, currency, relatedDocuments } = payment;

    if (!date || !paymentForm?.trim() || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Fecha, forma de pago y monto del pago son requeridos' },
        { status: 400 }
      );
    }

    if (!relatedDocuments || !Array.isArray(relatedDocuments) || relatedDocuments.length === 0) {
      return NextResponse.json(
        { error: 'Al menos un documento relacionado (factura original) es requerido' },
        { status: 400 }
      );
    }

    // Validate each related document
    for (const doc of relatedDocuments) {
      if (!doc.uuid) {
        return NextResponse.json(
          { error: 'UUID de la factura original es requerido en cada documento relacionado' },
          { status: 400 }
        );
      }
      if (!doc.partialityNumber || doc.partialityNumber < 1) {
        return NextResponse.json(
          { error: 'Número de parcialidad debe ser >= 1' },
          { status: 400 }
        );
      }
      if (doc.previousBalanceAmount === undefined || doc.amountPaid === undefined) {
        return NextResponse.json(
          { error: 'Saldo anterior y monto pagado son requeridos por documento' },
          { status: 400 }
        );
      }
    }

    // Verify linked CFDIs exist in our DB and belong to this doctor
    for (const doc of relatedDocuments) {
      const linkedCfdi = await prisma.cfdiEmitted.findFirst({
        where: {
          uuid: doc.uuid,
          fiscalProfileId: profile.id,
          cfdiType: 'I',
          metodoPago: 'PPD',
        },
      });
      if (!linkedCfdi) {
        return NextResponse.json(
          { error: `Factura original no encontrada o no es PPD: ${doc.uuid}` },
          { status: 404 }
        );
      }
    }

    // Auto-generate folio
    let cfdifolio = folio;
    if (!cfdifolio) {
      const lastCfdi = await prisma.cfdiEmitted.findFirst({
        where: { fiscalProfileId: profile.id },
        orderBy: { id: 'desc' },
        select: { folio: true },
      });
      const lastFolioNum = lastCfdi?.folio ? parseInt(lastCfdi.folio) || 0 : 0;
      cfdifolio = String(lastFolioNum + 1);
    }

    // Build Facturama payload for REP (CfdiType "P")
    const payload: CreateCfdiPayload = {
      Issuer: {
        Rfc: profile.rfc.toUpperCase(),
        Name: profile.razonSocial.toUpperCase(),
        FiscalRegime: profile.regimenFiscal,
      },
      Receiver: {
        Rfc: receiver.rfc.trim().toUpperCase(),
        Name: receiver.name.trim().toUpperCase(),
        CfdiUse: 'CP01', // Always CP01 for payment receipts
        FiscalRegime: receiver.fiscalRegime,
        TaxZipCode: receiver.taxZipCode,
      },
      CfdiType: 'P',
      PaymentForm: '99',      // "Por definir" — actual payment form goes in Complement
      PaymentMethod: 'PPD',   // Always PPD for REP
      Exportation: '01',
      ExpeditionPlace: profile.codigoPostal,
      Folio: cfdifolio,
      Complement: {
        Payments: [{
          Date: date,
          PaymentForm: paymentForm,
          Amount: amount,
          Currency: currency || 'MXN',
          RelatedDocuments: relatedDocuments.map((doc: any) => ({
            Uuid: doc.uuid,
            Serie: doc.serie || undefined,
            Folio: doc.folio || undefined,
            Currency: doc.currency || 'MXN',
            PaymentMethod: 'PPD',
            PartialityNumber: doc.partialityNumber,
            PreviousBalanceAmount: doc.previousBalanceAmount,
            AmountPaid: doc.amountPaid,
            ImpSaldoInsoluto: doc.impSaldoInsoluto ?? (doc.previousBalanceAmount - doc.amountPaid),
            TaxObject: doc.taxObject || '01',
            Taxes: doc.taxes || undefined,
          })),
        }],
      },
    };

    if (serie) payload.Serie = serie;

    // Call Facturama API
    const cfdiResponse: CfdiResponse = await createCFDI(payload);

    // Save to our database
    const cfdiRecord = await prisma.cfdiEmitted.create({
      data: {
        fiscalProfileId: profile.id,
        facturamaId: cfdiResponse.Id,
        uuid: cfdiResponse.Complement.TaxStamp.Uuid,
        folio: cfdiResponse.Folio || null,
        serie: cfdiResponse.Serie || null,
        cfdiType: 'P',
        rfcEmisor: profile.rfc,
        rfcReceptor: receiver.rfc.trim().toUpperCase(),
        nombreReceptor: receiver.name.trim(),
        usoCfdi: 'CP01',
        subtotal: 0,
        total: amount,
        moneda: currency || 'MXN',
        formaPago: paymentForm,
        metodoPago: 'PPD',
        status: 'active',
        issuedAt: new Date(cfdiResponse.Date || cfdiResponse.Complement.TaxStamp.Date),
      },
    });

    return NextResponse.json({
      data: cfdiRecord,
      facturama: {
        id: cfdiResponse.Id,
        uuid: cfdiResponse.Complement.TaxStamp.Uuid,
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      console.error('Facturama REP creation error:', error.details);
      return NextResponse.json(
        { error: `Error al emitir REP: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error creating REP:', error);
    return NextResponse.json({ error: 'Error al emitir recibo de pago' }, { status: 500 });
  }
}
