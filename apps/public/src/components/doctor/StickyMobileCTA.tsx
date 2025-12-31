// Sticky Mobile CTA - Bottom action bar for mobile only
'use client';
import React from 'react';
import Button from '../ui/Button';

interface StickyMobileCTAProps {
  whatsappNumber?: string | null;
  onBookingClick?: () => void;
}

export default function StickyMobileCTA({ whatsappNumber, onBookingClick }: StickyMobileCTAProps) {
  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-neutral-light)] shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-3 md:hidden">
      <div className="flex gap-2 max-w-7xl mx-auto">
        <Button variant="primary" size="md" className="flex-1 text-sm" onClick={onBookingClick}>
          Agendar Cita
        </Button>
        <Button variant="secondary" size="md" className="flex-1 text-sm" onClick={handleWhatsAppClick}>
          Enviar Mensaje
        </Button>
      </div>
    </div>
  );
}
