// Media Carousel - Client-side only component with lazy loading
'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { CarouselItem } from '@/types/doctor';

interface MediaCarouselProps {
  items: CarouselItem[];
  id?: string;
}

export default function MediaCarousel({ items, id }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? items.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === items.length - 1 ? 0 : prevIndex + 1
    );
  };

  const currentItem = items[currentIndex];

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Clinic Gallery
        </h2>

        {/* Carousel Container */}
        <div className="relative bg-white rounded-[var(--radius-medium)] overflow-hidden shadow-[var(--shadow-medium)]">
          {/* Main Image/Video Area */}
          <div className="relative h-[280px] md:h-[400px] bg-[var(--color-neutral-light)]">
            {currentItem.type === 'image' ? (
              <Image
                src={currentItem.src}
                alt={currentItem.alt}
                fill
                className="object-cover"
                loading={currentIndex === 0 ? 'eager' : 'lazy'}
                sizes="(max-width: 768px) 100vw, 896px"
              />
            ) : (
              // Video thumbnail
              <div className="relative w-full h-full">
                <Image
                  src={currentItem.thumbnail || currentItem.src}
                  alt={currentItem.alt}
                  fill
                  className="object-cover"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <button
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-[var(--color-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Play video"
                  >
                    <Play className="w-8 h-8 text-[var(--color-secondary)]" />
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6 text-[var(--color-secondary)]" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6 text-[var(--color-secondary)]" />
                </button>
              </>
            )}
          </div>

          {/* Caption */}
          {currentItem.caption && (
            <div className="p-4 bg-white">
              <p className="text-center text-[var(--color-neutral-dark)]">
                {currentItem.caption}
              </p>
            </div>
          )}

          {/* Dots Navigation */}
          {items.length > 1 && (
            <div className="flex justify-center gap-2 p-4 bg-white">
              {items.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-offset-2 ${
                    index === currentIndex
                      ? 'bg-[var(--color-primary)] w-8'
                      : 'bg-[var(--color-neutral-medium)]'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
