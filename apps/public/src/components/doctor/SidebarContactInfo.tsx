// Sidebar Contact Info - Compact contact details for sticky sidebar
import React from 'react';
import { Navigation } from 'lucide-react';
import Card from '../ui/Card';
import type { ClinicInfo } from '@/types/doctor';

interface SidebarContactInfoProps {
  clinicInfo: ClinicInfo;
}

export default function SidebarContactInfo({ clinicInfo }: SidebarContactInfoProps) {
  // Generate Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps?q=${clinicInfo.geo.lat},${clinicInfo.geo.lng}`;

  return (
    <div className="px-4 pb-4 mt-8">
      <Card shadow="none" padding="md">
        {/* Address with Google Maps - Clickable */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-[var(--color-secondary)] bg-opacity-20 rounded-full flex items-center justify-center">
            <Navigation className="w-5 h-5 text-[var(--color-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--color-neutral-medium)] mb-1 font-semibold uppercase tracking-wide">Dirección</p>
            <p className="text-sm font-medium text-[var(--color-neutral-dark)] leading-relaxed mb-2">
              {clinicInfo.address}
            </p>
            <p className="text-sm font-bold text-[var(--color-secondary)] flex items-center gap-1">
              Ver en Google Maps →
            </p>
          </div>
        </a>
      </Card>
    </div>
  );
}
