// Sidebar Contact Info - Compact contact details for sticky sidebar
'use client';
import React from 'react';
import { Navigation } from 'lucide-react';
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
    <div className="h-full px-4 py-4">
      <div className="space-y-1">
        {locations.map((loc) => (
          <a
            key={loc.id}
            href={getMapsUrl(loc)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => doctorSlug && trackMapClick(doctorSlug, 'sidebar')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors bg-blue-50 border border-blue-200"
          >
            <Navigation className="w-4 h-4 text-[var(--color-secondary)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wide leading-tight">{loc.name}</p>
              <p className="text-xs text-[var(--color-neutral-dark)] truncate">{loc.address}</p>
            </div>
            <span className="text-xs font-semibold text-[var(--color-secondary)] flex-shrink-0">Maps →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
