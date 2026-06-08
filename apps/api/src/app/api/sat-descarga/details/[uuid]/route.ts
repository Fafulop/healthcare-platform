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
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { uuid } = await params;

    if (!uuid || uuid.length !== 36) {
      return NextResponse.json({ error: 'UUID invalido' }, { status: 400 });
    }

    const uuidLower = uuid.toLowerCase();

    const [detail, metadata] = await Promise.all([
      prisma.satCfdiDetail.findUnique({
        where: { doctorId_uuid: { doctorId: doctor.id, uuid: uuidLower } },
        include: { conceptos: { orderBy: { id: 'asc' } } },
      }),
      prisma.satCfdiMetadata.findUnique({
        where: { doctorId_uuid: { doctorId: doctor.id, uuid: uuidLower } },
      }),
    ]);

    if (!detail && !metadata) {
      return NextResponse.json({ error: 'No se encontraron detalles XML para este CFDI' }, { status: 404 });
    }

    // Use metadata.monto as total (always correct from SAT CSV) when available.
    // detail.total may be wrong for existing data (parser bug: matched SubTotal instead of Total).
    const metadataMonto = metadata?.monto?.toNumber() ?? null;
    const detailTotal = detail?.total?.toNumber() ?? null;
    const correctedTotal = metadataMonto ?? detailTotal;

    return NextResponse.json({
      data: {
        uuid: uuidLower,
        subtotal: detail?.subtotal?.toNumber() ?? null,
        descuento: detail?.descuento?.toNumber() ?? null,
        total: correctedTotal,
        ivaTrasladado: detail?.ivaTrasladado?.toNumber() ?? null,
        isrRetenido: detail?.isrRetenido?.toNumber() ?? null,
        ivaRetenido: detail?.ivaRetenido?.toNumber() ?? null,
        ieps: detail?.ieps?.toNumber() ?? null,
        metodoPago: detail?.metodoPago ?? null,
        formaPago: detail?.formaPago ?? null,
        usoCfdi: detail?.usoCfdi ?? null,
        moneda: detail?.moneda ?? null,
        tipoCambio: detail?.tipoCambio?.toNumber() ?? null,
        serie: detail?.serie ?? null,
        folio: detail?.folio ?? null,
        lugarExpedicion: detail?.lugarExpedicion ?? null,
        conceptos: detail?.conceptos.map(c => ({
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
        })) ?? [],
        // Metadata fields
        metadata: metadata ? {
          direction: metadata.direction,
          efecto: metadata.efecto,
          issuerRfc: metadata.issuerRfc,
          issuerName: metadata.issuerName,
          receiverRfc: metadata.receiverRfc,
          receiverName: metadata.receiverName,
          monto: metadata.monto?.toNumber() ?? null,
          satStatus: metadata.satStatus,
          issuedAt: metadata.issuedAt?.toISOString() ?? null,
          certifiedAt: metadata.certifiedAt?.toISOString() ?? null,
        } : null,
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
