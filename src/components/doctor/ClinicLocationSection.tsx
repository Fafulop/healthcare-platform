// Clinic Information & Map - Local SEO signal
import React from 'react';
import { MapPin, Phone, MessageCircle, Clock, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import type { ClinicInfo } from '@/types/doctor';

interface ClinicLocationSectionProps {
  clinicInfo: ClinicInfo;
  id?: string;
}

export default function ClinicLocationSection({ clinicInfo, id }: ClinicLocationSectionProps) {
  // Generate Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps?q=${clinicInfo.geo.lat},${clinicInfo.geo.lng}`;

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
      <div className="max-w-5xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Clinic Location
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6">
              Contact Information
            </h3>

            <div className="space-y-4">
              {/* Address */}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-[var(--color-neutral-dark)]">Address</p>
                  <p className="text-[var(--color-neutral-medium)]">{clinicInfo.address}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-[var(--color-neutral-dark)]">Phone</p>
                  <a
                    href={`tel:${clinicInfo.phone}`}
                    className="text-[var(--color-secondary)] hover:underline"
                  >
                    {clinicInfo.phone}
                  </a>
                </div>
              </div>

              {/* WhatsApp */}
              {clinicInfo.whatsapp && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-medium text-[var(--color-neutral-dark)]">WhatsApp</p>
                    <a
                      href={`https://wa.me/${clinicInfo.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-secondary)] hover:underline"
                    >
                      {clinicInfo.whatsapp}
                    </a>
                  </div>
                </div>
              )}

              {/* Google Maps Link */}
              <div className="pt-4">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[var(--color-secondary)] hover:text-[var(--color-secondary-hover)] font-semibold"
                >
                  <ExternalLink className="w-5 h-5" />
                  View on Google Maps
                </a>
              </div>
            </div>
          </Card>

          {/* Office Hours */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-[var(--color-secondary)]" />
              Office Hours
            </h3>

            {clinicInfo.hours ? (
              <div className="space-y-3">
                {Object.entries(clinicInfo.hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="font-medium text-[var(--color-neutral-dark)] capitalize">
                      {day}
                    </span>
                    <span className="text-[var(--color-neutral-medium)]">{hours}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--color-neutral-medium)]">
                Please call for office hours
              </p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
