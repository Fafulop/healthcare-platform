// Sidebar Contact Info - Compact contact details for sticky sidebar
import React from 'react';
import { MessageCircle, Navigation } from 'lucide-react';
import Card from '../ui/Card';
import type { ClinicInfo } from '@/types/doctor';

interface SidebarContactInfoProps {
  clinicInfo: ClinicInfo;
}

export default function SidebarContactInfo({ clinicInfo }: SidebarContactInfoProps) {
  // Generate Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps?q=${clinicInfo.geo.lat},${clinicInfo.geo.lng}`;

  return (
    <div className="px-4 pb-4">
      <Card shadow="none" padding="sm">
        <div className="space-y-1.5">
          {/* Address with Google Maps - Clickable */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors"
          >
            <div className="flex-shrink-0 w-7 h-7 bg-[var(--color-secondary)] bg-opacity-10 rounded-full flex items-center justify-center">
              <Navigation className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--color-neutral-medium)] mb-0.5">Dirección</p>
              <p className="text-xs font-medium text-[var(--color-neutral-dark)] leading-tight mb-0.5">
                {clinicInfo.address}
              </p>
              <p className="text-xs font-semibold text-[var(--color-secondary)]">
                Ver en Google Maps →
              </p>
            </div>
          </a>

          {/* WhatsApp - Clickable */}
          {clinicInfo.whatsapp && (
            <a
              href={`https://wa.me/${clinicInfo.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-neutral-light)] transition-colors"
            >
              <div className="flex-shrink-0 w-7 h-7 bg-[var(--color-secondary)] bg-opacity-10 rounded-full flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--color-neutral-medium)]">WhatsApp</p>
                <p className="text-xs font-semibold text-[var(--color-secondary)]">
                  Envía mensaje al doctor
                </p>
              </div>
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}
