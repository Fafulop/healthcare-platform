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
        <p className="text-[var(--color-neutral-medium)]">Loading calendar...</p>
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
        <p className="text-[var(--color-neutral-medium)]">Loading gallery...</p>
      </div>
    ),
  }
);

export const DynamicMediaCarousel = ({ items, id }: { items: CarouselItem[]; id?: string }) => {
  return <MediaCarouselBase items={items} id={id} />;
};
