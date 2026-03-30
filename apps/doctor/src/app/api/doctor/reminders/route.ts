import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

// GET /api/doctor/reminders — returns current reminder email setting
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { reminderEmailEnabled: true },
    });

    if (!doctor) {
      return NextResponse.json({ success: false, error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, reminderEmailEnabled: doctor.reminderEmailEnabled });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PATCH /api/doctor/reminders — toggle reminder email setting
export async function PATCH(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { reminderEmailEnabled } = await request.json();

    if (typeof reminderEmailEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'reminderEmailEnabled must be a boolean' }, { status: 400 });
    }

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data: { reminderEmailEnabled },
      select: { reminderEmailEnabled: true },
    });

    return NextResponse.json({ success: true, reminderEmailEnabled: doctor.reminderEmailEnabled });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
