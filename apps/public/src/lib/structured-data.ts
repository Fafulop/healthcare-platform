// JSON-LD Structured Data Generators
// Based on SEO_GUIDE.md schema templates

import type { DoctorProfile } from '@/types/doctor';
import type { Article } from '@/lib/data';

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
  baseUrl: string = 'https://example.com',
  reviewStats?: { averageRating: number; reviewCount: number }
) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.doctor_full_name,
    description: doctor.short_bio,
    medicalSpecialty: doctor.primary_specialty,
    url: `${baseUrl}/doctores/${doctor.slug}`,
    image: doctor.hero_image.startsWith('http') ? doctor.hero_image : `${baseUrl}${doctor.hero_image}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: doctor.city,
      streetAddress: doctor.clinic_info.address,
    },
    telephone: doctor.clinic_info.phone,
    ...(doctor.social_links && {
      sameAs: Object.values(doctor.social_links).filter(Boolean),
    }),
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
export function generateMedicalBusinessSchema(doctor: DoctorProfile, baseUrl: string = 'https://example.com') {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: `Dr. ${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
    description: doctor.short_bio,
    image: doctor.hero_image.startsWith('http') ? doctor.hero_image : `${baseUrl}${doctor.hero_image}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: doctor.clinic_info.address,
      addressLocality: doctor.city,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: doctor.clinic_info.geo.lat,
      longitude: doctor.clinic_info.geo.lng,
    },
    telephone: doctor.clinic_info.phone,
    url: `${baseUrl}/doctores/${doctor.slug}`,
    ...(doctor.clinic_info.hours && {
      openingHoursSpecification: Object.entries(doctor.clinic_info.hours).map(([day, hours]) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
        opens: hours.split(' - ')[0],
        closes: hours.split(' - ')[1] || hours.split(' - ')[0],
      })),
    }),
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
export function generateVideoSchemas(doctor: DoctorProfile, baseUrl: string = 'https://example.com') {
  if (!doctor.carousel_items || doctor.carousel_items.length === 0) return [];

  const videoItems = doctor.carousel_items.filter(item => item.type === 'video_thumbnail');

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
  baseUrl: string = 'https://example.com',
  reviewStats?: { averageRating: number; reviewCount: number }
) {
  const schemas: any[] = [
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
export function generateBlogPostingSchema(article: Article, baseUrl: string = 'https://example.com') {
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
      name: 'HealthCare Platform',
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
 * Usage: Place in page <head> or use Next.js Script component
 */
export function generateSchemaScriptTags(
  doctor: DoctorProfile,
  baseUrl: string = 'https://example.com',
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
