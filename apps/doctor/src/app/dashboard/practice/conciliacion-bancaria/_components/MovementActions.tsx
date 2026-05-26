'use client';

import { useState } from 'react';
import { Check, X, Plus, Loader2, Eye, Undo2 } from 'lucide-react';
import type { BankMovement } from './conciliacion-types';

interface Props {
  movement: BankMovement;
  actionLoading: number | null;
  onConfirm: (id: number) => Promise<boolean>;
  onUnmatch: (id: number) => Promise<boolean>;
  onIgnore: (id: number) => Promise<boolean>;
  onCreateEntry: (
    id: number,
    entryType: string,
    area: string,
    subarea: string,
    concept: string,
    saveRule: boolean,
  ) => Promise<boolean>;
}

export function MovementActions({
  movement,
  actionLoading,
  onConfirm,
  onUnmatch,
  onIgnore,
  onCreateEntry,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [area, setArea] = useState(movement.suggestedArea || '');
  const [subarea, setSubarea] = useState(movement.suggestedSubarea || '');
  const [concept, setConcept] = useState(movement.suggestedConcept || movement.description);
  const [saveRule, setSaveRule] = useState(true);

  const isLoading = actionLoading === movement.id;
  const entryType = movement.movementType === 'deposit' ? 'ingreso' : 'egreso';

  if (movement.matchStatus === 'ignored') {
    return (
      <button
        onClick={() => onUnmatch(movement.id)}
        disabled={isLoading}
        className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
        Restaurar
      </button>
    );
  }

  if (movement.matchStatus === 'matched_confirmed') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Check className="w-3 h-3" /> Confirmado
        </span>
        <button
          onClick={() => onUnmatch(movement.id)}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-red-500"
          title="Deshacer match"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  if (movement.matchStatus === 'matched_auto') {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onConfirm(movement.id)}
          disabled={isLoading}
          className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded flex items-center gap-1"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Confirmar
        </button>
        <button
          onClick={() => onUnmatch(movement.id)}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-red-500 px-1 py-1"
          title="Rechazar match"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // unmatched
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowCreate(!showCreate)}
          disabled={isLoading}
          className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Registrar
        </button>
        <button
          onClick={() => onIgnore(movement.id)}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
          title="Ignorar"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
        </button>
      </div>

      {showCreate && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Área</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Ej: Gastos Fijos"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Subárea</label>
              <input
                value={subarea}
                onChange={(e) => setSubarea(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Ej: Servicios"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Concepto</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`rule-${movement.id}`}
              checked={saveRule}
              onChange={(e) => setSaveRule(e.target.checked)}
              className="rounded"
            />
            <label htmlFor={`rule-${movement.id}`} className="text-xs text-gray-600">
              Recordar regla para futuros estados de cuenta
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={async () => {
                const ok = await onCreateEntry(movement.id, entryType, area, subarea, concept, saveRule);
                if (ok) setShowCreate(false);
              }}
              disabled={!area || isLoading}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Crear {entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
