// GET /api/doctors/[slug]/services — lightweight public endpoint for booking widget

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: {
        services: {
          select: {
            id: true,
            serviceName: true,
            shortDescription: true,
            durationMinutes: true,
            price: true,
          },
        },
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    const data = doctor.services.map((s) => ({
      id: s.id,
      service_name: s.serviceName,
      short_description: s.shortDescription,
      duration_minutes: s.durationMinutes,
      price: s.price ? Number(s.price) : undefined,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching doctor services:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
