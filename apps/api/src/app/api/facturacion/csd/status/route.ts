import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { getCSDStatus } from '@/lib/facturama';

// GET /api/facturacion/csd/status - Check CSD status in Facturama
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ data: { configured: false } });
    }

    if (!profile.csdUploaded) {
      return NextResponse.json({
        data: {
          configured: true,
          csdUploaded: false,
          facturamaStatus: profile.facturamaStatus,
        }
      });
    }

    // Check live status from Facturama
    try {
      const status = await getCSDStatus(profile.rfc);

      // Update local status if expired
      const validTo = status.ValidTo ? new Date(status.ValidTo) : null;
      const isExpired = validTo && validTo < new Date();

      if (isExpired && profile.facturamaStatus !== 'expired') {
        await prisma.doctorFiscalProfile.update({
          where: { doctorId: doctor.id },
          data: { facturamaStatus: 'expired' },
        });
      }

      return NextResponse.json({
        data: {
          configured: true,
          csdUploaded: true,
          facturamaStatus: isExpired ? 'expired' : 'active',
          certificateNumber: status.CertificateNumber,
          validFrom: status.ValidFrom,
          validTo: status.ValidTo,
          rfc: status.Rfc,
          taxName: status.TaxName,
        }
      });
    } catch (facturamaError: any) {
      // If Facturama can't find the CSD, mark as error
      if (facturamaError.status === 404) {
        await prisma.doctorFiscalProfile.update({
          where: { doctorId: doctor.id },
          data: { facturamaStatus: 'error', csdUploaded: false },
        });

        return NextResponse.json({
          data: {
            configured: true,
            csdUploaded: false,
            facturamaStatus: 'error',
            message: 'CSD no encontrado en Facturama. Necesitas volver a cargarlo.',
          }
        });
      }
      throw facturamaError;
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al consultar Facturama: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error checking CSD status:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
