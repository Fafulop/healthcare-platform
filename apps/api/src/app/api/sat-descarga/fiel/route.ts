import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';
import crypto from 'crypto';

/**
 * POST /api/sat-descarga/fiel — Upload e.Firma (FIEL) credentials
 *
 * Unlike CSD (sent to Facturama), e.Firma is stored encrypted in our DB
 * because we use it directly to sign SOAP requests to the SAT.
 */
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

    const body = await request.json();
    const { certificate, privateKey, password } = body;

    if (!certificate || !privateKey || !password) {
      return NextResponse.json(
        { error: 'Certificado (.cer), llave privada (.key) y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Validate the e.Firma: try to load the certificate and key
    let certInfo;
    try {
      certInfo = validateEfirma(certificate, privateKey, password);
    } catch (err: any) {
      return NextResponse.json(
        { error: `e.Firma inválida: ${err.message}` },
        { status: 400 }
      );
    }

    // Verify the certificate RFC matches the doctor's RFC
    if (certInfo.rfc && certInfo.rfc !== profile.rfc) {
      return NextResponse.json(
        { error: `El RFC del certificado (${certInfo.rfc}) no coincide con tu perfil fiscal (${profile.rfc})` },
        { status: 400 }
      );
    }

    // Encrypt and store
    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: {
        fielUploaded: true,
        fielUploadedAt: new Date(),
        fielValidUntil: certInfo.validTo,
        fielCerEncrypted: encrypt(certificate),
        fielKeyEncrypted: encrypt(privateKey),
        fielPasswordEncrypted: encrypt(password),
      },
    });

    return NextResponse.json({
      data: {
        status: 'active',
        rfc: certInfo.rfc,
        subject: certInfo.subject,
        validFrom: certInfo.validFrom?.toISOString(),
        validTo: certInfo.validTo?.toISOString(),
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error uploading e.Firma:', error);
    return NextResponse.json({ error: 'Error al cargar e.Firma' }, { status: 500 });
  }
}

/**
 * GET /api/sat-descarga/fiel — Check e.Firma status
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: {
        fielUploaded: true,
        fielUploadedAt: true,
        fielValidUntil: true,
        rfc: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ data: { configured: false } });
    }

    const isExpired = profile.fielValidUntil
      ? new Date() > profile.fielValidUntil
      : false;

    return NextResponse.json({
      data: {
        configured: profile.fielUploaded,
        uploadedAt: profile.fielUploadedAt?.toISOString() ?? null,
        validUntil: profile.fielValidUntil?.toISOString() ?? null,
        expired: isExpired,
        rfc: profile.rfc,
      }
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error checking e.Firma status:', error);
    return NextResponse.json({ error: 'Error al verificar e.Firma' }, { status: 500 });
  }
}

/**
 * DELETE /api/sat-descarga/fiel — Remove e.Firma credentials
 */
export async function DELETE(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Perfil fiscal no encontrado' }, { status: 404 });
    }

    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: {
        fielUploaded: false,
        fielUploadedAt: null,
        fielValidUntil: null,
        fielCerEncrypted: null,
        fielKeyEncrypted: null,
        fielPasswordEncrypted: null,
      },
    });

    return NextResponse.json({ data: { status: 'removed' } });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting e.Firma:', error);
    return NextResponse.json({ error: 'Error al eliminar e.Firma' }, { status: 500 });
  }
}

// --- Helpers ---

interface CertInfo {
  rfc: string | null;
  subject: string;
  validFrom: Date | null;
  validTo: Date | null;
}

/**
 * Validate that the certificate and key are a valid pair.
 * Extract RFC from certificate subject.
 */
function validateEfirma(cerBase64: string, keyBase64: string, password: string): CertInfo {
  // Wrap raw base64 certificate in PEM format (64-char lines, matching sat-descarga.ts)
  const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`;

  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(cerPem);
  } catch {
    throw new Error('El archivo .cer no es un certificado válido');
  }

  // Decode and verify private key with password
  const keyDer = Buffer.from(keyBase64, 'base64');
  try {
    crypto.createPrivateKey({
      key: keyDer,
      format: 'der',
      type: 'pkcs8',
      passphrase: password,
    });
  } catch {
    throw new Error('La llave privada (.key) o contraseña es incorrecta');
  }

  // Check certificate is not expired
  const validTo = new Date(cert.validTo);
  if (validTo < new Date()) {
    throw new Error(`El certificado expiró el ${validTo.toLocaleDateString('es-MX')}`);
  }

  // Extract RFC from subject (format: ...serialNumber=/ LOFD9406276F8...)
  // SAT certificates include RFC in the serialNumber field of the subject
  const subject = cert.subject;
  let rfc: string | null = null;
  const serialMatch = subject.match(/serialNumber\s*=\s*\/?\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
  if (serialMatch) {
    rfc = serialMatch[1].toUpperCase();
  }

  return {
    rfc,
    subject: cert.subject,
    validFrom: new Date(cert.validFrom),
    validTo,
  };
}
