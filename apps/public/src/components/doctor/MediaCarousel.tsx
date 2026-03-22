// Media Carousel - Client-side only component with lazy loading
'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { CarouselItem } from '@/types/doctor';

interface MediaCarouselProps {
  items: CarouselItem[];
  id?: string;
}

export default function MediaCarousel({ items, id }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!items || items.length === 0) return null;

  const stopVideo = () => {
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const goToPrevious = () => {
    stopVideo();
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? items.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    stopVideo();
    setCurrentIndex((prevIndex) =>
      prevIndex === items.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handlePlayClick = () => {
    setIsVideoPlaying(true);
    videoRef.current?.play();
  };

  const currentItem = items[currentIndex];

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Conoce al Doctor
        </h2>

        {/* Carousel Container */}
        <div className="relative bg-white rounded-[var(--radius-medium)] overflow-hidden shadow-[var(--shadow-medium)]">
          {/* Main Image/Video Area */}
          <div className="relative h-[280px] md:h-[400px] bg-black overflow-hidden">
            {currentItem.type === 'image' ? (
              <>
                {/* Blurred background fill — same image, scaled + blurred */}
                <Image
                  src={currentItem.src}
                  alt=""
                  fill
                  aria-hidden="true"
                  className="object-cover scale-110 blur-2xl opacity-50"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
                {/* Main image — full, no crop */}
                <Image
                  src={currentItem.src}
                  alt={currentItem.alt}
                  fill
                  className="object-contain"
                  loading={currentIndex === 0 ? 'eager' : 'lazy'}
                  sizes="(max-width: 768px) 100vw, 896px"
                />
              </>
            ) : (
              // Video player — single element, play via ref to avoid double-click
              <div className="relative w-full h-full bg-black">
                <video
                  key={currentItem.src}
                  ref={videoRef}
                  src={currentItem.src}
                  controls={isVideoPlaying}
                  preload="metadata"
                  poster={currentItem.thumbnail || undefined}
                  className="w-full h-full object-contain"
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  Tu navegador no soporta videos HTML5.
                </video>
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <button
                      onClick={handlePlayClick}
                      className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-[var(--color-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                      aria-label="Reproducir video"
                    >
                      <Play className="w-8 h-8 text-[var(--color-secondary)]" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="w-6 h-6 text-[var(--color-secondary)]" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
                  aria-label="Siguiente imagen"
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
                  onClick={() => { stopVideo(); setCurrentIndex(index); }}
                  className={`w-2 h-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-offset-2 ${
                    index === currentIndex
                      ? 'bg-[var(--color-primary)] w-8'
                      : 'bg-[var(--color-neutral-medium)]'
                  }`}
                  aria-label={`Ir a la diapositiva ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
