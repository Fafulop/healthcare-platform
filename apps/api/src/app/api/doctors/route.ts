// GET /api/doctors - List all doctors
// POST /api/doctors - Create new doctor (admin only)


import { NextResponse } from 'next/server';
import { prisma, DEFAULT_TIER } from '@healthcare/database';
import { requireAdminAuth } from '@/lib/auth';
import { createDoctorSchema } from '@healthcare/types';
import { DOCTOR_PRIVATE_FIELDS } from '@/lib/doctor-public-fields';

// NOTE: this GET is intentionally unauthenticated (public site + sitemap).
// `omit` keeps credentials and commercial data out of the response — without it
// every scalar column ships to anonymous callers. See doctor-public-fields.ts.
export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      omit: DOCTOR_PRIVATE_FIELDS,
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
    // Validate JWT token from Authorization header
    try {
      await requireAdminAuth(request);
    } catch (error) {
      console.error('Authentication failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: error instanceof Error ? error.message : 'Admin access required to create doctors',
        },
        { status: 401 }
      );
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
        // TIERS: a new account is born FREE — explicit, not left to a default.
        // The Prisma client bakes the schema @default into its own INSERT, so a
        // stale build would silently write whatever ITS schema said; naming the
        // constant makes the decider this line, and the admin raises the plan
        // from /doctors. (02-PLAN §3.3 / §8.)
        tier: DEFAULT_TIER,
        doctorFullName: body.doctor_full_name,
        lastName: body.last_name,
        primarySpecialty: body.primary_specialty,
        subspecialties: body.subspecialties || [],
        cedulaProfesional: body.cedula_profesional,
        heroImage: body.hero_image,
        locationSummary: body.location_summary,
        city: body.city,
        shortBio: body.short_bio || '',
        longBio: body.long_bio || '',
        yearsExperience: body.years_experience,
        conditions: body.conditions || [],
        procedures: body.procedures || [],
        nextAvailableDate: body.next_available_date ? new Date(body.next_available_date) : null,
        appointmentModes: body.appointment_modes || [],
        clinicAddress: body.clinic_locations?.[0]?.address ?? body.clinic_info?.address,
        clinicPhone: body.clinic_locations?.[0]?.phone ?? body.clinic_info?.phone,
        clinicWhatsapp: body.clinic_locations?.[0]?.whatsapp ?? body.clinic_info?.whatsapp,
        clinicHours: body.clinic_locations?.[0]?.hours ?? body.clinic_info?.hours ?? {},
        clinicGeoLat: body.clinic_locations?.[0]?.geoLat ?? body.clinic_info?.geo?.lat,
        clinicGeoLng: body.clinic_locations?.[0]?.geoLng ?? body.clinic_info?.geo?.lng,
        socialLinkedin: body.social_links?.linkedin,
        socialTwitter: body.social_links?.twitter,
        socialInstagram: body.social_links?.instagram,
        socialFacebook: body.social_links?.facebook,
        socialTiktok: body.social_links?.tiktok,
        googleAdsId: body.google_ads_id || null,
        // Create related services
        services: {
          create: (body.services_list || []).map((service: any) => ({
            serviceName: service.service_name,
            shortDescription: service.short_description,
            durationMinutes: service.duration_minutes,
            price: service.price,
            isBookingActive: service.is_booking_active ?? true,
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
        // Create clinic locations — support new array format or fall back to legacy clinic_info
        clinicLocations: {
          create: body.clinic_locations?.length > 0
            ? body.clinic_locations.map((loc: any, i: number) => ({
                name: loc.name || (i === 0 ? 'Consultorio Principal' : `Consultorio ${i + 1}`),
                address: loc.address || '',
                phone: loc.phone || null,
                whatsapp: loc.whatsapp || null,
                hours: loc.hours || {},
                geoLat: loc.geoLat ?? null,
                geoLng: loc.geoLng ?? null,
                isDefault: i === 0,
                displayOrder: i,
              }))
            : [{
                name: 'Consultorio Principal',
                address: body.clinic_info?.address || '',
                phone: body.clinic_info?.phone || null,
                whatsapp: body.clinic_info?.whatsapp || null,
                hours: body.clinic_info?.hours || {},
                geoLat: body.clinic_info?.geo?.lat || null,
                geoLng: body.clinic_info?.geo?.lng || null,
                isDefault: true,
                displayOrder: 0,
              }],
        },
      },
    });

    // 🔴 TIERS Q4 — el alta sube los archivos ANTES de que exista el doctor, así
    // que el middleware de subida no tuvo a quién cobrárselos. Aquí ya hay fila:
    // se apuntan en el libro mayor. Sin esto, TODO lo que el admin sube en el
    // alta sería espacio que el doctor ocupa y que nadie mide.
    //
    // No se rechaza nada (opción B, la misma política que el router de admin):
    // los bytes ya están subidos y el doctor acaba de nacer. Y si el apunte
    // falla NO se tumba el alta: el doctor ya se creó, decirle que no se creó
    // sería mentirle.
    const pendientes: unknown[] = Array.isArray(body.uploaded_files) ? body.uploaded_files : [];
    const filas = pendientes
      .map((a) => a as { key?: unknown; url?: unknown; size?: unknown; kind?: unknown })
      // `key` es obligatoria: es la llave de dedupe y la que empata al borrar.
      // Una fila sin ella no se podría reconciliar nunca, así que se descarta.
      .filter(
        (a) =>
          typeof a.key === 'string' &&
          a.key.length > 0 &&
          typeof a.url === 'string' &&
          typeof a.size === 'number' &&
          Number.isFinite(a.size) &&
          a.size >= 0,
      )
      .map((a) => ({
        doctorId: doctor.id,
        fileKey: a.key as string,
        url: a.url as string,
        sizeBytes: Math.round(a.size as number),
        kind: typeof a.kind === 'string' ? a.kind.slice(0, 40) : 'desconocido',
      }));

    if (filas.length > 0) {
      try {
        await prisma.storedFile.createMany({ data: filas, skipDuplicates: true });
      } catch (e) {
        console.error('[storage] no se pudieron registrar los archivos del alta', {
          doctorId: doctor.id,
          archivos: filas.length,
          error: e instanceof Error ? e.message : e,
        });
      }
    }

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
