import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { uploadCSD, updateCSD, deleteCSD, type CSDUploadPayload } from '@/lib/facturama';

// POST /api/facturacion/csd - Upload CSD certificates to Facturama
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    // Verify fiscal profile exists
    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Primero debes configurar tu perfil fiscal' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { certificate, privateKey, privateKeyPassword } = body;

    if (!certificate || !privateKey || !privateKeyPassword) {
      return NextResponse.json(
        { error: 'Certificado (.cer), llave privada (.key) y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Upload to Facturama
    const payload: CSDUploadPayload = {
      Rfc: profile.rfc,
      Certificate: certificate,       // Base64 encoded .cer
      PrivateKey: privateKey,          // Base64 encoded .key
      PrivateKeyPassword: privateKeyPassword,
      TaxName: profile.razonSocial,
      FiscalRegime: profile.regimenFiscal,
    };

    const result = await uploadCSD(payload);

    // Update profile status
    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: {
        csdUploaded: true,
        csdUploadedAt: new Date(),
        csdValidUntil: result.ValidTo ? new Date(result.ValidTo) : null,
        facturamaStatus: 'active',
      },
    });

    return NextResponse.json({
      data: {
        status: 'active',
        certificateNumber: result.CertificateNumber,
        validFrom: result.ValidFrom,
        validTo: result.ValidTo,
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      console.error('Facturama CSD upload error:', error.details);
      return NextResponse.json(
        { error: `Error al cargar CSD: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error uploading CSD:', error);
    return NextResponse.json({ error: 'Error al cargar certificados' }, { status: 500 });
  }
}

// PUT /api/facturacion/csd - Update CSD certificates (e.g., on expiration)
export async function PUT(request: NextRequest) {
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

    if (!profile.csdUploaded) {
      return NextResponse.json(
        { error: 'No hay CSD registrado para actualizar. Usa POST para cargar uno nuevo.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { certificate, privateKey, privateKeyPassword } = body;

    if (!certificate || !privateKey || !privateKeyPassword) {
      return NextResponse.json(
        { error: 'Certificado (.cer), llave privada (.key) y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const payload: CSDUploadPayload = {
      Rfc: profile.rfc,
      Certificate: certificate,
      PrivateKey: privateKey,
      PrivateKeyPassword: privateKeyPassword,
      TaxName: profile.razonSocial,
      FiscalRegime: profile.regimenFiscal,
    };

    const result = await updateCSD(profile.rfc, payload);

    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: {
        csdUploadedAt: new Date(),
        csdValidUntil: result.ValidTo ? new Date(result.ValidTo) : null,
        facturamaStatus: 'active',
      },
    });

    return NextResponse.json({
      data: {
        status: 'active',
        certificateNumber: result.CertificateNumber,
        validFrom: result.ValidFrom,
        validTo: result.ValidTo,
      }
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      console.error('Facturama CSD update error:', error.details);
      return NextResponse.json(
        { error: `Error al actualizar CSD: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error updating CSD:', error);
    return NextResponse.json({ error: 'Error al actualizar certificados' }, { status: 500 });
  }
}

// DELETE /api/facturacion/csd - Remove CSD from Facturama
export async function DELETE(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Perfil fiscal no encontrado' }, { status: 404 });
    }

    await deleteCSD(profile.rfc);

    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: {
        csdUploaded: false,
        csdUploadedAt: null,
        csdValidUntil: null,
        facturamaStatus: 'pending',
      },
    });

    return NextResponse.json({ data: { status: 'removed' } });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al eliminar CSD: ${error.message}` },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error deleting CSD:', error);
    return NextResponse.json({ error: 'Error al eliminar certificados' }, { status: 500 });
  }
}
