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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50') || 50));

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
    const { receiver, items, cfdiType, paymentForm, paymentMethod, folio, serie, ledgerEntryId,
      observations, paymentBankName, paymentAccountNumber, orderNumber } = body;

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

    // Auto-generate folio if not provided (mandatory for Multiemisor per Facturama docs)
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

    // Fetch the issuer name from Facturama's CSD registry (must match exactly)
    let issuerName = profile.razonSocial.trim().toUpperCase();
    try {
      const { getCSDStatus } = await import('@/lib/facturama');
      const csdStatus = await getCSDStatus(profile.rfc);
      if (csdStatus.TaxName) {
        issuerName = csdStatus.TaxName.trim().toUpperCase();
      }
    } catch (e) {
      // Fall back to profile name if CSD status check fails
    }
    console.log('CFDI Issuer debug:', { rfc: profile.rfc, issuerName, regimenFiscal: profile.regimenFiscal });
    const payload: CreateCfdiPayload = {
      Issuer: {
        Rfc: profile.rfc.trim().toUpperCase(),
        Name: issuerName,
        FiscalRegime: profile.regimenFiscal,
      },
      Receiver: {
        Rfc: receiver.rfc.trim().toUpperCase(),
        Name: receiver.name.trim().toUpperCase(),
        CfdiUse: receiver.cfdiUse,
        FiscalRegime: receiver.fiscalRegime,
        TaxZipCode: receiver.taxZipCode,
      },
      CfdiType: cfdiType || 'I',
      PaymentForm: paymentForm || '01',
      PaymentMethod: paymentMethod || 'PUE',
      Exportation: '01', // No export (domestic)
      ExpeditionPlace: profile.codigoPostal,
      Folio: cfdifolio,
      Items: items.map((item: any) => {
        const hasTaxes = item.taxes && item.taxes.length > 0;
        const mapped: any = {
          ProductCode: item.productCode || '85121800',
          Description: item.description,
          Quantity: item.quantity || 1,
          UnitCode: item.unitCode || 'E48',
          UnitPrice: item.unitPrice,
          Subtotal: item.subtotal || item.unitPrice * (item.quantity || 1),
          TaxObject: hasTaxes ? '02' : '01',
          Total: item.total || item.subtotal || item.unitPrice * (item.quantity || 1),
        };
        if (hasTaxes) mapped.Taxes = item.taxes;
        return mapped;
      }),
    };

    if (serie) payload.Serie = serie;
    // Optional non-fiscal fields (appear in PDF only)
    if (observations) payload.Observations = observations;
    if (paymentBankName) payload.PaymentBankName = paymentBankName;
    if (paymentAccountNumber) payload.PaymentAccountNumber = paymentAccountNumber;
    if (orderNumber) payload.OrderNumber = orderNumber;

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

    // Log Facturama response for debugging column size issues
    console.log('CFDI Response debug:', {
      Id: cfdiResponse.Id,
      Uuid: cfdiResponse.Complement?.TaxStamp?.Uuid,
      CfdiType: cfdiResponse.CfdiType,
      Folio: cfdiResponse.Folio,
      Serie: cfdiResponse.Serie,
      PaymentForm: cfdiResponse.PaymentForm,
      PaymentMethod: cfdiResponse.PaymentMethod,
      Status: cfdiResponse.Status,
    });

    // Map Facturama's full CfdiType names to short codes for our DB
    const CFDI_TYPE_MAP: Record<string, string> = {
      'Ingreso': 'I', 'ingreso': 'I', 'I': 'I',
      'Egreso': 'E', 'egreso': 'E', 'E': 'E',
      'Pago': 'P', 'pago': 'P', 'P': 'P',
      'Traslado': 'T', 'traslado': 'T', 'T': 'T',
    };
    const mappedCfdiType = CFDI_TYPE_MAP[cfdiResponse.CfdiType] || cfdiType || 'I';

    // Save to our database
    const cfdiRecord = await prisma.cfdiEmitted.create({
      data: {
        fiscalProfileId: profile.id,
        ledgerEntryId: ledgerEntryId || null,
        facturamaId: cfdiResponse.Id,
        uuid: cfdiResponse.Complement.TaxStamp.Uuid,
        folio: cfdiResponse.Folio || null,
        serie: cfdiResponse.Serie || null,
        cfdiType: mappedCfdiType,
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
