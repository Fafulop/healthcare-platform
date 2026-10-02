import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

// GET /api/doctor/services — returns the authenticated doctor's services
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const services = await prisma.service.findMany({
      where: { doctorId },
      // shortDescription + isBookingActive: used by the Ventas picker (VENTAS PACIENTE step 1).
      select: { id: true, serviceName: true, shortDescription: true, durationMinutes: true, price: true, isBookingActive: true },
      orderBy: { serviceName: 'asc' },
    });

    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    console.error('GET /api/doctor/services failed:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener servicios' },
      { status: 500 }
    );
  }
}
