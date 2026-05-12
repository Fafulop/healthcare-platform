import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  createCFDI,
  type CreateCfdiPayload,
  type CfdiResponse,
} from '@/lib/facturama';

// POST /api/facturacion/cfdi/egreso - Create a Nota de Crédito (CFDI Egreso)
// Used for refunds, discounts, or bonifications on an existing invoice.
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
    const { receiver, items, originalUuid, paymentForm, folio, serie } = body;

    // Validate receiver
    if (!receiver?.rfc || !receiver?.name || !receiver?.fiscalRegime || !receiver?.taxZipCode) {
      return NextResponse.json(
        { error: 'Datos del receptor incompletos (RFC, nombre, régimen fiscal, CP)' },
        { status: 400 }
      );
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Al menos un concepto es requerido' },
        { status: 400 }
      );
    }

    // Validate original UUID (the invoice being credited)
    if (!originalUuid || typeof originalUuid !== 'string' || originalUuid.trim().length === 0) {
      return NextResponse.json(
        { error: 'UUID de la factura original es requerido' },
        { status: 400 }
      );
    }

    // Verify the original CFDI exists and belongs to this doctor
    const originalCfdi = await prisma.cfdiEmitted.findFirst({
      where: {
        uuid: originalUuid.trim(),
        fiscalProfileId: profile.id,
        cfdiType: 'I',
        status: 'active',
      },
    });

    if (!originalCfdi) {
      return NextResponse.json(
        { error: 'Factura original no encontrada o no está activa' },
        { status: 404 }
      );
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

    // Build Facturama payload for Egreso (Credit Note)
    const payload: CreateCfdiPayload = {
      Issuer: {
        Rfc: profile.rfc.toUpperCase(),
        Name: profile.razonSocial.toUpperCase(),
        FiscalRegime: profile.regimenFiscal,
      },
      Receiver: {
        Rfc: receiver.rfc.trim().toUpperCase(),
        Name: receiver.name.trim().toUpperCase(),
        CfdiUse: 'G02', // Always G02 for credit notes (devoluciones, descuentos o bonificaciones)
        FiscalRegime: receiver.fiscalRegime,
        TaxZipCode: receiver.taxZipCode,
      },
      CfdiType: 'E',
      NameId: '2', // "Nota de Crédito" document name
      PaymentForm: paymentForm || originalCfdi.formaPago || '99', // Default to original's form, fallback to '99' (por definir)
      PaymentMethod: 'PUE', // Credit notes are always single payment
      Exportation: '01',
      ExpeditionPlace: profile.codigoPostal,
      Folio: cfdifolio,
      Relations: {
        Type: '01', // Nota de crédito de los documentos relacionados
        Cfdis: [{ Uuid: originalUuid.trim() }],
      },
      Items: items.map((item: any) => {
        const hasTaxes = item.taxes && item.taxes.length > 0;
        return {
          ProductCode: item.productCode || '85121800',
          Description: item.description,
          Quantity: item.quantity || 1,
          UnitCode: item.unitCode || 'E48',
          UnitPrice: item.unitPrice,
          Subtotal: item.subtotal || item.unitPrice * (item.quantity || 1),
          TaxObject: hasTaxes ? '02' : '01',
          Taxes: item.taxes || [],
          Total: item.total || item.subtotal || item.unitPrice * (item.quantity || 1),
        };
      }),
    };

    if (serie) payload.Serie = serie;

    // Call Facturama API
    const cfdiResponse: CfdiResponse = await createCFDI(payload);

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.subtotal || item.unitPrice * (item.quantity || 1)), 0);
    const total = parseFloat(String(cfdiResponse.Total));

    let iva = 0;
    let retencionIsr = 0;
    for (const item of items) {
      if (item.taxes) {
        for (const tax of item.taxes) {
          if (tax.Name === 'IVA' && !tax.IsRetention) iva += tax.Total;
          if (tax.Name === 'ISR' && tax.IsRetention) retencionIsr += tax.Total;
        }
      }
    }

    // Save to our database
    const cfdiRecord = await prisma.cfdiEmitted.create({
      data: {
        fiscalProfileId: profile.id,
        facturamaId: cfdiResponse.Id,
        uuid: cfdiResponse.Complement.TaxStamp.Uuid,
        folio: cfdiResponse.Folio || null,
        serie: cfdiResponse.Serie || null,
        cfdiType: 'E',
        rfcEmisor: profile.rfc,
        rfcReceptor: receiver.rfc.trim().toUpperCase(),
        nombreReceptor: receiver.name.trim(),
        usoCfdi: 'G02',
        subtotal,
        iva: iva || null,
        retencionIsr: retencionIsr || null,
        total,
        moneda: 'MXN',
        formaPago: paymentForm || originalCfdi.formaPago || '99',
        metodoPago: 'PUE',
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
      console.error('Facturama Egreso creation error:', error.details);
      return NextResponse.json(
        { error: `Error al emitir nota de crédito: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error creating Egreso:', error);
    return NextResponse.json({ error: 'Error al emitir nota de crédito' }, { status: 500 });
  }
}
