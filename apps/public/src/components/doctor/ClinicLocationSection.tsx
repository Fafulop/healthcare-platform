// Clinic Information & Map - Local SEO signal
import React from 'react';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import BlobDecoration from '../ui/BlobDecoration';
import type { ClinicInfo} from '@/types/doctor';

interface ClinicLocationSectionProps {
  clinicInfo: ClinicInfo;
  id?: string;
}

export default function ClinicLocationSection({ clinicInfo, id }: ClinicLocationSectionProps) {
  // Generate Google Maps URL - Use coordinates if available, otherwise use address
  const googleMapsUrl = (clinicInfo.geo.lat !== 0 && clinicInfo.geo.lng !== 0)
    ? `https://www.google.com/maps?q=${clinicInfo.geo.lat},${clinicInfo.geo.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicInfo.address)}`;

  // Translate day names to Spanish
  const translateDay = (day: string): string => {
    const days: { [key: string]: string } = {
      'monday': 'Lunes',
      'tuesday': 'Martes',
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo',
    };
    return days[day.toLowerCase()] || day;
  };

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-5xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Ubicación de la Clínica
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6">
              Información de Contacto
            </h3>

            <div className="space-y-4">
              {/* Address */}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-[var(--color-neutral-dark)]">Dirección</p>
                  <p className="text-[var(--color-neutral-medium)]">{clinicInfo.address}</p>
                </div>
              </div>

              {/* Google Maps Link */}
              <div className="pt-4">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[var(--color-secondary)] hover:text-[var(--color-secondary-hover)] font-semibold"
                >
                  <ExternalLink className="w-5 h-5" />
                  Ver en Google Maps
                </a>
              </div>
            </div>
          </Card>

          {/* Office Hours */}
          <Card shadow="light" padding="lg">
            <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-[var(--color-secondary)]" />
              Horario de Atención
            </h3>

            {clinicInfo.hours ? (
              <div className="space-y-3">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                  if (!clinicInfo.hours) return null;
                  const hours = clinicInfo.hours[day as keyof typeof clinicInfo.hours];
                  if (!hours) return null;
                  return (
                    <div key={day} className="flex justify-between">
                      <span className="font-medium text-[var(--color-neutral-dark)]">
                        {translateDay(day)}
                      </span>
                      <span className="text-[var(--color-neutral-medium)]">{hours}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[var(--color-neutral-medium)]">
                Por favor llame para conocer el horario
              </p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
