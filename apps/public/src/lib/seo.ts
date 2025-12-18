// SEO Metadata Generation Utilities
// Based on SEO_GUIDE.md specifications

import type { Metadata } from 'next';
import type { DoctorProfile } from '@/types/doctor';

/**
 * Generate metadata for doctor profile page
 * Following template: "{doctor_full_name} | {primary_specialty} | {city}"
 */
export function generateDoctorMetadata(doctor: DoctorProfile, baseUrl: string = 'https://example.com'): Metadata {
  // Title template from SEO_GUIDE
  const title = `${doctor.doctor_full_name} | ${doctor.primary_specialty} | ${doctor.city}`;

  // Meta description template from SEO_GUIDE
  const description = `Dr. ${doctor.last_name}, ${doctor.primary_specialty} in ${doctor.city}. ${doctor.short_bio.substring(0, 100)}... | Book appointments, view services, credentials, and clinic location.`;

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
      'doctor',
      'medical',
      'healthcare',
    ].join(', '),
    authors: [{ name: doctor.doctor_full_name }],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Doctor Profiles',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
        },
      ],
      locale: 'en_US',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
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
