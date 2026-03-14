// Clinic Information & Map - Local SEO signal
'use client';
import React from 'react';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import { trackMapClick } from '@/lib/analytics';
import type { ClinicInfo, ClinicLocationItem } from '@/types/doctor';

interface ClinicLocationSectionProps {
  doctorSlug?: string;
  clinicInfo: ClinicInfo;
  clinicLocations?: ClinicLocationItem[];
  id?: string;
}

export default function ClinicLocationSection({ doctorSlug, clinicInfo, clinicLocations, id }: ClinicLocationSectionProps) {
  // Use clinicLocations array if available, otherwise fall back to single clinic_info
  const locations: ClinicLocationItem[] = (clinicLocations && clinicLocations.length > 0)
    ? clinicLocations
    : [{
        id: 'default',
        name: 'Consultorio',
        address: clinicInfo.address,
        phone: clinicInfo.phone,
        whatsapp: clinicInfo.whatsapp,
        hours: clinicInfo.hours,
        geoLat: clinicInfo.geo.lat,
        geoLng: clinicInfo.geo.lng,
      }];

  const translateDay = (day: string): string => {
    const days: { [key: string]: string } = {
      'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles',
      'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo',
    };
    return days[day.toLowerCase()] || day;
  };

  const getMapsUrl = (loc: ClinicLocationItem) =>
    (loc.geoLat && loc.geoLng && loc.geoLat !== 0 && loc.geoLng !== 0)
      ? `https://www.google.com/maps?q=${loc.geoLat},${loc.geoLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;

  // Use hours from first location for the schedule card
  const primaryHours = locations[0]?.hours ?? clinicInfo.hours;

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Ubicación de la Clínica
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Addresses — one card per location */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6">
              {locations.length > 1 ? 'Consultorios' : 'Información de Contacto'}
            </h3>
            <div className="space-y-5">
              {locations.map((loc) => {
                const mapsUrl = getMapsUrl(loc);
                return (
                  <div key={loc.id} className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                    <div>
                      {locations.length > 1 && (
                        <p className="font-semibold text-[var(--color-neutral-dark)] text-sm mb-0.5">{loc.name}</p>
                      )}
                      <p className="text-[var(--color-neutral-medium)]">{loc.address}</p>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => doctorSlug && trackMapClick(doctorSlug, 'clinic_section')}
                        className="inline-flex items-center gap-1 text-sm text-[var(--color-secondary)] hover:text-[var(--color-secondary-hover)] font-semibold mt-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver en Google Maps
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Office Hours */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-[var(--color-secondary)]" />
              Horario de Atención
            </h3>
            {primaryHours ? (
              <div className="space-y-3">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                  const hours = primaryHours[day as keyof typeof primaryHours];
                  if (!hours) return null;
                  return (
                    <div key={day} className="flex justify-between">
                      <span className="font-medium text-[var(--color-neutral-dark)]">{translateDay(day)}</span>
                      <span className="text-[var(--color-neutral-medium)]">{hours}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[var(--color-neutral-medium)]">Por favor llame para conocer el horario</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
