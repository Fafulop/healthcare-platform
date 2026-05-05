import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';

// GET /api/doctor/pdf-settings
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { pdfSettings: true },
    });

    if (!doctor) {
      return NextResponse.json({ success: false, error: 'Doctor not found' }, { status: 404 });
    }

    const settings = { ...DEFAULT_PDF_SETTINGS, ...((doctor.pdfSettings as Partial<PdfSettings>) || {}) };

    return NextResponse.json({ success: true, data: settings });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al obtener configuracion' }, { status: 500 });
  }
}

// PATCH /api/doctor/pdf-settings
export async function PATCH(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const BOOLEAN_KEYS: (keyof PdfSettings)[] = [
      'showHeader', 'showFooter', 'showPageNumbers',
      'showPatientBox', 'showEncounterMeta', 'showVitals', 'showFollowUp',
      'rxShowHeader', 'rxShowFooter', 'rxShowPatientBox', 'rxShowDiagnosis', 'rxShowClinicalNotes',
    ];
    const NUMBER_KEYS: (keyof PdfSettings)[] = [
      'topMarginMm', 'bottomMarginMm',
      'rxTopMarginMm', 'rxBottomMarginMm',
    ];

    const updateData: Partial<PdfSettings> = {};

    for (const key of BOOLEAN_KEYS) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json({ success: false, error: `${key} must be a boolean` }, { status: 400 });
        }
        (updateData as any)[key] = body[key];
      }
    }

    for (const key of NUMBER_KEYS) {
      if (key in body) {
        const val = Number(body[key]);
        if (isNaN(val) || val < 0 || val > 80) {
          return NextResponse.json({ success: false, error: `${key} must be a number between 0 and 80` }, { status: 400 });
        }
        (updateData as any)[key] = val;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    // Merge with existing settings
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { pdfSettings: true },
    });

    const merged = {
      ...DEFAULT_PDF_SETTINGS,
      ...((doctor?.pdfSettings as Partial<PdfSettings>) || {}),
      ...updateData,
    };

    await prisma.doctor.update({
      where: { id: doctorId },
      data: { pdfSettings: merged as any },
    });

    return NextResponse.json({ success: true, data: merged });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al actualizar configuracion' }, { status: 500 });
  }
}
