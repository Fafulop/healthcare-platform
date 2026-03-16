import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

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

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        prescriptionLogoUrl:      body.logoUrl !== undefined ? (body.logoUrl || null) : undefined,
        prescriptionSignatureUrl: body.signatureUrl !== undefined ? (body.signatureUrl || null) : undefined,
        prescriptionColorScheme:  body.colorScheme !== undefined ? body.colorScheme : undefined,
      },
      select: {
        prescriptionLogoUrl: true,
        prescriptionSignatureUrl: true,
        prescriptionColorScheme: true,
      },
    });

    return NextResponse.json({ data: doctor });
  } catch (error) {
    return handleApiError(error, 'PUT /api/prescription-template');
  }
}
