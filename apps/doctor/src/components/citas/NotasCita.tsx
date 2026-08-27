'use client';

/**
 * Las NOTAS de una cita — lo que el doctor escribió al agendarla.
 *
 * Vive en un solo lugar porque se pinta en CINCO superficies (modal del dashboard ·
 * modal de /appointments · lista del expediente · fila desplegada de la tabla de citas,
 * en su versión de teléfono y en la de escritorio). Cinco copias del mismo bloque se
 * separan en silencio: basta que alguien arregle el recorte en una y no en las otras.
 *
 * Tres decisiones que NO son cosméticas y por eso viven aquí y no en cada llamada:
 *
 * 1. **`trim()` antes de decidir si se pinta.** En prod hay 29 citas con `notes = ""`
 *    (frente a 107 con texto real). Una sección "Notas" vacía no se lee como "no hay
 *    notas": se lee como que algo falló al cargar.
 * 2. **`whitespace-pre-wrap`.** Las notas traen saltos de línea de verdad
 *    ("Seguimiento Wegovy\n"), y colapsarlos junta renglones que el doctor separó.
 * 3. **En las LISTAS se recorta a 3 renglones** (`recortable`). Una nota larga estiraba
 *    la tarjeta y empujaba las acciones fuera de vista: hoy el promedio es de 25 chars,
 *    pero el campo admite **2000** y ya hay una de 250. En los MODALES no se recorta —
 *    ahí es donde uno va a LEER, y además tienen scroll propio.
 *
 * ⚠️ El texto puede venir del PACIENTE: `notes` llega en el body del POST de citas, que
 * también sirve al widget público. Se rinde como nodo de texto de React (que escapa) y
 * **nunca** con `dangerouslySetInnerHTML`.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';

interface Props {
  notes: string | null | undefined;
  /** `true` pinta el encabezado 📝 "Notas de la cita". Úsalo donde no haya ya un rótulo. */
  conEtiqueta?: boolean;
  /**
   * Recorta a 3 renglones con "ver más". Default `true` — pensado para LISTAS, donde una
   * nota larga deforma la fila. Ponlo en `false` en un modal o cualquier vista de detalle.
   */
  recortable?: boolean;
  className?: string;
}

/**
 * ¿Esta cita tiene notas que valga la pena enseñar? Se exporta para que quien necesite
 * decidir ALGO MÁS (pintar un rótulo, un encabezado de sección) use la MISMA regla y no
 * una copia: si mañana "—" también cuenta como vacío, se cambia en un solo lugar.
 */
export function tieneNotas(notes: string | null | undefined): boolean {
  return Boolean(notes?.trim());
}

export function NotasCita({
  notes,
  conEtiqueta = true,
  recortable = true,
  className = '',
}: Props) {
  const [expandido, setExpandido] = useState(false);
  /** ¿El texto REALMENTE no cabe en 3 renglones? Se mide, no se adivina por longitud:
   *  el ancho disponible cambia entre la tarjeta del teléfono y la fila del escritorio,
   *  y un umbral de caracteres acertaría en una vista y fallaría en la otra. */
  const [seCorta, setSeCorta] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  const texto = notes?.trim();

  useLayoutEffect(() => {
    // Al expandir, el elemento ya no se corta por definición; volver a medir apagaría
    // `seCorta` y el botón "ver menos" desaparecería, dejando la nota abierta sin salida.
    if (!recortable || expandido) return;
    const el = ref.current;
    if (!el) return;
    const medir = () => setSeCorta(el.scrollHeight > el.clientHeight + 1);
    medir();
    // El ancho cambia al rotar el teléfono o al cruzar el breakpoint `sm`, donde esta
    // sección cambia de tarjetas a tabla — y con él, cuántos renglones ocupa la nota.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [texto, recortable, expandido]);

  if (!tieneNotas(notes)) return null;

  const recortar = recortable && !expandido;

  return (
    <div className={className}>
      {conEtiqueta && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
          <StickyNote className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
          Notas de la cita
        </div>
      )}
      <p
        ref={ref}
        className={`text-xs text-gray-700 whitespace-pre-wrap break-words bg-amber-50 border border-amber-100 rounded px-2 py-1.5 ${
          recortar ? 'line-clamp-3' : ''
        }`}
      >
        {texto}
      </p>
      {recortable && seCorta && (
        /* stopPropagation: en la tarjeta del teléfono la superficie entera es el toggle
           de expandir/colapsar la cita — sin esto, leer la nota cierra la tarjeta. */
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpandido((v) => !v);
          }}
          className="mt-0.5 text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline"
        >
          {expandido ? 'ver menos' : 'ver más'}
        </button>
      )}
    </div>
  );
}
