// Appointment Calendar - Client-side only component
'use client';
import React from 'react';
import { Calendar, Video, MapPin } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface AppointmentCalendarProps {
  nextAvailableDate?: string;
  modes: ('in_person' | 'teleconsult')[];
}

export default function AppointmentCalendar({ nextAvailableDate, modes }: AppointmentCalendarProps) {
  return (
    <section className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-5xl mx-auto px-4 lg:px-0">
        <h2 className="text-2xl lg:text-xl font-bold text-[var(--color-neutral-dark)] mb-6 text-center lg:text-left">
          Agenda una Cita
        </h2>

        <Card shadow="medium" padding="lg" className="lg:max-w-none">
          {/* Appointment Modes */}
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-6">
            {modes.includes('in_person') && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)]">
                <MapPin className="w-5 h-5 text-[var(--color-secondary)]" />
                <span className="font-medium">Presencial</span>
              </div>
            )}
            {modes.includes('teleconsult') && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)]">
                <Video className="w-5 h-5 text-[var(--color-secondary)]" />
                <span className="font-medium">Teleconsulta</span>
              </div>
            )}
          </div>

          {/* Next Available Date */}
          {nextAvailableDate && (
            <div className="text-center mb-6">
              <p className="text-[var(--color-neutral-medium)] mb-2">Próxima Fecha Disponible</p>
              <p className="text-2xl font-bold text-[var(--color-secondary)]">
                {new Date(nextAvailableDate).toLocaleDateString('es-MX', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}

          {/* Calendar Placeholder - In production, integrate with booking system */}
          <div className="bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)] p-6 lg:p-4 text-center mb-6">
            <Calendar className="w-12 h-12 lg:w-10 lg:h-10 text-[var(--color-secondary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-neutral-medium)] mb-3">
              El calendario de citas se integrará aquí
            </p>
            <p className="text-xs text-[var(--color-neutral-medium)]">
              Conecta con tu sistema de reservas preferido (Calendly, Acuity, etc.)
            </p>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Button variant="primary" size="lg" className="w-full">
              Agendar Cita
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
