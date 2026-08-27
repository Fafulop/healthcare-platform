/**
 * Las NOTAS de una cita — lo que el doctor escribió al agendarla.
 *
 * Vive en un solo lugar porque se pinta en CINCO superficies (modal del dashboard ·
 * modal de /appointments · lista del expediente · fila desplegada de la tabla de citas,
 * en su versión de teléfono y en la de escritorio). Cinco copias del mismo bloque se
 * separan en silencio: basta que alguien arregle el recorte en una y no en las otras.
 *
 * Dos decisiones que NO son cosméticas y por eso viven aquí y no en cada llamada:
 *
 * 1. **`trim()` antes de decidir si se pinta.** En prod hay 29 citas con `notes = ""`
 *    (frente a 107 con texto real). Una sección "Notas" vacía no se lee como "no hay
 *    notas": se lee como que algo falló al cargar.
 * 2. **`whitespace-pre-wrap`.** Las notas traen saltos de línea de verdad
 *    ("Seguimiento Wegovy\n"), y colapsarlos junta renglones que el doctor separó.
 *
 * ⚠️ El texto puede venir del PACIENTE: `notes` llega en el body del POST de citas, que
 * también sirve al widget público. Se rinde como nodo de texto de React (que escapa) y
 * **nunca** con `dangerouslySetInnerHTML`.
 */

import { StickyNote } from 'lucide-react';

interface Props {
  notes: string | null | undefined;
  /** `true` pinta el encabezado 📝 "Notas de la cita". Úsalo donde no haya ya un rótulo. */
  conEtiqueta?: boolean;
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

export function NotasCita({ notes, conEtiqueta = true, className = '' }: Props) {
  const texto = notes?.trim();
  if (!tieneNotas(notes)) return null;

  return (
    <div className={className}>
      {conEtiqueta && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
          <StickyNote className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
          Notas de la cita
        </div>
      )}
      <p className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
        {texto}
      </p>
    </div>
  );
}
