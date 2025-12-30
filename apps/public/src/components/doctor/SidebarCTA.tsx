// Sidebar CTA Buttons - Action buttons for desktop sidebar
'use client';
import React from 'react';
import Button from '../ui/Button';

interface SidebarCTAProps {
  onBookingClick?: () => void;
}

export default function SidebarCTA({ onBookingClick }: SidebarCTAProps) {
  return (
    <div className="px-4 py-4">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onBookingClick}
      >
        Agendar Cita
      </Button>
    </div>
  );
}
