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
    <div className="px-4 pb-6">
      <Card shadow="none" padding="lg">
        {/* Address with Google Maps - Clickable - Bigger */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100"
        >
          <div className="flex-shrink-0 w-12 h-12 bg-[var(--color-secondary)] bg-opacity-20 rounded-full flex items-center justify-center">
            <Navigation className="w-6 h-6 text-[var(--color-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--color-neutral-medium)] mb-2 font-semibold uppercase tracking-wide">Dirección</p>
            <p className="text-base font-medium text-[var(--color-neutral-dark)] leading-relaxed mb-3">
              {clinicInfo.address}
            </p>
            <p className="text-base font-bold text-[var(--color-secondary)] flex items-center gap-1">
              Ver en Google Maps →
            </p>
          </div>
        </a>
      </Card>
    </div>
  );
}
