// SEO Metadata Generation Utilities
// Based on SEO_GUIDE.md specifications

import type { Metadata } from 'next';
import type { DoctorProfile } from '@/types/doctor';

/**
 * Generate metadata for doctor profile page
 * Following template: "{doctor_full_name} | {primary_specialty} | {city}"
 */
export function generateDoctorMetadata(doctor: DoctorProfile, baseUrl: string = 'https://tusalud.pro'): Metadata {
  // Title template: "{full_name} | {specialty} | {city}"
  const title = `${doctor.doctor_full_name} | ${doctor.primary_specialty} | ${doctor.city}`;

  // Meta description in Spanish, capped at ~155 chars
  const doctorName = doctor.doctor_full_name;
  const bioSnippet = doctor.long_bio ? ` ${doctor.long_bio.substring(0, 80).trim()}...` : '';
  const description = `${doctorName}, ${doctor.primary_specialty} en ${doctor.city}.${bioSnippet} Agenda citas, consulta servicios, opiniones y ubicación.`;

  // Canonical URL
  const canonicalUrl = `${baseUrl}/doctores/${doctor.slug}`;

  // OpenGraph image
  const ogImage = doctor.hero_image.startsWith('http')
    ? doctor.hero_image
    : `${baseUrl}${doctor.hero_image}`;

  return {
    title,
    description,
    keywords: [
      doctor.primary_specialty,
      doctor.city,
      ...doctor.subspecialties || [],
      'médico',
      'consulta médica',
      'citas médicas',
      'salud',
    ].join(', '),
    authors: [{ name: doctor.doctor_full_name }],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'TuSalud.pro',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
        },
      ],
      locale: 'es_MX',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@tusaludpro',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

/**
 * Generate preload link tags for critical resources (hero image)
 */
export function generatePreloadLinks(doctor: DoctorProfile): string {
  const heroImageUrl = doctor.hero_image;
  return `<link rel="preload" as="image" href="${heroImageUrl}" />`;
}

/**
 * Extract short bio snippet for meta description
 */
export function getShortBioSnippet(bio: string, maxLength: number = 100): string {
  if (bio.length <= maxLength) return bio;
  return bio.substring(0, maxLength).trim() + '...';
}
