// Client Component wrapper for dynamic imports
'use client';

import dynamic from 'next/dynamic';
import type { CarouselItem } from '@/types/doctor';

// Dynamically import client-side components (no SSR)
export const DynamicAppointmentCalendar = dynamic(
  () => import('./AppointmentCalendar'),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 text-center">
        <p className="text-[var(--color-neutral-medium)]">Cargando calendario...</p>
      </div>
    ),
  }
);

// Booking Widget - Real appointment booking system
export const DynamicBookingWidget = dynamic(
  () => import('./BookingWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    ),
  }
);

// Create a wrapper component for MediaCarousel that accepts id prop
const MediaCarouselBase = dynamic(
  () => import('./MediaCarousel'),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 text-center">
        <p className="text-[var(--color-neutral-medium)]">Cargando galería...</p>
      </div>
    ),
  }
);

export const DynamicMediaCarousel = ({ items, id }: { items: CarouselItem[]; id?: string }) => {
  return <MediaCarouselBase items={items} id={id} />;
};
