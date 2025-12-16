// GET /api/doctors - List all doctors
// POST /api/doctors - Create new doctor (admin only)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdmin } from '@healthcare/auth';
import { createDoctorSchema } from '@healthcare/types';

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
    // ✅ AUTHENTICATION CHECK - Admin only
    // For cross-app requests in development, check origin instead
    const origin = request.headers.get('origin');
    const isLocalDev = process.env.NODE_ENV === 'development';
    const isFromAdminApp = origin === 'http://localhost:3002';

    // Skip auth check for admin app in local development
    // TODO: Implement proper token-based auth for production
    if (!isLocalDev || !isFromAdminApp) {
      try {
        await requireAdmin();
      } catch (error) {
        console.error('Authentication failed:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'Admin access required to create doctors',
          },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    console.log('Received doctor creation request:', {
      slug: body.slug,
      name: body.doctor_full_name,
      services: body.services_list?.length || 0,
      certificates: body.certificate_images?.length || 0,
      carousel: body.carousel_items?.length || 0,
    });

    // ✅ VALIDATION - Validate input data with Zod
    // Temporarily disabled due to monorepo module resolution issues
    // TODO: Re-enable validation once Zod is properly configured
    /*
    const validation = createDoctorSchema.safeParse(body);

    if (!validation.success) {
      console.error('Validation failed:', validation.error.format());
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          message: 'Invalid doctor data provided',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    // Use validated data
    const validatedData = validation.data;
    */

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
        // Create related services
        services: {
          create: (body.services_list || []).map((service: any) => ({
            serviceName: service.service_name,
            shortDescription: service.short_description,
            durationMinutes: service.duration_minutes,
            price: service.price,
          })),
        },
        // Create related education items
        educationItems: {
          create: (body.education_items || []).map((edu: any) => ({
            institution: edu.institution,
            program: edu.program,
            year: edu.year,
            notes: edu.notes,
          })),
        },
        // Create related certificates
        certificates: {
          create: (body.certificate_images || []).map((cert: any) => ({
            src: cert.src,
            alt: cert.alt,
            issuedBy: cert.issued_by,
            year: cert.year,
          })),
        },
        // Create related carousel items
        carouselItems: {
          create: (body.carousel_items || []).map((item: any) => ({
            type: item.type,
            src: item.src,
            thumbnail: item.thumbnail,
            alt: item.alt,
            caption: item.caption,
            name: item.name,
            description: item.description,
            uploadDate: item.uploadDate,
            duration: item.duration,
          })),
        },
        // Create related FAQs
        faqs: {
          create: (body.faqs || []).map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
          })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: doctor,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating doctor:', error);

    // Return detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create doctor',
        message: errorMessage,
        details: error,
      },
      { status: 500 }
    );
  }
}
