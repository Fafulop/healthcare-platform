// Biography Section - E-E-A-T context and supporting keywords
'use client';
import React, { useState } from 'react';
import { Award } from 'lucide-react';

interface BiographySectionProps {
  doctorLastName: string;
  shortBio: string;
  longBio?: string;
  yearsExperience: number;
  id?: string;
}

export default function BiographySection({ doctorLastName, shortBio, longBio, yearsExperience, id }: BiographySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-yellow-light)]">
      <div className="max-w-4xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-6 text-center">
          Acerca de la Dra. {doctorLastName}
        </h2>

        {/* Years of Experience Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[var(--color-secondary)] text-white px-6 py-3 rounded-[var(--radius-medium)]">
            <Award className="w-6 h-6" />
            <span className="text-lg font-semibold">{yearsExperience}+ Años de Experiencia</span>
          </div>
        </div>

        {/* Biography Content */}
        <div className="prose prose-lg max-w-none">
          <p className="text-[var(--color-neutral-dark)] leading-relaxed mb-4">
            {shortBio}
          </p>

          {/* Long Bio with Read More */}
          {longBio && (
            <>
              {isExpanded && (
                <p className="text-[var(--color-neutral-dark)] leading-relaxed mb-4">
                  {longBio}
                </p>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[var(--color-secondary)] hover:text-[var(--color-secondary-hover)] font-semibold underline focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-offset-2 rounded"
              >
                {isExpanded ? 'Ver Menos' : 'Ver Más'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
