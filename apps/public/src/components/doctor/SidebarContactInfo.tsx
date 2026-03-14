// Sidebar Contact Info - Compact contact details for sticky sidebar
'use client';
import React from 'react';
import { Navigation } from 'lucide-react';
import Card from '../ui/Card';
import { trackMapClick } from '@/lib/analytics';
import type { ClinicInfo, ClinicLocationItem } from '@/types/doctor';

interface SidebarContactInfoProps {
  doctorSlug?: string;
  clinicInfo: ClinicInfo;
  clinicLocations?: ClinicLocationItem[];
}

export default function SidebarContactInfo({ doctorSlug, clinicInfo, clinicLocations }: SidebarContactInfoProps) {
  const locations: ClinicLocationItem[] = (clinicLocations && clinicLocations.length > 0)
    ? clinicLocations
    : [{
        id: 'default',
        name: 'Consultorio',
        address: clinicInfo.address,
        geoLat: clinicInfo.geo.lat,
        geoLng: clinicInfo.geo.lng,
      }];

  const getMapsUrl = (loc: ClinicLocationItem) =>
    (loc.geoLat && loc.geoLng && loc.geoLat !== 0 && loc.geoLng !== 0)
      ? `https://www.google.com/maps?q=${loc.geoLat},${loc.geoLng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;

  return (
    <div className="px-4 pb-6">
      <Card shadow="none" padding="lg">
        <div className="space-y-3">
          {locations.map((loc) => (
            <a
              key={loc.id}
              href={getMapsUrl(loc)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => doctorSlug && trackMapClick(doctorSlug, 'sidebar')}
              className="flex items-start gap-4 p-4 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors bg-blue-50 border border-blue-200 block"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-[var(--color-secondary)] bg-opacity-20 rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6 text-[var(--color-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                {locations.length > 1 && (
                  <p className="text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wide mb-1">{loc.name}</p>
                )}
                <p className="text-sm text-[var(--color-neutral-medium)] mb-1 font-semibold uppercase tracking-wide">
                  {locations.length === 1 ? 'Dirección' : ''}
                </p>
                <p className="text-base font-medium text-[var(--color-neutral-dark)] leading-relaxed mb-2">
                  {loc.address}
                </p>
                <p className="text-base font-bold text-[var(--color-secondary)] flex items-center gap-1">
                  Ver en Google Maps →
                </p>
              </div>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
