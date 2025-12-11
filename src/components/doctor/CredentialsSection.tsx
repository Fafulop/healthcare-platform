// Credentials & Diplomas Section - Visual proof of qualifications
'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { Credential } from '@/types/doctor';

interface CredentialsSectionProps {
  certificates: Credential[];
  id?: string;
}

export default function CredentialsSection({ certificates, id }: CredentialsSectionProps) {
  const [selectedImage, setSelectedImage] = useState<Credential | null>(null);

  if (!certificates || certificates.length === 0) return null;

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-7xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Certifications & Diplomas
        </h2>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate, index) => (
            <div
              key={index}
              className="group cursor-pointer"
              onClick={() => setSelectedImage(certificate)}
            >
              <div className="relative aspect-[4/3] rounded-[var(--radius-medium)] overflow-hidden shadow-[var(--shadow-light)] hover:shadow-[var(--shadow-medium)] transition-shadow">
                <Image
                  src={certificate.src}
                  alt={certificate.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="mt-3">
                <p className="font-semibold text-[var(--color-neutral-dark)] text-sm">
                  {certificate.issued_by}
                </p>
                <p className="text-[var(--color-neutral-medium)] text-sm">
                  {certificate.year}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white rounded"
              onClick={() => setSelectedImage(null)}
              aria-label="Close"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                fill
                className="object-contain"
                sizes="90vw"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
