// Services & Pricing Section - Primary conversion & keyword section
import React from 'react';
import { Clock, DollarSign } from 'lucide-react';
import Card from '../ui/Card';
import type { Service } from '@/types/doctor';

interface ServicesSectionProps {
  services: Service[];
  id?: string;
}

export default function ServicesSection({ services, id }: ServicesSectionProps) {
  if (!services || services.length === 0) return null;

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-7xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Servicios
        </h2>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card key={index} shadow="light" padding="lg" className="border-t-4 border-[var(--color-accent)] hover:shadow-[var(--shadow-medium)] transition-shadow">
              {/* H3 - Service name */}
              <h3 className="text-[var(--font-size-h3)] font-semibold text-[var(--color-neutral-dark)] mb-3">
                {service.service_name}
              </h3>

              {/* Description */}
              <p className="text-[var(--color-neutral-medium)] mb-4 text-[var(--font-size-body)]">
                {service.short_description}
              </p>

              {/* Service Details */}
              <div className="space-y-2">
                {/* Duration */}
                <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-medium)]">
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
  );
}
