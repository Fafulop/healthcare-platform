'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Carrusel de navegación pegado arriba: en una página de recorrido + 9 bandas
 * + precio + FAQ, es la única forma de moverse sin scrollear a ciegas.
 *
 * POR QUÉ CARRUSEL Y NO UNA BARRA NORMAL: son 12 destinos y una de las
 * etiquetas es "Administración fiscal". En un teléfono no caben; si se dejan
 * envolver, la barra crece a tres renglones y se come la pantalla. Aquí el
 * contenedor scrollea en horizontal y la pastilla activa se trae sola al
 * centro, así que el destino actual SIEMPRE está a la vista.
 *
 * SIN JS SIGUE SIRVIENDO: esto se renderiza también en el servidor, así que
 * los `<a href="#…">` están en el HTML y funcionan igual. Lo único que se
 * pierde sin JS es el resaltado del activo.
 *
 * NO reintroduce el corte de fondo que se quitó el 2026-08-01: la barra es
 * translúcida con `backdrop-blur`, el campo se sigue viendo a través.
 */

export interface NavItem {
  id: string;
  label: string;
}

export default function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /* ── Qué sección estoy viendo ─────────────────────────────────────────
     `rootMargin` recorta la ventana a una franja justo debajo de la barra
     (-88px arriba, -65% abajo). La sección "actual" es la que cruza esa
     franja — no la más visible, que con bandas de alturas muy distintas
     haría parpadear el activo entre dos vecinas. */
  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-88px 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  /* ── Traer la pastilla activa al centro ────────────────────────────────
     Sin esto el carrusel es inútil justo cuando más se necesita: vas por
     "Reportes" (la última) y la barra sigue mostrando "Agenda". */
  useEffect(() => {
    const rail = railRef.current;
    if (!active || !rail) return;

    const pill = rail.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    if (!pill) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    rail.scrollTo({
      left: pill.offsetLeft - rail.clientWidth / 2 + pill.clientWidth / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label="Secciones de la página"
      className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-md"
    >
      <div
        ref={railRef}
        /* Sin `scroll-smooth`: si el CSS fija scroll-behavior, el
           `behavior:'auto'` del efecto de arriba deja de valer y la barra
           seguiría animándose con "reduce motion" activo. Lo decide el JS. */
        className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          /* Desvanece los bordes para avisar de que hay más a los lados. Es
             la única pista de que la barra scrollea: una barra de scroll
             visible aquí se vería como un defecto. */
          maskImage:
            'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
        }}
      >
        {items.map((item) => {
          const isActive = active === item.id;

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              data-nav-id={item.id}
              aria-current={isActive ? 'true' : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[var(--velvet-indigo)] text-white'
                  : 'text-[var(--color-neutral-medium)] hover:bg-[var(--velvet-indigo)]/10 hover:text-[var(--velvet-indigo)]'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
