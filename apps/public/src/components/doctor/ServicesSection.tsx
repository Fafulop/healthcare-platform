// Services & Pricing Section - Primary conversion & keyword section
'use client';

import React, { useState } from 'react';
import { Clock, DollarSign, X } from 'lucide-react';
import Card from '../ui/Card';
import BlobDecoration from '../ui/BlobDecoration';
import type { Service } from '@/types/doctor';
import { toTitleCase } from '@/lib/text';

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ServicesSectionProps {
  services: Service[];
  specialty?: string;
  id?: string;
}

export default function ServicesSection({ services, specialty, id }: ServicesSectionProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  if (!services || services.length === 0) return null;

  const openModal = (service: Service) => {
    // Modal is mobile-only; ignore clicks on md+ screens
    if (window.innerWidth >= 768) return;
    setSelectedService(service);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedService(null);
    document.body.style.overflow = '';
  };

  return (
    <>
      <section id={id} className="relative overflow-hidden py-16 bg-[var(--color-bg-yellow-light)]">
        <BlobDecoration variant="blob4" color="gradient-primary" position="top-left" size="lg" opacity={30} blur={false} />
        <BlobDecoration variant="blob2" color="gradient-secondary" position="bottom-right" size="lg" opacity={28} blur={false} />
        <div className="relative max-w-7xl mx-auto px-4">
          {/* H2 - Major section */}
          <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
            {specialty ? `Servicios de ${toTitleCase(specialty)}` : 'Servicios'}
          </h2>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card
                key={index}
                shadow="light"
                padding="lg"
                className="border-t-4 border-t-[var(--color-accent)] border border-black hover:shadow-[var(--shadow-medium)] transition-shadow md:cursor-default cursor-pointer flex flex-col"
                onClick={() => openModal(service)}
              >
                {/* H3 - Service name */}
                <h3 className="text-[var(--font-size-h3)] font-semibold text-[var(--color-neutral-dark)] mb-3">
                  {service.service_name}
                </h3>

                {/* Description: truncated on mobile, full on desktop */}
                <p className="text-[var(--color-neutral-medium)] mb-3 text-[var(--font-size-body)] whitespace-pre-line line-clamp-2 md:line-clamp-none flex-1">
                  {service.short_description}
                </p>

                {/* Mobile: "Ver más" opens modal for full details */}
                <div className="md:hidden">
                  <button className="text-[var(--color-secondary)] font-medium text-sm mb-3 hover:underline">
                    Ver más
                  </button>
                </div>

                {/* Service Details */}
                <div className="space-y-2 mt-auto">
                  {/* Duration - Desktop only */}
                  {!!service.duration_minutes && (
                  <div className="hidden md:flex items-center gap-2 text-sm text-[var(--color-neutral-medium)]">
                    <Clock className="w-4 h-4" />
                    <span>{service.duration_minutes} minutos</span>
                  </div>
                  )}

                  {/* Price */}
                  {service.price !== undefined && (
                    <div className="flex items-center gap-2 text-lg font-bold text-[var(--color-secondary)]">
                      <DollarSign className="w-5 h-5" />
                      <span>${formatPrice(service.price)}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Service Detail Modal - Mobile only */}
      {selectedService && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
              <h3 className="text-xl font-bold text-[var(--color-neutral-dark)] pr-8">
                {selectedService.service_name}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6 space-y-4">
              {/* Description */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Descripción</h4>
                <p className="text-gray-600 whitespace-pre-line leading-relaxed">
                  {selectedService.short_description}
                </p>
              </div>

              {/* Details */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-gray-700 mb-3">Detalles</h4>

                {/* Duration */}
                {!!selectedService.duration_minutes && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[var(--color-secondary)]" />
                  <div>
                    <p className="text-sm text-gray-500">Duración</p>
                    <p className="font-medium text-gray-900">{selectedService.duration_minutes} minutos</p>
                  </div>
                </div>
                )}

                {/* Price */}
                {selectedService.price !== undefined && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-[var(--color-secondary)]" />
                    <div>
                      <p className="text-sm text-gray-500">Precio</p>
                      <p className="text-2xl font-bold text-[var(--color-secondary)]">${formatPrice(selectedService.price)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={closeModal}
                className="w-full mt-6 bg-[var(--color-primary)] text-[var(--color-neutral-dark)] font-semibold py-3 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
