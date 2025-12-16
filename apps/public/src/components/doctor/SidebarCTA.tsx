// Sidebar CTA Buttons - Action buttons for desktop sidebar
'use client';
import React from 'react';
import Button from '../ui/Button';

interface SidebarCTAProps {
  onBookingClick?: () => void;
  whatsappNumber?: string;
}

export default function SidebarCTA({ onBookingClick, whatsappNumber }: SidebarCTAProps) {
  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    }
  };

  return (
    <div className="flex gap-2 px-4 py-4">
      <Button
        variant="primary"
        size="md"
        className="flex-1"
        onClick={onBookingClick}
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
