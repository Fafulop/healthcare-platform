// Education Section - E-E-A-T proof
import React from 'react';
import { GraduationCap } from 'lucide-react';
import Card from '../ui/Card';
import type { Education } from '@/types/doctor';

interface EducationSectionProps {
  educationItems: Education[];
  id?: string;
}

export default function EducationSection({ educationItems, id }: EducationSectionProps) {
  if (!educationItems || educationItems.length === 0) return null;

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
      <div className="max-w-5xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Educación y Formación
        </h2>

        {/* Education List */}
        <div className="space-y-4">
          {educationItems.map((item, index) => (
            <Card key={index} shadow="light" padding="lg">
              <div className="flex gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[var(--color-secondary)] rounded-full flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Education Details */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-[var(--color-neutral-dark)] mb-1">
                    {item.program}
                  </h3>
                  <p className="text-[var(--color-secondary)] font-medium mb-1">
                    {item.institution}
                  </p>
                  <p className="text-[var(--color-neutral-medium)] text-sm mb-2">
                    {item.year}
                  </p>
                  {item.notes && (
                    <p className="text-[var(--color-neutral-dark)] text-sm">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
