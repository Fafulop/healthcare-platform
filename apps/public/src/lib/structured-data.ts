// JSON-LD Structured Data Generators
// Based on Google's official structured data documentation

import type { DoctorProfile } from '@/types/doctor';
import type { Article } from '@/lib/data';

const DEFAULT_BASE_URL = 'https://tusalud.pro';

/**
 * Normalize a time string to 24h HH:MM format for Schema.org.
 * Handles formats like "9:00 AM", "20:00 hrs", "3:00 PM", "08:00", "CERRADO".
 * Returns null for invalid/closed values.
 */
function normalizeTime(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s*hrs?\s*/i, '').trim();

  // Skip closed/invalid entries
  if (/cerrado|closed|n\/a/i.test(cleaned)) return null;

  // Try AM/PM format
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  // Try 24h format (already valid or close)
  const h24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = h24Match[2];
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  }

  return null;
}

/**
 * Build a PostalAddress object with all available fields.
 */
function buildPostalAddress(doctor: DoctorProfile) {
  return {
    '@type': 'PostalAddress',
    streetAddress: doctor.clinic_info.address,
    addressLocality: doctor.city,
    addressCountry: 'MX',
    ...(doctor.clinic_info.state && { addressRegion: doctor.clinic_info.state }),
    ...(doctor.clinic_info.postal_code && { postalCode: doctor.clinic_info.postal_code }),
  };
}

/**
 * Generate AggregateRating schema for doctor reviews
 */
export function generateAggregateRatingSchema(reviewStats: { averageRating: number; reviewCount: number }) {
  if (reviewStats.reviewCount === 0) return null;

  return {
    '@type': 'AggregateRating',
    ratingValue: reviewStats.averageRating.toFixed(1),
    bestRating: '5',
    worstRating: '1',
    ratingCount: reviewStats.reviewCount.toString(),
  };
}

/**
 * Generate Physician schema.org JSON-LD
 */
export function generatePhysicianSchema(
  doctor: DoctorProfile,
  baseUrl: string = DEFAULT_BASE_URL,
  reviewStats?: { averageRating: number; reviewCount: number }
) {
  // Only include sameAs when there are actual social links
  const socialLinks = doctor.social_links
    ? Object.values(doctor.social_links).filter(Boolean)
    : [];

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.doctor_full_name,
    description: doctor.long_bio,
    medicalSpecialty: doctor.primary_specialty,
    url: `${baseUrl}/doctores/${doctor.slug}`,
    image: doctor.hero_image.startsWith('http') ? doctor.hero_image : `${baseUrl}${doctor.hero_image}`,
    address: buildPostalAddress(doctor),
    telephone: doctor.clinic_info.phone,
    ...(socialLinks.length > 0 && { sameAs: socialLinks }),
  };

  // Add aggregate rating if reviews exist
  if (reviewStats && reviewStats.reviewCount > 0) {
    const aggregateRating = generateAggregateRatingSchema(reviewStats);
    if (aggregateRating) {
      schema.aggregateRating = aggregateRating;
    }
  }

  return schema;
}

/**
 * Generate LocalBusiness/MedicalBusiness schema.org JSON-LD
 */
