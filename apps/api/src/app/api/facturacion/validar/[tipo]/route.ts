import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  validateRFC,
  validateCFDIStatus,
  isFacturamaConfigured,
} from '@/lib/facturama';

// GET/POST /api/facturacion/validar/:tipo - SAT validations via Facturama
// WARNING: Each validation call consumes 1 folio from our Facturama account.
// Supported tipos: rfc, cfdi-status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  try {
    await getAuthenticatedDoctor(request);
    const { tipo } = await params;

    if (!isFacturamaConfigured()) {
      return NextResponse.json(
        { error: 'Facturama no está configurado' },
        { status: 503 }
      );
    }

    switch (tipo) {
      case 'rfc': {
        const body = await request.json();
        const { rfc, name, zipCode, fiscalRegime } = body;

        if (!rfc?.trim() || !name?.trim() || !zipCode?.trim() || !fiscalRegime?.trim()) {
          return NextResponse.json(
            { error: 'RFC, nombre, código postal y régimen fiscal son requeridos' },
            { status: 400 }
          );
        }

        const result = await validateRFC({
          Rfc: rfc.trim().toUpperCase(),
          Name: name.trim().toUpperCase(),
          ZipCode: zipCode.trim(),
          FiscalRegime: fiscalRegime.trim(),
        });

        return NextResponse.json({ data: result });
      }

      case 'cfdi-status': {
        const body = await request.json();
        const { uuid, issuerRfc, receiverRfc, total } = body;

        if (!uuid?.trim() || !issuerRfc?.trim() || !receiverRfc?.trim() || !total) {
          return NextResponse.json(
            { error: 'UUID, RFC emisor, RFC receptor y total son requeridos' },
            { status: 400 }
          );
        }

        const result = await validateCFDIStatus(
          uuid.trim(),
          issuerRfc.trim().toUpperCase(),
          receiverRfc.trim().toUpperCase(),
          String(total)
        );

        return NextResponse.json({ data: result });
      }

      default:
        return NextResponse.json(
          { error: `Tipo de validación "${tipo}" no soportado. Usa: rfc, cfdi-status` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error en validación: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error in validation:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
