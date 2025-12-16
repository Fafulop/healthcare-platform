// Hero Section - Only H1 on page, SEO anchor
'use client';
import React from 'react';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import type { DoctorProfile } from '@/types/doctor';

interface HeroSectionProps {
  doctor: DoctorProfile;
  onBookingClick?: () => void;
}

export default function HeroSection({ doctor, onBookingClick }: HeroSectionProps) {
  return (
    <section id="inicio" className="bg-gradient-to-b from-[var(--color-bg-yellow-light)] to-[var(--color-bg-green-light)] py-12 md:py-16">
      <div className="px-4 lg:px-0">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-6">
          {/* Doctor Photo - Priority loading for LCP - Option 1: Large Circle Hero Style */}
          <div className="flex-shrink-0">
            <div className="relative w-56 h-56 md:w-72 md:h-72">
              {/* Gradient border ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)] p-1 shadow-2xl">
                {/* White inner ring */}
                <div className="w-full h-full rounded-full bg-white p-2">
                  {/* Photo container */}
                  <div className="relative w-full h-full rounded-full overflow-hidden shadow-xl ring-4 ring-white/50">
                    <Image
                      src={doctor.hero_image}
                      alt={`${doctor.doctor_full_name} - ${doctor.primary_specialty}`}
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 768px) 224px, 288px"
                    />
                  </div>
                </div>
              </div>
              {/* Subtle glow effect behind */}
              <div className="absolute inset-0 rounded-full bg-[var(--color-secondary)] opacity-20 blur-2xl -z-10 scale-110"></div>
            </div>
          </div>

          {/* Doctor Information */}
          <div className="flex-1 text-center md:text-left">
            {/* H1 - Only H1 on entire page */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--color-neutral-dark)] mb-2 leading-tight">
              {doctor.doctor_full_name}
            </h1>

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

            {/* CTA Buttons - Hidden on mobile (sticky bar at bottom instead) */}
            <div className="hidden md:flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button variant="primary" size="lg" className="sm:min-w-[240px]" onClick={onBookingClick}>
                Agendar Cita
              </Button>
              <Button variant="secondary" size="lg" className="sm:min-w-[240px]">
                Enviar Mensaje
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
