// Hero Section - Only H1 on page, SEO anchor
import React from 'react';
import Image from 'next/image';
import { Phone, MapPin, MessageCircle } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import type { DoctorProfile } from '@/types/doctor';

interface HeroSectionProps {
  doctor: DoctorProfile;
}

export default function HeroSection({ doctor }: HeroSectionProps) {
  return (
    <section className="bg-gradient-to-b from-[var(--color-bg-yellow-light)] to-[var(--color-bg-green-light)] py-12 md:py-16">
      <div className="px-4 lg:px-0">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-6">
          {/* Doctor Photo - Priority loading for LCP */}
          <div className="flex-shrink-0">
            <div className="relative w-44 h-44 md:w-52 md:h-52 border-2 border-[var(--color-secondary)] rounded-[var(--radius-large)] p-1">
              <div className="relative w-full h-full">
                <Image
                  src={doctor.hero_image}
                  alt={`${doctor.doctor_full_name} - ${doctor.primary_specialty}`}
                  fill
                  priority
                  className="rounded-[var(--radius-large)] object-cover shadow-[var(--shadow-light)]"
                  sizes="(max-width: 768px) 176px, 208px"
                />
              </div>
            </div>
          </div>

          {/* Doctor Information */}
          <div className="flex-1 text-center md:text-left">
            {/* H1 - Only H1 on entire page */}
            <h1 className="text-[var(--font-size-h1)] font-bold text-[var(--color-neutral-dark)] mb-2">
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

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button variant="primary" size="lg">
                Book Appointment
              </Button>
              <Button variant="secondary" size="lg">
                <Phone className="w-5 h-5 mr-2" />
                Call Now
              </Button>
              {doctor.clinic_info.whatsapp && (
                <Button variant="tertiary" size="lg">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
