// Services & Pricing Section - Primary conversion & keyword section
'use client';

import React, { useState } from 'react';
import { Clock, DollarSign, X } from 'lucide-react';
import Card from '../ui/Card';
import type { Service } from '@/types/doctor';

interface ServicesSectionProps {
  services: Service[];
  id?: string;
}

export default function ServicesSection({ services, id }: ServicesSectionProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  if (!services || services.length === 0) return null;

  const openModal = (service: Service) => {
    setSelectedService(service);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedService(null);
    document.body.style.overflow = 'unset';
  };

  return (
    <>
      <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
        <div className="max-w-7xl mx-auto px-4">
          {/* H2 - Major section */}
          <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
            Servicios
          </h2>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card
                key={index}
                shadow="light"
                padding="lg"
                className="border-t-4 border-[var(--color-accent)] hover:shadow-[var(--shadow-medium)] transition-shadow md:cursor-default cursor-pointer"
                onClick={() => openModal(service)}
              >
                {/* H3 - Service name */}
                <h3 className="text-[var(--font-size-h3)] font-semibold text-[var(--color-neutral-dark)] mb-3">
                  {service.service_name}
                </h3>

                {/* Mobile: Condensed view with "Ver más" */}
                <div className="md:hidden">
                  <button className="text-[var(--color-secondary)] font-medium text-sm mb-3 hover:underline">
                    Ver más
                  </button>
                </div>

                {/* Desktop: Full description */}
                <p className="hidden md:block text-[var(--color-neutral-medium)] mb-4 text-[var(--font-size-body)] whitespace-pre-line">
                  {service.short_description}
                </p>

                {/* Service Details */}
                <div className="space-y-2">
                  {/* Duration - Desktop only */}
                  <div className="hidden md:flex items-center gap-2 text-sm text-[var(--color-neutral-medium)]">
                    <Clock className="w-4 h-4" />
                    <span>{service.duration_minutes} minutos</span>
                  </div>

                  {/* Price */}
                  {service.price !== undefined && (
                    <div className="flex items-center gap-2 text-lg font-bold text-[var(--color-secondary)]">
                      <DollarSign className="w-5 h-5" />
                      <span>${service.price}</span>
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
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
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
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[var(--color-secondary)]" />
                  <div>
                    <p className="text-sm text-gray-500">Duración</p>
                    <p className="font-medium text-gray-900">{selectedService.duration_minutes} minutos</p>
                  </div>
                </div>

                {/* Price */}
                {selectedService.price !== undefined && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-[var(--color-secondary)]" />
                    <div>
                      <p className="text-sm text-gray-500">Precio</p>
                      <p className="text-2xl font-bold text-[var(--color-secondary)]">${selectedService.price}</p>
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
