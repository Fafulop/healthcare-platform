// Hero Section - Only H1 on page, SEO anchor
// SERVER COMPONENT - Renders immediately for optimal LCP
import React from 'react';
import Image from 'next/image';
import { MapPin, Award, Star } from 'lucide-react';
import Badge from '../ui/Badge';
import BlobDecoration from '../ui/BlobDecoration';
import HeroButtons from './HeroButtons';
import type { DoctorProfile } from '@/types/doctor';
import { toTitleCase } from '@/lib/text';


interface HeroSectionProps {
  doctor: DoctorProfile;
  onBookingClick?: () => void;
  googleAdsId?: string;
}

export default function HeroSection({ doctor, onBookingClick, googleAdsId }: HeroSectionProps) {

  return (
    <section id="inicio" className="relative overflow-hidden bg-[var(--color-bg-yellow-light)] py-12 md:py-16">
      {/* Visible organic blobs */}
      <BlobDecoration variant="blob1" color="gradient-primary" position="top-right" size="xl" opacity={35} blur={false} />
      <BlobDecoration variant="blob3" color="gradient-secondary" position="bottom-left" size="lg" opacity={30} blur={false} />
      <BlobDecoration variant="blob2" color="primary" position="top-left" size="md" opacity={25} blur={false} className="hidden md:block" />

      <div className="relative px-4 lg:px-0">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-6 max-w-5xl lg:mx-auto">
          {/* Doctor Photo - Priority loading for LCP - Simple border style */}
          <div className="flex-shrink-0">
            <div className="relative w-56 h-56 md:w-72 md:h-72">
              {/* Simple border ring */}
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-primary)] shadow-xl">
                {/* Photo container */}
                <div className="relative w-full h-full rounded-full overflow-hidden">
                  <Image
                    src={doctor.hero_image}
                    alt={`${doctor.doctor_full_name} - ${doctor.primary_specialty}`}
                    fill
                    priority
                    fetchPriority="high"
                    className="object-cover"
                    sizes="(max-width: 768px) 224px, 288px"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Information */}
          <div className="flex-1 text-center md:text-left">
            {/* H1 - Only H1 on entire page */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--color-neutral-dark)] mb-3 leading-tight">
              {doctor.doctor_full_name}
            </h1>

            {/* Years of Experience Badge - E-E-A-T Signal for SEO */}
            {doctor.years_experience > 0 && (
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Award className="w-5 h-5 text-yellow-600" />
              <span className="text-base font-semibold text-[var(--color-neutral-dark)]">
                {doctor.years_experience}+ Años de Experiencia
              </span>
            </div>
            )}

            {/* Review Rating - Trust Signal + Rich Snippet Eligibility */}
            {doctor.reviewStats && doctor.reviewStats.reviewCount > 0 && (
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                {/* Star Rating Display */}
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(doctor.reviewStats!.averageRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {/* Rating Number */}
                <span className="font-semibold text-gray-900">
                  {doctor.reviewStats.averageRating.toFixed(1)}
                </span>
                {/* Review Count */}
                <span className="text-gray-600">
                  ({doctor.reviewStats.reviewCount} {doctor.reviewStats.reviewCount === 1 ? 'opinión' : 'opiniones'})
                </span>
              </div>
            )}

            {/* H2 - Primary specialty + city (SEO: strongest on-page signal) */}
            {doctor.primary_specialty && (
              <h2 className="text-[var(--font-size-h2)] text-[var(--color-secondary)] mb-4">
                {toTitleCase(doctor.primary_specialty)}{doctor.city ? ` en ${doctor.city}` : ''}
              </h2>
            )}

            {/* Location */}
            <div className="flex items-center justify-center md:justify-start gap-2 text-[var(--color-neutral-medium)] mb-4">
              <MapPin className="w-5 h-5" />
              <span className="text-base">{doctor.location_summary}</span>
            </div>

            {/* Subspecialties as badges */}
            {doctor.subspecialties && doctor.subspecialties.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                {doctor.subspecialties.map((subspecialty, index) => (
                  <Badge key={index} variant="secondary">
                    {subspecialty}
                  </Badge>
                ))}
              </div>
            )}

            {/* Cedula Profesional */}
            {doctor.cedula_profesional && (
              <p className="text-sm text-[var(--color-neutral-medium)] mb-6">
                Cédula Profesional: <span className="font-semibold">{doctor.cedula_profesional}</span>
              </p>
            )}

            {/* Social Links */}
            {doctor.social_links && Object.values(doctor.social_links).some(Boolean) && (
              <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                {doctor.social_links.instagram && (
                  <a href={doctor.social_links.instagram} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:shadow-md transition-shadow"
                    aria-label="Instagram">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: '#E1306C' }}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                    </svg>
                  </a>
                )}
                {doctor.social_links.facebook && (
                  <a href={doctor.social_links.facebook} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:shadow-md transition-shadow"
                    aria-label="Facebook">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                {doctor.social_links.tiktok && (
                  <a href={doctor.social_links.tiktok} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:shadow-md transition-shadow"
                    aria-label="TikTok">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#000' }}>
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
                    </svg>
                  </a>
                )}
                {doctor.social_links.twitter && (
                  <a href={doctor.social_links.twitter} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:shadow-md transition-shadow"
                    aria-label="X">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#000' }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                {doctor.social_links.linkedin && (
                  <a href={doctor.social_links.linkedin} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:shadow-md transition-shadow"
                    aria-label="LinkedIn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* CTA Buttons - Client component for interactivity */}
            <HeroButtons
              doctorSlug={doctor.slug}
              whatsappNumber={doctor.clinic_info.whatsapp}
              onBookingClick={onBookingClick}
              googleAdsId={googleAdsId}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
