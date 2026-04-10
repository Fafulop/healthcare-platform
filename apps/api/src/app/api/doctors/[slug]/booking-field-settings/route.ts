// GET /api/doctors/[slug]/booking-field-settings
// Public endpoint — returns the booking field requirement settings for the public booking widget.

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
        bookingPublicEmailRequired: true,
        bookingPublicPhoneRequired: true,
        bookingPublicWhatsappRequired: true,
      },
    });

    if (!doctor) {
      return NextResponse.json({ success: false, error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doctor });
  } catch {
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
  }
}
