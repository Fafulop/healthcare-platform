'use client';

import { etiquetaVisita, type VisitaResumen } from '@/lib/visitas-ui';
import type { EstadoCarga } from './useVisitasDelPaciente';

interface Props {
  visitas: VisitaResumen[];
  estado: EstadoCarga;
  value: string;
  onChange: (visitaId: string) => void;
  disabled?: boolean;
  /** `true` = una línea compacta (encabezado del editor de notas); `false` = campo de formulario. */
  compacto?: boolean;
}

/**
 * VISITAS D5 — el selector «¿A qué visita pertenece?». '' = «Ninguna» (queda «Sin visita»).
 * Si la carga falla se DICE: un selector vacío se leería como "este paciente no tiene visitas".
 */
export function SelectorDeVisita({ visitas, estado, value, onChange, disabled, compacto }: Props) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || estado !== 'ok'}
      aria-label="¿A qué visita pertenece?"
      className={compacto
        ? 'text-xs px-1.5 py-1 border border-gray-200 rounded text-gray-700 max-w-[14rem] disabled:bg-gray-50'
        : 'w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500'}
    >
      <option value="">{estado === 'cargando' ? 'Cargando visitas…' : 'Ninguna (sin visita)'}</option>
      {visitas.map((v) => (
        <option key={v.id} value={v.id}>{etiquetaVisita(v)}</option>
      ))}
    </select>
  );
  const fallo = estado === 'error' && (
    <p className="text-xs text-amber-800 mt-1">
      No se pudieron cargar las visitas: se guardará sin visita, salvo que lo vincules a una plantilla
      (entonces queda en la visita de esa plantilla).
    </p>
  );

  if (compacto) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs text-gray-500 shrink-0">Visita:</span>
        {select}
        {fallo}
      </div>
    );
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">¿A qué visita pertenece?</label>
      {select}
      {fallo}
      <p className="text-xs text-gray-500 mt-1">
        Si lo vinculas a una plantilla, queda en la visita de esa plantilla.
      </p>
    </div>
  );
}
