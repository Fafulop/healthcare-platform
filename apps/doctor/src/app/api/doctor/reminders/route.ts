import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

const VALID_OFFSETS = [15, 30, 60, 120, 240, 1440];

// GET /api/doctor/reminders — returns current reminder email settings
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { reminderEmailEnabled: true, reminderEmailOffsetMinutes: true },
    });

    if (!doctor) {
      return NextResponse.json({ success: false, error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      reminderEmailEnabled: doctor.reminderEmailEnabled,
      reminderEmailOffsetMinutes: doctor.reminderEmailOffsetMinutes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PATCH /api/doctor/reminders — update reminder email settings
export async function PATCH(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();
    const { reminderEmailEnabled, reminderEmailOffsetMinutes } = body;

    if (reminderEmailEnabled !== undefined && typeof reminderEmailEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'reminderEmailEnabled must be a boolean' }, { status: 400 });
    }

    if (reminderEmailOffsetMinutes !== undefined && !VALID_OFFSETS.includes(Number(reminderEmailOffsetMinutes))) {
      return NextResponse.json(
        { success: false, error: `reminderEmailOffsetMinutes must be one of: ${VALID_OFFSETS.join(', ')}` },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (reminderEmailEnabled !== undefined) data.reminderEmailEnabled = reminderEmailEnabled;
    if (reminderEmailOffsetMinutes !== undefined) data.reminderEmailOffsetMinutes = Number(reminderEmailOffsetMinutes);

    const doctor = await prisma.doctor.update({
      where: { id: doctorId },
      data,
      select: { reminderEmailEnabled: true, reminderEmailOffsetMinutes: true },
    });

    return NextResponse.json({
      success: true,
      reminderEmailEnabled: doctor.reminderEmailEnabled,
      reminderEmailOffsetMinutes: doctor.reminderEmailOffsetMinutes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
