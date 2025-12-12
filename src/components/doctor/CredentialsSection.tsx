// Credentials & Diplomas Section - Carousel with thumbnail grid for SEO
'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import type { Credential } from '@/types/doctor';

interface CredentialsSectionProps {
  certificates: Credential[];
  id?: string;
}

export default function CredentialsSection({ certificates, id }: CredentialsSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!certificates || certificates.length === 0) return null;

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? certificates.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === certificates.length - 1 ? 0 : prevIndex + 1
    );
  };

  const currentCertificate = certificates[currentIndex];

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-5xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Certificaciones y Diplomas
        </h2>

        {/* Main Carousel Display */}
        <div className="relative bg-white rounded-[var(--radius-medium)] overflow-hidden shadow-[var(--shadow-medium)] mb-6">
          {/* Large Certificate View */}
          <div className="relative h-[300px] md:h-[400px] bg-[var(--color-neutral-light)]">
            <Image
              src={currentCertificate.src}
              alt={currentCertificate.alt}
              fill
              className="object-contain p-4"
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              sizes="(max-width: 768px) 100vw, 896px"
            />

            {/* Navigation Arrows */}
            {certificates.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] transition-all"
                  aria-label="Certificado anterior"
                >
                  <ChevronLeft className="w-6 h-6 text-[var(--color-secondary)]" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] transition-all"
                  aria-label="Siguiente certificado"
                >
                  <ChevronRight className="w-6 h-6 text-[var(--color-secondary)]" />
                </button>
              </>
            )}

            {/* Expand to Lightbox Button */}
            <button
              onClick={() => setIsLightboxOpen(true)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] transition-all"
              aria-label="Ver pantalla completa"
            >
              <Maximize2 className="w-5 h-5 text-[var(--color-secondary)]" />
            </button>
          </div>

          {/* Certificate Information */}
          <div className="p-4 bg-white border-t border-[var(--color-neutral-light)]">
            <p className="font-semibold text-[var(--color-neutral-dark)] text-center">
              {currentCertificate.issued_by}
            </p>
            <p className="text-[var(--color-neutral-medium)] text-sm text-center">
              {currentCertificate.year}
            </p>
          </div>
        </div>

        {/* Thumbnail Grid - All certificates visible for SEO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {certificates.map((certificate, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`group relative aspect-[4/3] rounded-[var(--radius-medium)] overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] ${
                index === currentIndex
                  ? 'ring-4 ring-[var(--color-primary)] shadow-[var(--shadow-medium)]'
                  : 'shadow-[var(--shadow-light)] hover:shadow-[var(--shadow-medium)]'
              }`}
              aria-label={`Ver certificado de ${certificate.issued_by} del ${certificate.year}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            >
              {/* Thumbnail Image - All in DOM for SEO */}
              <Image
                src={certificate.src}
                alt={certificate.alt}
                fill
                className={`object-cover transition-transform duration-300 ${
                  index === currentIndex ? 'scale-105' : 'group-hover:scale-105'
                }`}
                loading={index < 4 ? 'eager' : 'lazy'}
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />

              {/* Overlay with text - SEO-friendly text content */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              } transition-opacity`}>
                <p className="text-white text-xs font-semibold line-clamp-2">
                  {certificate.issued_by}
                </p>
                <p className="text-white text-xs opacity-90">
                  {certificate.year}
                </p>
              </div>

              {/* Active indicator */}
              {index === currentIndex && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-[var(--color-primary)] rounded-full border-2 border-white" />
              )}
            </button>
          ))}
        </div>

        {/* Lightbox Modal for Full Screen View */}
        {isLightboxOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white rounded"
              onClick={() => setIsLightboxOpen(false)}
              aria-label="Cerrar vista ampliada"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative max-w-6xl max-h-[90vh] w-full h-full">
              <Image
                src={currentCertificate.src}
                alt={currentCertificate.alt}
                fill
                className="object-contain"
                sizes="90vw"
              />
            </div>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-full">
              <p className="font-semibold">{currentCertificate.issued_by}</p>
              <p className="text-sm text-center">{currentCertificate.year}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
