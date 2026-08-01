'use client';

/**
 * Reveals al hacer scroll (GSAP + ScrollTrigger) para la home.
 *
 * CÓMO SE USA: no envuelve nada. Se monta UNA vez en la página y lee atributos
 * del markup ya renderizado en el servidor:
 *
 *   data-reveal="up" | "left" | "right"   → el elemento entra desde ahí
 *   data-reveal-stagger                   → sus hijos con data-reveal entran escalonados
 *
 * Así la página sigue siendo un Server Component y su HTML sale completo para
 * Google; esto solo anima lo que ya está ahí.
 *
 * POR QUÉ NO HAY FLASH: el estado inicial (opacity 0) lo pone la clase
 * `.reveal-ready` en <html>, que agrega el script inline de la página ANTES de
 * que pinte el contenido. Sin JS —o con "reduce motion"— la clase nunca se
 * agrega y el contenido se ve normal. Ese script además la quita sola a los
 * 2.5s por si este módulo no llega a cargar: nunca se queda una página en
 * blanco por culpa de la animación.
 */

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Estado inicial según la dirección declarada en el markup.
 *
 * `opacity: 0` se repite aquí a propósito, aunque la clase CSS ya lo pone: al
 * quedar como estilo INLINE gana sobre la clase, así el auto-borrado de
 * `.reveal-ready` a los 2.5s no destapa a medias los elementos que este módulo
 * SÍ va a animar. Ese salvavidas queda solo para el caso en que GSAP no cargue.
 */
function initialStateFor(el: HTMLElement): { x: number; y: number; opacity: number } {
  switch (el.dataset.reveal) {
    case 'left':
      return { x: -36, y: 0, opacity: 0 };
    case 'right':
      return { x: 36, y: 0, opacity: 0 };
    default:
      return { x: 0, y: 24, opacity: 0 };
  }
}

export default function ScrollReveals() {
  useEffect(() => {
    const root = document.documentElement;

    // "Reduce motion": el script inline ya no agregó la clase, pero por si el
    // usuario cambia la preferencia con la página abierta, lo dejamos limpio.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('reveal-ready');
      return;
    }

    const ctx = gsap.context(() => {
      const animated = new Set<HTMLElement>();

      // 1) Grupos escalonados — el trigger es el CONTENEDOR, así los hijos
      //    entran en secuencia aunque todos crucen el umbral a la vez.
      gsap.utils.toArray<HTMLElement>('[data-reveal-stagger]').forEach((group) => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', group);
        if (items.length === 0) return;

        items.forEach((el) => {
          animated.add(el);
          gsap.set(el, initialStateFor(el));
        });

        gsap.to(items, {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: { trigger: group, start: 'top 85%', once: true },
        });
      });

      // 2) Elementos sueltos — los que no quedaron dentro de un grupo.
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        if (animated.has(el)) return;

        gsap.set(el, initialStateFor(el));
        gsap.to(el, {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
