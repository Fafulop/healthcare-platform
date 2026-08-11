"use client";

/**
 * El menú "Más" de la barra de Citas.
 *
 * 🔴 Por qué existe: la barra llegó a NUEVE botones y cuatro de ellos casi no se
 * aprietan. Los tres de rangos perdieron su razón de ser cuando se pudo agendar
 * SIN rango (se escribe la hora), y el enlace de reseña se usa de vez en cuando.
 * Se esconden aquí en vez de borrarse: "Bloquear" sigue haciendo falta estando
 * en las citas, así que sacarlos a otra pantalla habría costado un viaje.
 *
 * El patrón (respaldo transparente que cierra + panel absoluto) es el mismo que
 * el menú de `TemplateCard`, para no inventar un tercer estilo de dropdown.
 */

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus, Ban, Trash2, Star } from "lucide-react";

interface Props {
  onCrearRango: () => void;
  onBloquear: () => void;
  onEliminarRangos: () => void;
  onEnlaceResena: () => void;
}

export function MenuMasAcciones({
  onCrearRango,
  onBloquear,
  onEliminarRangos,
  onEnlaceResena,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Escape cierra. El clic fuera lo atiende el respaldo de abajo; el teclado no
  // tiene respaldo que apretar.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // Elegir una acción cierra el menú: abre su modal y este panel estorbaría.
  const elegir = (accion: () => void) => () => {
    setAbierto(false);
    accion();
  };

  const opcion =
    "w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left";

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-2 px-3 sm:px-4 rounded-md transition-colors text-sm"
      >
        <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
        <span>Más</span>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          {/* 🔴 `left-0` abajo de `sm`: la barra es `grid-cols-2` en el teléfono y
              "Más" cae en la columna IZQUIERDA, así que un panel de 224px anclado a
              la derecha se salía por el borde de la pantalla (en 375px arrancaba en
              x≈-41 y quedaba cortado). De `sm` para arriba la barra es una fila y el
              anclaje correcto vuelve a ser el derecho. */}
          <div
            role="menu"
            className="absolute left-0 sm:left-auto sm:right-0 top-11 z-20 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-1"
          >
            <p className="px-4 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Disponibilidad
            </p>
            <button type="button" role="menuitem" onClick={elegir(onCrearRango)} className={opcion}>
              <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Crear Rango
            </button>
            <button type="button" role="menuitem" onClick={elegir(onBloquear)} className={opcion}>
              <Ban className="w-4 h-4 text-orange-600 flex-shrink-0" />
              Bloquear horario
            </button>
            <button type="button" role="menuitem" onClick={elegir(onEliminarRangos)} className={opcion}>
              <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0" />
              Eliminar Rangos
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button type="button" role="menuitem" onClick={elegir(onEnlaceResena)} className={opcion}>
              <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              Enlace Reseña
            </button>
          </div>
        </>
      )}
    </div>
  );
}
