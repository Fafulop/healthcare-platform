'use client';

/**
 * El clip de una capacidad: unos segundos del panel real, en silencio y en
 * bucle, al pie de la prosa que acaba de describirlos.
 *
 * NO ES UN VIDEO, ES UNA CAPTURA QUE SE MUEVE. De ahí sale todo lo demás:
 * sin audio, sin controles, sin barra de progreso y sin botón de pantalla
 * completa. Nadie viene a esta página a VER un video; viene a comprobar que la
 * pantalla existe.
 *
 * Las tres decisiones que no son de gusto:
 *
 * 1. `muted` NO es una preferencia. Es la única forma de que Chrome deje
 *    arrancar un video solo. Si alguien le quita el atributo, el clip deja de
 *    reproducirse —en silencio, valga— y la banda se queda con un póster fijo.
 *    `playsInline` es su gemelo en iOS: sin él, Safari se lleva el clip a
 *    pantalla completa en cuanto arranca.
 *
 * 2. `preload="none"` + póster. Son siete bandas: si los clips se precargaran,
 *    la home costaría varios MB antes de que nadie baje. Así, quien nunca llega
 *    a `reportes` no descarga un solo byte suyo; lo único que pesa de entrada
 *    es un póster de unos 30 KB, que además es lo que se ve mientras el mp4
 *    viaja.
 *
 * 3. `width`/`height` reales en el markup. Sin eso la caja mide 0 hasta que
 *    llegan los metadatos y la banda entera pega un salto —justo cuando el
 *    lector va a la mitad del párrafo—.
 *
 * Y la regla de la casa: con `prefers-reduced-motion: reduce` esto NO arranca
 * solo. Se queda en el póster con sus controles, y quien quiera verlo lo pide.
 * Los reveals de la página ya respetan esa preferencia (ver `ScrollReveals`);
 * un clip que se mueve solo la rompería mucho más que una entrada animada.
 */

import { useEffect, useRef, useState } from 'react';
import type { CapabilityClip as Clip } from '@/lib/product-content';

export default function CapabilityClip({ clip }: { clip: Clip }) {
  const ref = useRef<HTMLVideoElement>(null);
  /**
   * Se enciende cuando el navegador NO nos deja reproducir solos: o porque el
   * usuario pidió menos movimiento, o porque `play()` fue rechazado. En los dos
   * casos el clip pasa a tener controles, que es la diferencia entre «no se
   * mueve» y «no se puede ver».
   */
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setManual(true);
      return;
    }

    /* Reproducir SÓLO mientras está en pantalla. Un clip en bucle fuera de
       cuadro sigue decodificando cuadros: siete de ellos son un ventilador
       encendido y una batería que baja por una página que el lector ya pasó. */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => setManual(true));
        } else {
          el.pause();
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure data-reveal="up" className="mt-8">
      <video
        ref={ref}
        /* `poster` es lo que se ve ANTES de que exista un solo byte de video, y
           lo único que se ve si el clip no puede reproducirse. Tiene que ser un
           cuadro que ya cuente algo, no el primero que salga. */
        poster={`/clips/${clip.base}.webp`}
        width={clip.width}
        height={clip.height}
        muted
        loop
        playsInline
        preload="none"
        controls={manual}
        aria-label={clip.alt}
        className="w-full rounded-[var(--radius-medium)] border border-gray-200 bg-white shadow-[var(--shadow-medium)]"
      >
        {/* webm primero: si el navegador lo entiende, pesa bastante menos que
            el mp4. El mp4 es el que garantiza que se vea en todas partes. */}
        <source src={`/clips/${clip.base}.webm`} type="video/webm" />
        <source src={`/clips/${clip.base}.mp4`} type="video/mp4" />
      </video>
    </figure>
  );
}
