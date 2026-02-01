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
    <section className="py-16 bg-[var(--color-bg-green-light)] lg:py-0 lg:bg-transparent">
      <div className="max-w-5xl mx-auto px-4 lg:px-0">
        <h2 className="text-2xl lg:text-lg font-bold text-[var(--color-neutral-dark)] mb-6 lg:mb-3 text-center lg:text-left">
          Agenda una Cita
        </h2>

        <Card shadow="medium" padding="lg" className="lg:max-w-none lg:!p-4">
          {/* Appointment Modes */}
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6 lg:mb-3">
            {modes.includes('in_person') && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)]">
                <MapPin className="w-4 h-4 text-[var(--color-secondary)]" />
                <span className="text-sm font-medium">Presencial</span>
              </div>
            )}
            {modes.includes('teleconsult') && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)]">
                <Video className="w-4 h-4 text-[var(--color-secondary)]" />
                <span className="text-sm font-medium">Teleconsulta</span>
              </div>
            )}
          </div>

          {/* Next Available Date */}
          {nextAvailableDate && typeof nextAvailableDate === 'string' && (
            <div className="text-center lg:text-left mb-6 lg:mb-3">
              <p className="text-xs text-[var(--color-neutral-medium)] mb-1">Próxima Fecha Disponible</p>
              <p className="text-xl lg:text-base font-bold text-[var(--color-secondary)]">
                {(() => {
                  try {
                    const [y, m, d] = nextAvailableDate.split('T')[0].split('-').map(Number);
                    if (y && m && d) {
                      return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                    }
                  } catch (e) {
                    console.error('Error parsing date:', e);
                  }
                  return nextAvailableDate;
                })()}
              </p>
            </div>
          )}

          {/* Calendar Placeholder - In production, integrate with booking system */}
          <div className="bg-[var(--color-neutral-light)] rounded-[var(--radius-medium)] p-6 lg:p-3 text-center mb-6 lg:mb-3">
            <Calendar className="w-12 h-12 lg:w-8 lg:h-8 text-[var(--color-secondary)] mx-auto mb-3 lg:mb-2" />
            <p className="text-sm lg:text-xs text-[var(--color-neutral-medium)] mb-3 lg:mb-1.5">
              El calendario de citas se integrará aquí
            </p>
            <p className="text-xs text-[var(--color-neutral-medium)] lg:hidden">
              Conecta con tu sistema de reservas preferido (Calendly, Acuity, etc.)
            </p>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Button variant="primary" size="lg" className="w-full lg:!py-2 lg:text-sm">
              Agendar Cita
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
