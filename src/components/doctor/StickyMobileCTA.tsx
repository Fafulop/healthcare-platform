// Sticky Mobile CTA - Bottom action bar for mobile only
'use client';
import React from 'react';
import Button from '../ui/Button';

export default function StickyMobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-neutral-light)] shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-3 md:hidden">
      <div className="flex gap-2 max-w-7xl mx-auto">
        <Button variant="primary" size="md" className="flex-1 text-sm">
          Book Appointment
        </Button>
        <Button variant="secondary" size="md" className="flex-1 text-sm">
          Manda mensaje al doctor
        </Button>
      </div>
    </div>
  );
}
