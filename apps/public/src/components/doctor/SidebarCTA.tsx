// Sidebar CTA Buttons - Action buttons for desktop sidebar
'use client';
import React from 'react';
import Button from '../ui/Button';
import { trackContactClick, trackAppointmentClick } from '@/lib/analytics';

interface SidebarCTAProps {
  doctorSlug?: string;
  onBookingClick?: () => void;
  whatsappNumber?: string;
  googleAdsId?: string;
}

export default function SidebarCTA({ doctorSlug, onBookingClick, whatsappNumber, googleAdsId }: SidebarCTAProps) {
  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      if (doctorSlug) trackContactClick(doctorSlug, 'whatsapp', 'sidebar', googleAdsId);
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  const handleBookingClick = () => {
    if (doctorSlug) trackAppointmentClick(doctorSlug, 'sidebar');
    onBookingClick?.();
  };

  return (
    <div className="flex gap-2 px-4 py-4">
      <Button
        variant="primary"
        size="md"
        className="flex-1"
        onClick={handleBookingClick}
      >
        Agendar Cita
      </Button>
      <Button
        variant="secondary"
        size="md"
        className="flex-1"
        onClick={handleWhatsAppClick}
      >
        Enviar Mensaje
      </Button>
    </div>
  );
}
