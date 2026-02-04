// GET /api/doctors/[slug] - Get doctor by slug
// PUT /api/doctors/[slug] - Update doctor (future)
// DELETE /api/doctors/[slug] - Delete doctor (future)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      include: {
        services: true,
        educationItems: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
        reviews: {
          where: { approved: true },
          select: {
            id: true,
            patientName: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50, // Limit to most recent 50 reviews
        },
      },
    });

    if (!doctor) {
      return NextResponse.json(
        {
          success: false,
          error: `Doctor with slug "${slug}" not found`,
        },
        { status: 404 }
      );
    }

    // Calculate aggregate rating stats
    const reviewCount = doctor.reviews.length;
    const averageRating = reviewCount > 0
      ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        ...doctor,
        reviewStats: {
          averageRating: Number(averageRating.toFixed(1)),
          reviewCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch doctor',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // ✅ AUTHENTICATION CHECK - Admin or owning Doctor
    const { validateAuthToken } = await import('@/lib/auth');

    let authUser: { email: string; role: string; userId: string; doctorId: string | null };
    try {
      authUser = await validateAuthToken(request);
    } catch (error) {
      console.error('Authentication failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Ownership check: DOCTOR can only edit their own profile
    if (authUser.role === 'DOCTOR') {
      const targetDoctor = await prisma.doctor.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!targetDoctor || targetDoctor.id !== authUser.doctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden',
            message: 'No tienes permiso para editar este perfil.',
          },
          { status: 403 }
        );
      }
    } else if (authUser.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'Admin or Doctor access required',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ✅ SEO PROTECTION: Prevent slug changes
    if (body.slug && body.slug !== slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot change slug',
          message: 'El slug no se puede modificar por razones de SEO. Cree un nuevo doctor si necesita una URL diferente.',
        },
        { status: 400 }
      );
    }

    console.log('Received doctor update request:', {
      slug,
      name: body.doctor_full_name,
      services: body.services_list?.length || 0,
      certificates: body.certificate_images?.length || 0,
      carousel: body.carousel_items?.length || 0,
    });

    // Check if doctor exists
    const existingDoctor = await prisma.doctor.findUnique({
      where: { slug },
    });

    if (!existingDoctor) {
      return NextResponse.json(
        {
          success: false,
          error: `Doctor with slug "${slug}" not found`,
        },
        { status: 404 }
      );
    }

    // Update doctor with transaction to ensure data consistency
    const doctor = await prisma.$transaction(async (tx) => {
      // Delete existing related records
      await tx.service.deleteMany({ where: { doctorId: existingDoctor.id } });
      await tx.education.deleteMany({ where: { doctorId: existingDoctor.id } });
      await tx.certificate.deleteMany({ where: { doctorId: existingDoctor.id } });
      await tx.carouselItem.deleteMany({ where: { doctorId: existingDoctor.id } });
      await tx.fAQ.deleteMany({ where: { doctorId: existingDoctor.id } });

      // Update doctor with new data
      return await tx.doctor.update({
        where: { slug },
        data: {
          slug: slug, // Keep original slug (SEO protection)
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
          colorPalette: body.color_palette || 'warm',
          // Create new related services
          services: {
            create: (body.services_list || []).map((service: any) => ({
              serviceName: service.service_name,
              shortDescription: service.short_description,
              durationMinutes: service.duration_minutes,
              price: service.price,
            })),
          },
          // Create new education items
          educationItems: {
            create: (body.education_items || []).map((edu: any) => ({
              institution: edu.institution,
              program: edu.program,
              year: edu.year,
              notes: edu.notes || "",
            })),
          },
          // Create new certificates
          certificates: {
            create: (body.certificate_images || []).map((cert: any) => ({
              src: cert.src,
              alt: cert.alt,
              issuedBy: cert.issued_by,
              year: cert.year,
            })),
          },
          // Create new carousel items
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
          // Create new FAQs
          faqs: {
            create: (body.faqs || []).map((faq: any) => ({
              question: faq.question,
              answer: faq.answer,
            })),
          },
        },
        include: {
          services: true,
          educationItems: true,
          certificates: true,
          carouselItems: true,
          faqs: true,
        },
      });
    });

    console.log('✅ Doctor updated successfully:', slug);

    return NextResponse.json({
      success: true,
      data: doctor,
      message: 'Doctor profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating doctor:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update doctor',
        message: errorMessage,
        details: error,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // TODO: Implement delete logic (soft delete recommended)
  return NextResponse.json(
    { success: false, error: 'Not implemented yet' },
    { status: 501 }
  );
}
