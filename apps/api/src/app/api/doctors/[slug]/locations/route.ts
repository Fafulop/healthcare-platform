// GET /api/doctors/[slug]/locations - Get clinic locations for a doctor (public, no auth)

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
      select: { id: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: `Doctor with slug "${slug}" not found` },
        { status: 404 }
      );
    }

    const locations = await prisma.clinicLocation.findMany({
      where: { doctorId: doctor.id },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error('Error fetching clinic locations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clinic locations' },
      { status: 500 }
    );
  }
}
