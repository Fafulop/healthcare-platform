import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

// GET /api/doctor/services — returns the authenticated doctor's services
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const services = await prisma.service.findMany({
      where: { doctorId },
      select: { id: true, serviceName: true, durationMinutes: true, price: true },
      orderBy: { serviceName: 'asc' },
    });

    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error al obtener servicios' },
      { status: 500 }
    );
  }
}
