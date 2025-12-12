// Conditions Treated Section - High-value SEO keywords
import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ConditionsSectionProps {
  conditions: string[];
  procedures: string[];
  id?: string;
}

export default function ConditionsSection({ conditions, procedures, id }: ConditionsSectionProps) {
  if ((!conditions || conditions.length === 0) && (!procedures || procedures.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
      <div className="max-w-7xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-10 text-center">
          Condiciones y Procedimientos
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Conditions */}
          {conditions && conditions.length > 0 && (
            <div>
              <h3 className="text-[var(--font-size-h3)] font-semibold text-[var(--color-secondary)] mb-4">
                Condiciones Tratadas
              </h3>
              <ul className="space-y-2">
                {conditions.map((condition, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                    <span className="text-[var(--color-neutral-dark)]">{condition}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Procedures */}
          {procedures && procedures.length > 0 && (
            <div>
              <h3 className="text-[var(--font-size-h3)] font-semibold text-[var(--color-secondary)] mb-4">
                Procedimientos Realizados
              </h3>
              <ul className="space-y-2">
                {procedures.map((procedure, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                    <span className="text-[var(--color-neutral-dark)]">{procedure}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
