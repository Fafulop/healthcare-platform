'use client';

import { useState } from 'react';
import { Check, X, Plus, Loader2, Undo2, Link2, Layers } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import type { BankMovement } from './conciliacion-types';
import { SettlementPanel } from './SettlementPanel';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const ORIGIN_LABELS: Record<string, string> = {
  cita: 'Cita', manual: 'Manual', venta: 'Venta', compra: 'Compra',
  sat_recibido: 'SAT Recibido', sat_emitido: 'SAT Emitido', banco: 'Banco', webhook_pago: 'Pago Online',
  comision: 'Comisión',
};

interface MatchSuggestion {
  id: number;
  amount: number;
  concept: string;
  transactionDate: string;
  origin: string | null;
  area: string | null;
  internalId: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

interface Props {
  movement: BankMovement;
  statementId: number;
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
  onLinkExisting: (id: number, ledgerEntryId: number) => Promise<boolean>;
  onLinkSettlement: (
    id: number,
    ledgerEntryIds: number[],
    commission?: { area: string; subarea?: string; concept?: string },
  ) => Promise<boolean>;
}

export function MovementActions({
  movement,
  statementId,
  actionLoading,
  onConfirm,
  onUnmatch,
  onIgnore,
  onCreateEntry,
  onLinkExisting,
  onLinkSettlement,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [area, setArea] = useState(movement.suggestedArea || '');
  const [subarea, setSubarea] = useState(movement.suggestedSubarea || '');
  const [concept, setConcept] = useState(movement.suggestedConcept || movement.description);
  const [saveRule, setSaveRule] = useState(true);

  const fetchSuggestions = async () => {
    if (suggestions.length > 0 || loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/practice-management/conciliacion-bancaria/${statementId}/movements/${movement.id}`
      );
      if (res.ok) {
        const { data } = await res.json();
        setSuggestions(data || []);
      }
    } catch { /* silent */ }
    finally { setLoadingSuggestions(false); }
  };

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
          onClick={() => {
            setShowSuggestions(!showSuggestions);
            setShowCreate(false);
            if (!showSuggestions) fetchSuggestions();
          }}
          disabled={isLoading}
          className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-1 rounded flex items-center gap-1"
          title="Buscar movimientos existentes que coincidan"
        >
          <Link2 className="w-3 h-3" />
          Vincular
        </button>
        <button
          onClick={() => { setShowCreate(!showCreate); setShowSuggestions(false); setShowSettlement(false); }}
          disabled={isLoading}
          className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Nuevo
        </button>
        {movement.movementType === 'deposit' && (
          <button
            onClick={() => { setShowSettlement(!showSettlement); setShowCreate(false); setShowSuggestions(false); }}
            disabled={isLoading}
            className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded flex items-center gap-1"
            title="Conciliar este depósito con varios movimientos (p. ej. pagos con tarjeta agrupados)"
          >
            <Layers className="w-3 h-3" />
            Varios
          </button>
        )}
        <button
          onClick={() => onIgnore(movement.id)}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
          title="Ignorar"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
        </button>
      </div>

      {showSuggestions && (
        <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
          <p className="text-xs font-medium text-amber-800">Movimientos existentes que coinciden:</p>
          {loadingSuggestions ? (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-gray-500">No se encontraron coincidencias. Usa &quot;Nuevo&quot; para crear uno.</p>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 bg-white rounded p-2 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        s.confidence === 'high' ? 'bg-green-100 text-green-700' :
                        s.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {s.confidence === 'high' ? 'Alta' : s.confidence === 'medium' ? 'Media' : 'Baja'}
                      </span>
                      {s.origin && (
                        <span className="text-[10px] text-gray-500">
                          {ORIGIN_LABELS[s.origin] || s.origin}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-900 truncate mt-0.5">{s.concept}</p>
                    <p className="text-[10px] text-gray-500">
                      ${Number(s.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} &middot; {new Date(s.transactionDate).toLocaleDateString('es-MX')}
                      {s.area ? ` · ${s.area}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const ok = await onLinkExisting(movement.id, s.id);
                      if (ok) setShowSuggestions(false);
                    }}
                    disabled={isLoading}
                    className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowSuggestions(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cerrar
          </button>
        </div>
      )}

      {showSettlement && (
        <SettlementPanel
          statementId={statementId}
          movement={movement}
          isLoading={isLoading}
          onLinkSettlement={onLinkSettlement}
          onClose={() => setShowSettlement(false)}
        />
      )}

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
