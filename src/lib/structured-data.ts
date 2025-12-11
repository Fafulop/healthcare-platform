// JSON-LD Structured Data Generators
// Based on SEO_GUIDE.md schema templates

import type { DoctorProfile } from '@/types/doctor';

/**
 * Generate Physician schema.org JSON-LD
 */
export function generatePhysicianSchema(doctor: DoctorProfile, baseUrl: string = 'https://example.com') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.doctor_full_name,
    description: doctor.short_bio,
    medicalSpecialty: doctor.primary_specialty,
    url: `${baseUrl}/doctors/${doctor.slug}`,
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
    url: `${baseUrl}/doctors/${doctor.slug}`,
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
 * Generate all structured data schemas for a doctor profile
 */
export function generateAllSchemas(doctor: DoctorProfile, baseUrl: string = 'https://example.com') {
  const schemas = [
    generatePhysicianSchema(doctor, baseUrl),
    generateMedicalBusinessSchema(doctor, baseUrl),
  ];

  const faqSchema = generateFAQSchema(doctor);
  if (faqSchema) {
    schemas.push(faqSchema);
  }

  return schemas;
}

/**
 * Generate script tags for JSON-LD schemas
 * Usage: Place in page <head> or use Next.js Script component
 */
export function generateSchemaScriptTags(doctor: DoctorProfile, baseUrl: string = 'https://example.com'): string {
  const schemas = generateAllSchemas(doctor, baseUrl);

  return schemas
    .map(
      (schema) =>
        `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`
    )
    .join('\n');
}
