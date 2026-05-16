import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/details/[uuid] — Get parsed XML details for one CFDI
 *
 * Returns the tax breakdown, payment info, and line items (conceptos)
 * parsed from the full XML download (Phase 2).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } },
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { uuid } = params;

    if (!uuid || uuid.length !== 36) {
      return NextResponse.json({ error: 'UUID invalido' }, { status: 400 });
    }

    const detail = await prisma.satCfdiDetail.findUnique({
      where: {
        doctorId_uuid: {
          doctorId: doctor.id,
          uuid: uuid.toLowerCase(),
        },
      },
      include: {
        conceptos: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!detail) {
      return NextResponse.json({ error: 'No se encontraron detalles XML para este CFDI' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        uuid: detail.uuid,
        subtotal: detail.subtotal?.toNumber() ?? null,
        descuento: detail.descuento?.toNumber() ?? null,
        total: detail.total?.toNumber() ?? null,
        ivaTrasladado: detail.ivaTrasladado?.toNumber() ?? null,
        isrRetenido: detail.isrRetenido?.toNumber() ?? null,
        ivaRetenido: detail.ivaRetenido?.toNumber() ?? null,
        ieps: detail.ieps?.toNumber() ?? null,
        metodoPago: detail.metodoPago,
        formaPago: detail.formaPago,
        usoCfdi: detail.usoCfdi,
        moneda: detail.moneda,
        tipoCambio: detail.tipoCambio?.toNumber() ?? null,
        serie: detail.serie,
        folio: detail.folio,
        lugarExpedicion: detail.lugarExpedicion,
        conceptos: detail.conceptos.map(c => ({
          claveProdServ: c.claveProdServ,
          descripcion: c.descripcion,
          cantidad: c.cantidad?.toNumber() ?? null,
          claveUnidad: c.claveUnidad,
          unidad: c.unidad,
          valorUnitario: c.valorUnitario?.toNumber() ?? null,
          importe: c.importe?.toNumber() ?? null,
          descuento: c.descuento?.toNumber() ?? null,
          ivaTrasladado: c.ivaTrasladado?.toNumber() ?? null,
          isrRetenido: c.isrRetenido?.toNumber() ?? null,
        })),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching CFDI details:', error);
    return NextResponse.json({ error: 'Error al obtener detalles del CFDI' }, { status: 500 });
  }
}
