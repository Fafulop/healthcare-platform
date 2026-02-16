// Hero Section - Only H1 on page, SEO anchor
// SERVER COMPONENT - Renders immediately for optimal LCP
import React from 'react';
import Image from 'next/image';
import { MapPin, Award, Star } from 'lucide-react';
import Badge from '../ui/Badge';
import BlobDecoration from '../ui/BlobDecoration';
import HeroButtons from './HeroButtons';
import type { DoctorProfile } from '@/types/doctor';

interface HeroSectionProps {
  doctor: DoctorProfile;
  onBookingClick?: () => void;
  googleAdsId?: string;
}

export default function HeroSection({ doctor, onBookingClick, googleAdsId }: HeroSectionProps) {

  return (
    <section id="inicio" className="relative overflow-hidden bg-[var(--color-bg-yellow-light)] py-12 md:py-16">
      {/* Visible organic blobs */}
      <BlobDecoration variant="blob1" color="gradient-blue" position="top-right" size="xl" opacity={35} blur={false} />
      <BlobDecoration variant="blob3" color="gradient-purple" position="bottom-left" size="lg" opacity={30} blur={false} />
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
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Award className="w-5 h-5 text-yellow-600" />
              <span className="text-base font-semibold text-[var(--color-neutral-dark)]">
                {doctor.years_experience}+ Años de Experiencia
              </span>
            </div>

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

            {/* H2 - Primary specialty and location */}
            <h2 className="text-[var(--font-size-h2)] text-[var(--color-secondary)] mb-4">
              {doctor.primary_specialty}
            </h2>

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
