// Data Loading Utilities
// Load doctor data from Backend API

import type { DoctorProfile } from '@healthcare/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

/**
 * Transform API response to DoctorProfile type
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
    location_summary: doctor.locationSummary || (doctor.city ? `${doctor.city}, México` : ''),
    city: doctor.city,

    // Services
    services_list: doctor.services.map((s: any) => ({
      id: s.id,
      service_name: s.serviceName,
      short_description: s.shortDescription,
      duration_minutes: s.durationMinutes,
      price: s.price || undefined,
    })),

    // Conditions & Procedures
    conditions: doctor.conditions,
    procedures: doctor.procedures,

    // Appointment
    next_available_date: doctor.nextAvailableDate || undefined,
    appointment_modes: doctor.appointmentModes as ('in_person' | 'teleconsult')[],

    // Carousel
    carousel_items: doctor.carouselItems.map((item: any) => ({
      type: item.type as 'image' | 'video',
      src: item.src,
      alt: item.alt || `Consultorio de ${doctor.doctorFullName}${doctor.city ? ` en ${doctor.city}` : ''}`,
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

    // Clinic Locations (multi-location support)
    clinic_locations: (doctor.clinicLocations || []).map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      phone: loc.phone ?? null,
      whatsapp: loc.whatsapp ?? null,
      hours: loc.hours ?? undefined,
      geoLat: loc.geoLat ?? null,
      geoLng: loc.geoLng ?? null,
    })),

    // FAQs
    faqs: doctor.faqs.map((faq: any) => ({
      question: faq.question,
      answer: faq.answer,
    })),

    // Social Links
    social_links: {
      linkedin: doctor.socialLinkedin || undefined,
      twitter: doctor.socialTwitter || undefined,
      instagram: doctor.socialInstagram || undefined,
      facebook: doctor.socialFacebook || undefined,
      tiktok: doctor.socialTiktok || undefined,
    },

    // Reviews (added from API)
    reviews: doctor.reviews || [],
    reviewStats: doctor.reviewStats || { averageRating: 0, reviewCount: 0 },

    // Color Palette (for personalized branding)
    color_palette: doctor.colorPalette || 'professional',

    // Google Ads - Per-doctor Ads account ID
    google_ads_id: doctor.googleAdsId || undefined,

    // Scheduling mode detection
    hasRanges: doctor.hasRanges ?? false,
  };
}

/**
 * Get doctor profile by slug
 */
export async function getDoctorBySlug(slug: string): Promise<DoctorProfile | null> {
  try {
    const response = await fetch(`${API_URL}/api/doctors/${slug}`, {
      // Use cache for static generation, but revalidate periodically
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    return transformDoctorToProfile(json.data);
  } catch (error) {
    console.error(`Error loading doctor with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Get all doctor slugs for static generation
 */
export async function getAllDoctorSlugs(): Promise<string[]> {
  const doctors = await getAllDoctorSlugsWithDates();
  return doctors.map((d) => d.slug);
}

/**
 * Get all doctor slugs with updatedAt dates (for sitemap)
 */
export async function getAllDoctorSlugsWithDates(): Promise<{ slug: string; updatedAt: string | null }[]> {
  try {
    const response = await fetch(`${API_URL}/api/doctors`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((doctor: any) => ({
      slug: doctor.slug,
      updatedAt: doctor.updatedAt || null,
    }));
  } catch (error) {
    console.error('Error reading doctors from API:', error);
    return [];
  }
}

/**
 * Get all doctors (for listing pages, if needed)
 */
export async function getAllDoctors(): Promise<DoctorProfile[]> {
  try {
    const response = await fetch(`${API_URL}/api/doctors`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map(transformDoctorToProfile);
  } catch (error) {
    console.error('Error loading all doctors:', error);
    return [];
  }
}

// ========================================
// ARTICLE DATA FUNCTIONS
// ========================================

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  thumbnail: string | null;
  publishedAt: string;
  views: number;
  metaDescription: string | null;
  keywords: string[];
  doctor: {
    slug: string;
    doctorFullName: string;
    primarySpecialty: string;
    heroImage: string;
    city: string;
  };
}

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  publishedAt: string;
  views: number;
}

/**
 * Get all published articles for a doctor
 */
export async function getArticlesByDoctorSlug(doctorSlug: string): Promise<ArticleListItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/doctors/${doctorSlug}/articles`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data;
  } catch (error) {
    console.error(`Error loading articles for doctor "${doctorSlug}":`, error);
    return [];
  }
}

/**
 * Get a single published article by doctor slug and article slug
 */
export async function getArticle(doctorSlug: string, articleSlug: string): Promise<Article | null> {
  try {
    const response = await fetch(`${API_URL}/api/doctors/${doctorSlug}/articles/${articleSlug}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    return json.data;
  } catch (error) {
    console.error(`Error loading article "${articleSlug}" for doctor "${doctorSlug}":`, error);
    return null;
  }
}
