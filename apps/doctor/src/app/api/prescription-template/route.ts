import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { validateCredentials, type PrescriptionCredential } from '@/lib/prescription-credentials';

// GET /api/prescription-template
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        prescriptionLogoUrl: true,
        prescriptionSignatureUrl: true,
        prescriptionColorScheme: true,
        prescriptionCredentials: true,
        // Identity (read-only here — profile fields)
        doctorFullName: true,
        primarySpecialty: true,
        subspecialties: true,
        cedulaProfesional: true,
      },
    });

    return NextResponse.json({ data: doctor ?? {} });
  } catch (error) {
    return handleApiError(error, 'GET /api/prescription-template');
  }
}

// PUT /api/prescription-template
export async function PUT(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    let credentials: PrescriptionCredential[] | undefined;
    if (body.credentials !== undefined) {
      const result = validateCredentials(body.credentials);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      credentials = result.credentials;
    }

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        prescriptionLogoUrl:      body.logoUrl !== undefined ? (body.logoUrl || null) : undefined,
        prescriptionSignatureUrl: body.signatureUrl !== undefined ? (body.signatureUrl || null) : undefined,
        prescriptionColorScheme:  body.colorScheme !== undefined ? body.colorScheme : undefined,
        prescriptionCredentials:  credentials !== undefined ? (credentials as object[]) : undefined,
      },
      select: {
        prescriptionLogoUrl: true,
        prescriptionSignatureUrl: true,
        prescriptionColorScheme: true,
        prescriptionCredentials: true,
      },
    });

    return NextResponse.json({ data: doctor });
  } catch (error) {
    return handleApiError(error, 'PUT /api/prescription-template');
  }
}
