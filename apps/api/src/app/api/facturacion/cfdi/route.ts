import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  createCFDI,
  type CreateCfdiPayload,
  type CfdiResponse,
} from '@/lib/facturama';

// GET /api/facturacion/cfdi - List all emitted CFDIs for the doctor
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ data: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { fiscalProfileId: profile.id };
    if (status) where.status = status;

    const [cfdis, total] = await Promise.all([
      prisma.cfdiEmitted.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cfdiEmitted.count({ where }),
    ]);

    return NextResponse.json({
      data: cfdis,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing CFDIs:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/facturacion/cfdi - Create (emit) a new CFDI
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
    const { receiver, items, cfdiType, paymentForm, paymentMethod, folio, serie, ledgerEntryId } = body;

    // Validate required fields
    if (!receiver || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Receptor y al menos un concepto son requeridos' },
        { status: 400 }
      );
    }

    if (!receiver.rfc || !receiver.name || !receiver.cfdiUse || !receiver.fiscalRegime || !receiver.taxZipCode) {
      return NextResponse.json(
        { error: 'Datos del receptor incompletos (RFC, nombre, uso CFDI, régimen fiscal, CP)' },
        { status: 400 }
      );
    }

    // If linking to a ledger entry, verify it belongs to this doctor
    if (ledgerEntryId) {
      const entry = await prisma.ledgerEntry.findFirst({
        where: { id: ledgerEntryId, doctorId: doctor.id },
      });
      if (!entry) {
        return NextResponse.json(
          { error: 'Entrada de ledger no encontrada' },
          { status: 404 }
        );
      }
    }

    // Build Facturama payload
    const payload: CreateCfdiPayload = {
      Issuer: {
        Rfc: profile.rfc,
        Name: profile.razonSocial,
        FiscalRegime: profile.regimenFiscal,
      },
      Receiver: {
        Rfc: receiver.rfc.trim().toUpperCase(),
        Name: receiver.name.trim(),
        CfdiUse: receiver.cfdiUse,
        FiscalRegime: receiver.fiscalRegime,
        TaxZipCode: receiver.taxZipCode,
      },
      CfdiType: cfdiType || 'I',
      PaymentForm: paymentForm || '01',
      PaymentMethod: paymentMethod || 'PUE',
      Exportation: '01', // No export (domestic)
      ExpeditionPlace: profile.codigoPostal,
      Items: items.map((item: any) => {
        const hasTaxes = item.taxes && item.taxes.length > 0;
        return {
          ProductCode: item.productCode || '85121800',
          Description: item.description,
          Quantity: item.quantity || 1,
          UnitCode: item.unitCode || 'E48',
          UnitPrice: item.unitPrice,
          Subtotal: item.subtotal || item.unitPrice * (item.quantity || 1),
          TaxObject: hasTaxes ? '02' : '01', // 02 = with taxes, 01 = no taxes
          Taxes: item.taxes || [],
          Total: item.total || item.subtotal || item.unitPrice * (item.quantity || 1),
        };
      }),
    };

    if (folio) payload.Folio = folio;
    if (serie) payload.Serie = serie;

    // Call Facturama API
    const cfdiResponse: CfdiResponse = await createCFDI(payload);

    // Calculate totals from items for our DB record
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.subtotal || item.unitPrice * (item.quantity || 1)), 0);
    const total = parseFloat(String(cfdiResponse.Total));

    // Compute IVA and ISR retention from taxes
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
        ledgerEntryId: ledgerEntryId || null,
        facturamaId: cfdiResponse.Id,
        uuid: cfdiResponse.Complement.TaxStamp.Uuid,
        folio: cfdiResponse.Folio || null,
        serie: cfdiResponse.Serie || null,
        cfdiType: cfdiResponse.CfdiType || cfdiType || 'I',
        rfcEmisor: profile.rfc,
        rfcReceptor: receiver.rfc.trim().toUpperCase(),
        nombreReceptor: receiver.name.trim(),
        usoCfdi: receiver.cfdiUse,
        subtotal,
        iva: iva || null,
        retencionIsr: retencionIsr || null,
        total,
        moneda: 'MXN',
        formaPago: paymentForm || '01',
        metodoPago: paymentMethod || 'PUE',
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
      console.error('Facturama CFDI creation error:', error.details);
      return NextResponse.json(
        { error: `Error al emitir CFDI: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error creating CFDI:', error);
    return NextResponse.json({ error: 'Error al emitir factura' }, { status: 500 });
  }
}
