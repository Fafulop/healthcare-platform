// FAQ Section - Opportunity for rich snippets
'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FAQ } from '@/types/doctor';

interface FAQSectionProps {
  faqs: FAQ[];
  id?: string;
}

export default function FAQSection({ faqs, id }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faqs || faqs.length === 0) return null;

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id={id} className="py-16 bg-[var(--color-bg-green-light)]">
      <div className="max-w-4xl mx-auto px-4">
        {/* H2 - Major section */}
        <h2 className="text-[var(--font-size-h2)] font-bold text-[var(--color-neutral-dark)] mb-8 text-center">
          Frequently Asked Questions
        </h2>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-[var(--color-neutral-light)] rounded-[var(--radius-medium)] overflow-hidden shadow-[var(--shadow-light)]"
            >
              {/* Question Button */}
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-[var(--color-neutral-light)] transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-inset"
                aria-expanded={openIndex === index}
              >
                <h3 className="text-lg font-semibold text-[var(--color-neutral-dark)] pr-4">
                  {faq.question}
                </h3>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[var(--color-secondary)] flex-shrink-0" />
                )}
              </button>

              {/* Answer */}
              {openIndex === index && (
                <div className="px-6 py-4 bg-[var(--color-neutral-light)] border-t border-[var(--color-neutral-light)]">
                  <p className="text-[var(--color-neutral-dark)] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
