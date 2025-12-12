// Quick Navigation Carousel - Jump to sections with scroll spy
'use client';
import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const sections = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'gallery', label: 'Galería' },
  { id: 'services', label: 'Servicios' },
  { id: 'conditions', label: 'Tratamientos' },
  { id: 'biography', label: 'Acerca de' },
  { id: 'location', label: 'Ubicación' },
  { id: 'education', label: 'Educación' },
  { id: 'credentials', label: 'Certificaciones' },
  { id: 'faq', label: 'Preguntas' },
];

export default function QuickNav() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('inicio');

  // Scroll spy - Track which section is visible
  useEffect(() => {
    let ticking = false;

    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + 100; // Offset for sticky nav

      // Find all section positions
      const sectionPositions = sections
        .map((section) => {
          const element = document.getElementById(section.id);
          if (element) {
            const rect = element.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            return { id: section.id, top };
          }
          return null;
        })
        .filter((item): item is { id: string; top: number } => item !== null);

      // Find the section that's currently at the scroll position
      // We want the last section whose top is before or at the scroll position
      let currentSection = sectionPositions[0]?.id || 'inicio';

      for (const section of sectionPositions) {
        if (section.top <= scrollPosition) {
          currentSection = section.id;
        } else {
          break;
        }
      }

      setActiveSection(currentSection);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveSection);
        ticking = true;
      }
    };

    // Initial check
    updateActiveSection();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Account for sticky nav
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="bg-white border-y border-[var(--color-neutral-light)] sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full shadow-md hover:bg-[var(--color-neutral-light)] transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)] focus-visible:ring-offset-2"
          aria-label="Desplazar a la izquierda"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-[var(--color-secondary)]" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-8 md:px-12"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[var(--color-secondary)] text-white'
                    : 'bg-[var(--color-neutral-light)] text-[var(--color-neutral-dark)] hover:bg-[var(--color-primary)] hover:text-[var(--color-neutral-dark)]'
                }`}
                aria-current={isActive ? 'location' : undefined}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full shadow-md hover:bg-[var(--color-neutral-light)] transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)] focus-visible:ring-offset-2"
          aria-label="Desplazar a la derecha"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-[var(--color-secondary)]" />
        </button>
      </div>
    </div>
  );
}
