// Clinic Information & Map - Local SEO signal
'use client';
import React from 'react';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import BlobDecoration from '../ui/BlobDecoration';
import { trackMapClick } from '@/lib/analytics';
import type { ClinicInfo, ClinicLocationItem } from '@/types/doctor';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

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

  const getMapsUrl = (loc: ClinicLocationItem) =>
    (loc.geoLat && loc.geoLng && loc.geoLat !== 0 && loc.geoLng !== 0)
      ? `https://www.google.com/maps?q=${loc.geoLat},${loc.geoLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;

  const renderHours = (hours: ClinicLocationItem['hours']) => {
    if (!hours) return <p className="text-[var(--color-neutral-medium)]">Por favor llame para conocer el horario</p>;
    return (
      <div className="space-y-3">
        {DAYS.map((day) => {
          const time = (hours as Record<string, string>)[day];
          if (!time) return null;
          return (
            <div key={day} className="flex justify-between">
              <span className="font-medium text-[var(--color-neutral-dark)]">{DAY_LABELS[day] ?? day}</span>
              <span className="text-[var(--color-neutral-medium)]">{time}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section id={id} className="relative py-16 bg-[var(--color-bg-green-light)] overflow-hidden">
      <BlobDecoration variant="blob4" color="gradient-purple" position="top-left" size="lg" opacity={20} blur={false} />
      <BlobDecoration variant="blob2" color="primary" position="bottom-right" size="md" opacity={18} blur={false} className="hidden md:block" />
      <div className="relative max-w-5xl mx-auto px-4">
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Ubicación de la Clínica
        </h2>

        {locations.length > 1 ? (
          /* Multiple locations: one card per location with address + hours */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {locations.map((loc) => {
              const mapsUrl = getMapsUrl(loc);
              return (
                <Card key={loc.id} shadow="light" padding="lg">
                  <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6">{loc.name}</h3>

                  <div className="flex items-start gap-3 mb-6">
                    <MapPin className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                    <div>
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

                  <div className="border-t pt-5">
                    <h4 className="text-sm font-semibold text-[var(--color-neutral-dark)] mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[var(--color-secondary)]" />
                      Horario de Atención
                    </h4>
                    {renderHours(loc.hours)}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Single location: address left, hours right */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card shadow="light" padding="lg">
              <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6">
                Información de Contacto
              </h3>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                <div>
                  <p className="text-[var(--color-neutral-medium)]">{locations[0].address}</p>
                  <a
                    href={getMapsUrl(locations[0])}
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
            </Card>

            <Card shadow="light" padding="lg">
              <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-[var(--color-secondary)]" />
                Horario de Atención
              </h3>
              {renderHours(locations[0]?.hours ?? clinicInfo.hours)}
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