export function generateMedicalBusinessSchema(doctor: DoctorProfile, baseUrl: string = DEFAULT_BASE_URL) {
  // Build opening hours with normalized 24h times, skipping closed days
  let openingHoursSpec: any[] | undefined;
  if (doctor.clinic_info.hours) {
    const validEntries = Object.entries(doctor.clinic_info.hours)
      .map(([day, hours]) => {
        const parts = hours.split(' - ');
        const opens = normalizeTime(parts[0]);
        const closes = normalizeTime(parts[1]);
        if (!opens || !closes) return null;
        return {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
          opens,
          closes,
        };
      })
      .filter(Boolean);

    if (validEntries.length > 0) {
      openingHoursSpec = validEntries;
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: `${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
    description: doctor.long_bio,
    image: doctor.hero_image.startsWith('http') ? doctor.hero_image : `${baseUrl}${doctor.hero_image}`,
    address: buildPostalAddress(doctor),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: doctor.clinic_info.geo.lat,
      longitude: doctor.clinic_info.geo.lng,
    },
    telephone: doctor.clinic_info.phone,
    url: `${baseUrl}/doctores/${doctor.slug}`,
    ...(openingHoursSpec && { openingHoursSpecification: openingHoursSpec }),
  };
}

/**
 * Generate ProfilePage schema.org JSON-LD (Google-recommended for profile pages)
 * https://developers.google.com/search/docs/appearance/structured-data/profile-page
 */
export function generateProfilePageSchema(doctor: DoctorProfile, baseUrl: string = DEFAULT_BASE_URL) {
  const socialLinks = doctor.social_links
    ? Object.values(doctor.social_links).filter(Boolean)
    : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateModified: new Date().toISOString().split('T')[0],
    mainEntity: {
      '@type': 'Person',
      name: doctor.doctor_full_name,
      description: doctor.long_bio,
      image: doctor.hero_image.startsWith('http') ? doctor.hero_image : `${baseUrl}${doctor.hero_image}`,
      jobTitle: doctor.primary_specialty,
      ...(socialLinks.length > 0 && { sameAs: socialLinks }),
    },
  };
}

/**
 * Generate BreadcrumbList schema.org JSON-LD
 * https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export function generateBreadcrumbSchema(doctor: DoctorProfile, baseUrl: string = DEFAULT_BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Doctores',
        item: `${baseUrl}/doctores`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: doctor.doctor_full_name,
      },
    ],
  };
}

/**
 * Generate FAQPage schema.org JSON-LD
 */
export function generateFAQSchema(doctor: DoctorProfile) {
  if (!doctor.faqs || doctor.faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: doctor.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate individual Review schemas
 */
export function generateReviewSchemas(
  reviews: Array<{
    id: string;
    patientName: string | null;
    rating: number;
    comment: string;
    createdAt: Date;
  }>,
  doctorName: string
) {
  return reviews.map((review) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: review.patientName || 'Paciente Anónimo',
    },
    datePublished: new Date(review.createdAt).toISOString().split('T')[0],
    reviewBody: review.comment,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating.toString(),
      bestRating: '5',
      worstRating: '1',
    },
    itemReviewed: {
      '@type': 'Physician',
      name: doctorName,
    },
  }));
}

/**
 * Generate VideoObject schema.org JSON-LD for video carousel items
 */
export function generateVideoSchemas(doctor: DoctorProfile, baseUrl: string = DEFAULT_BASE_URL) {
  if (!doctor.carousel_items || doctor.carousel_items.length === 0) return [];

  const videoItems = doctor.carousel_items.filter(item => item.type === 'video');

  return videoItems.map((video, index) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name || `${doctor.doctor_full_name} - Video ${index + 1}`,
    description: video.description || video.caption || `Video de presentación del ${doctor.primary_specialty} ${doctor.doctor_full_name}`,
    thumbnailUrl: video.thumbnail ? (video.thumbnail.startsWith('http') ? video.thumbnail : `${baseUrl}${video.thumbnail}`) : undefined,
    contentUrl: video.src.startsWith('http') ? video.src : `${baseUrl}${video.src}`,
    uploadDate: video.uploadDate || new Date().toISOString().split('T')[0],
    ...(video.duration && { duration: video.duration }),
  }));
}

/**
 * Generate all structured data schemas for a doctor profile
 */
export function generateAllSchemas(
  doctor: DoctorProfile,
  baseUrl: string = DEFAULT_BASE_URL,
  reviewStats?: { averageRating: number; reviewCount: number }
) {
  const schemas: any[] = [
    generateProfilePageSchema(doctor, baseUrl),
    generateBreadcrumbSchema(doctor, baseUrl),
    generatePhysicianSchema(doctor, baseUrl, reviewStats),
    generateMedicalBusinessSchema(doctor, baseUrl),
  ];

  const faqSchema = generateFAQSchema(doctor);
  if (faqSchema) {
    schemas.push(faqSchema);
  }

  // Add video schemas
  const videoSchemas = generateVideoSchemas(doctor, baseUrl);
  if (videoSchemas.length > 0) {
    schemas.push(...videoSchemas);
  }

  return schemas;
}

/**
 * Generate BlogPosting schema.org JSON-LD for individual articles
 */
export function generateBlogPostingSchema(article: Article, baseUrl: string = DEFAULT_BASE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    image: article.thumbnail ? (article.thumbnail.startsWith('http') ? article.thumbnail : `${baseUrl}${article.thumbnail}`) : article.doctor.heroImage,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: {
      '@type': 'Person',
      name: article.doctor.doctorFullName,
      jobTitle: article.doctor.primarySpecialty,
      url: `${baseUrl}/doctores/${article.doctor.slug}`,
      image: article.doctor.heroImage,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TuSalud.pro',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/doctores/${article.doctor.slug}/blog/${article.slug}`,
    },
    keywords: article.keywords.join(', '),
  };
}

/**
 * Generate script tags for JSON-LD schemas
 */
export function generateSchemaScriptTags(
  doctor: DoctorProfile,
  baseUrl: string = DEFAULT_BASE_URL,
  reviewStats?: { averageRating: number; reviewCount: number }
): string {
  const schemas = generateAllSchemas(doctor, baseUrl, reviewStats);

  return schemas
    .map(
      (schema) =>
        `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`
    )
    .join('\n');
}
