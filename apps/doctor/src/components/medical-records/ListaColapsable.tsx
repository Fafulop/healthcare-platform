'use client';

import { Children, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  /** Los elementos YA ordenados (los más nuevos primero) y con su `key`. */
  children: ReactNode;
  /** Cuántos se ven cerrada. */
  visibles?: number;
  /** Clases del contenedor de la lista (`space-y-2`, …). */
  className?: string;
}

/**
 * Las listas de las tarjetas del expediente (visitas, formularios, notas, citas): enseña los
 * `visibles` primeros y el resto se abre con un botón. Con `visibles` o menos no pinta botón.
 * No ordena nada: quien la usa manda la lista ya ordenada.
 */
export function ListaColapsable({ children, visibles = 3, className = 'space-y-2' }: Props) {
  const [abierta, setAbierta] = useState(false);
  const items = Children.toArray(children);
  const ocultos = items.length - visibles;

  return (
    <div>
      <div className={className}>{abierta || ocultos <= 0 ? items : items.slice(0, visibles)}</div>
      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
        >
          {abierta ? (
            <>Ver menos <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Ver {ocultos} más <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}
