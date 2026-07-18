import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { deriveReceiverFromPatient } from '@/lib/cfdi-drafts';

/**
 * GET /api/facturacion/receptores — patients as CFDI receivers for the
 * Nueva Factura dropdown. The receiver is derived SERVER-SIDE with the same
 * recipe the drafts use (deriveReceiverFromPatient — PG normalization
 * included), so the client never re-implements the mapping (it already
 * exists ×3; this endpoint prevents copy #4).
 *
 * Only patients with any fiscal intent (rfc or razonSocial captured) are
 * returned; `receiver` is null when data is incomplete (camposFaltantes says
 * what's missing — the UI shows them disabled with the hint).
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { codigoPostal: true },
    });

    const patients = await prisma.patient.findMany({
      where: {
        doctorId: doctor.id,
        OR: [{ rfc: { not: null } }, { razonSocial: { not: null } }],
      },
      select: {
        id: true, firstName: true, lastName: true, rfc: true, razonSocial: true,
        regimenFiscal: true, usoCfdi: true, codigoPostalFiscal: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 500,
    });

    const data = patients.map((p) => {
      const derivation = deriveReceiverFromPatient(p, profile?.codigoPostal ?? '');
      return {
        patientId: p.id,
        nombre: `${p.firstName} ${p.lastName}`.trim(),
        rfc: p.rfc,
        receiver: derivation.receiver,
        esPublicoGeneral: derivation.esPublicoGeneral,
        camposFaltantes: derivation.camposFaltantes,
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing receptores:', error);
    return NextResponse.json({ error: 'Error al listar receptores' }, { status: 500 });
  }
}
