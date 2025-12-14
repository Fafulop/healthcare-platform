// GET /api/doctors - List all doctors
// POST /api/doctors - Create new doctor (admin only - future)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        services: true,
        educationItems: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch doctors',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // TODO: Add authentication check (admin only)
    // TODO: Add validation

    const doctor = await prisma.doctor.create({
      data: {
        slug: body.slug,
        doctorFullName: body.doctor_full_name,
        lastName: body.last_name,
        primarySpecialty: body.primary_specialty,
        subspecialties: body.subspecialties || [],
        cedulaProfesional: body.cedula_profesional,
        heroImage: body.hero_image,
        locationSummary: body.location_summary,
        city: body.city,
        shortBio: body.short_bio,
        longBio: body.long_bio || '',
        yearsExperience: body.years_experience,
        conditions: body.conditions || [],
        procedures: body.procedures || [],
        nextAvailableDate: body.next_available_date ? new Date(body.next_available_date) : null,
        appointmentModes: body.appointment_modes || [],
        clinicAddress: body.clinic_info.address,
        clinicPhone: body.clinic_info.phone,
        clinicWhatsapp: body.clinic_info.whatsapp,
        clinicHours: body.clinic_info.hours || {},
        clinicGeoLat: body.clinic_info.geo?.lat,
        clinicGeoLng: body.clinic_info.geo?.lng,
        socialLinkedin: body.social_links?.linkedin,
        socialTwitter: body.social_links?.twitter,
        // Relations will be added separately
      },
    });

    return NextResponse.json({
      success: true,
      data: doctor,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating doctor:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create doctor',
      },
      { status: 500 }
    );
  }
}
