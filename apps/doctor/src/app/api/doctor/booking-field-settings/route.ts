import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

const FIELDS = {
  bookingPublicEmailRequired: true,
  bookingPublicPhoneRequired: true,
  bookingPublicWhatsappRequired: true,
  bookingHorariosEmailRequired: true,
  bookingHorariosPhoneRequired: true,
  bookingHorariosWhatsappRequired: true,
  bookingInstantEmailRequired: true,
  bookingInstantPhoneRequired: true,
  bookingInstantWhatsappRequired: true,
} as const;

// GET /api/doctor/booking-field-settings
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: FIELDS,
    });

    if (!doctor) {
      return NextResponse.json({ success: false, error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doctor });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PATCH /api/doctor/booking-field-settings
export async function PATCH(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const updateData: Partial<Record<keyof typeof FIELDS, boolean>> = {};
    for (const key of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json({ success: false, error: `${key} must be a boolean` }, { status: 400 });
        }
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: updateData,
      select: FIELDS,
    });

    return NextResponse.json({ success: true, data: doctor });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
