// Client Component wrapper for dynamic imports
'use client';

import dynamic from 'next/dynamic';
import type { CarouselItem } from '@/types/doctor';

// Booking Widget - Real appointment booking system
export const DynamicBookingWidget = dynamic(
  () => import('./BookingWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white" style={{ minHeight: '380px' }}>
        <div className="bg-gray-200 px-2 py-3 rounded-t">
          <div className="h-5 bg-gray-300 rounded w-2/3"></div>
        </div>
        <div className="px-2 py-2 animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded"></div>
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
