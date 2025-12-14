// Data Loading Utilities
// Load doctor data from PostgreSQL database via Prisma

import { prisma } from '@healthcare/database';
import type { DoctorProfile } from '@healthcare/types';

/**
 * Transform database doctor to DoctorProfile type
 */
function transformDoctorToProfile(doctor: any): DoctorProfile {
  return {
    slug: doctor.slug,
    doctor_full_name: doctor.doctorFullName,
    last_name: doctor.lastName,
    primary_specialty: doctor.primarySpecialty,
    subspecialties: doctor.subspecialties,
    cedula_profesional: doctor.cedulaProfesional || undefined,
    hero_image: doctor.heroImage,
    location_summary: doctor.locationSummary,
    city: doctor.city,

    // Services
    services_list: doctor.services.map((s: any) => ({
      service_name: s.serviceName,
      short_description: s.shortDescription,
      duration_minutes: s.durationMinutes,
      price: s.price || undefined,
    })),

    // Conditions & Procedures
    conditions: doctor.conditions,
    procedures: doctor.procedures,

    // Appointment
    next_available_date: doctor.nextAvailableDate?.toISOString() || undefined,
    appointment_modes: doctor.appointmentModes as ('in_person' | 'teleconsult')[],

    // Carousel
    carousel_items: doctor.carouselItems.map((item: any) => ({
      type: item.type as 'image' | 'video_thumbnail',
      src: item.src,
      alt: item.alt,
      caption: item.caption || undefined,
      thumbnail: item.thumbnail || undefined,
      name: item.name || undefined,
      description: item.description || undefined,
      uploadDate: item.uploadDate || undefined,
      duration: item.duration || undefined,
    })),

    // Biography
    short_bio: doctor.shortBio,
    long_bio: doctor.longBio || undefined,
    years_experience: doctor.yearsExperience,

    // Education
    education_items: doctor.educationItems.map((edu: any) => ({
      institution: edu.institution,
      program: edu.program,
      year: edu.year,
      notes: edu.notes || undefined,
    })),

    // Credentials
    certificate_images: doctor.certificates.map((cert: any) => ({
      src: cert.src,
      alt: cert.alt,
      issued_by: cert.issuedBy,
      year: cert.year,
    })),

    // Clinic Info
    clinic_info: {
      address: doctor.clinicAddress,
      phone: doctor.clinicPhone,
      whatsapp: doctor.clinicWhatsapp || undefined,
      hours: doctor.clinicHours as any,
      geo: {
        lat: doctor.clinicGeoLat || 0,
        lng: doctor.clinicGeoLng || 0,
      },
    },

    // FAQs
    faqs: doctor.faqs.map((faq: any) => ({
      question: faq.question,
      answer: faq.answer,
    })),

    // Social Links
    social_links: {
      linkedin: doctor.socialLinkedin || undefined,
      twitter: doctor.socialTwitter || undefined,
    },
  };
}

/**
 * Get doctor profile by slug
 */
export async function getDoctorBySlug(slug: string): Promise<DoctorProfile | null> {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      include: {
        services: true,
        educationItems: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
    });

    if (!doctor) {
      return null;
    }

    return transformDoctorToProfile(doctor);
  } catch (error) {
    console.error(`Error loading doctor with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get all doctor slugs for static generation
 */
export async function getAllDoctorSlugs(): Promise<string[]> {
  try {
    const doctors = await prisma.doctor.findMany({
      select: { slug: true },
    });

    return doctors.map((doctor) => doctor.slug);
  } catch (error) {
    console.error('Error reading doctors from database:', error);
    return [];
  }
}

/**
 * Get all doctors (for listing pages, if needed)
 */
export async function getAllDoctors(): Promise<DoctorProfile[]> {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        services: true,
        educationItems: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
    });

    return doctors.map(transformDoctorToProfile);
  } catch (error) {
    console.error('Error loading all doctors:', error);
    return [];
  }
}
