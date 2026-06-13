'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Layers } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import type { SettlementCandidate } from './conciliacion-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const MAX_FEE_PCT = 0.08;

function money(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

interface Props {
  statementId: number;
  movement: { id: number; amount: string; movementType: string };
  isLoading: boolean;
  onLinkSettlement: (
    movId: number,
    ledgerEntryIds: number[],
    commission?: { area: string; subarea?: string; concept?: string },
  ) => Promise<boolean>;
  onClose: () => void;
}

export function SettlementPanel({ statementId, movement, isLoading, onLinkSettlement, onClose }: Props) {
  const deposit = Number(movement.amount);
  const [candidates, setCandidates] = useState<SettlementCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [recordCommission, setRecordCommission] = useState(true);
  const [commissionArea, setCommissionArea] = useState('Gastos Financieros');
  const [commissionConcept, setCommissionConcept] = useState('Comisión bancaria / terminal');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(
          `${API_URL}/api/practice-management/conciliacion-bancaria/${statementId}/movements/${movement.id}/settlement-candidates`
        );
        if (res.ok) {
          const { data } = await res.json();
          if (!cancelled) setCandidates(data?.candidates || []);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [statementId, movement.id]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const grossSum = useMemo(
    () => candidates.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.amount, 0),
    [candidates, selected],
  );
  const commission = Math.round((grossSum - deposit) * 100) / 100;
  const diff = Math.round((grossSum - deposit) * 100) / 100;

  // Valid: at least one entry, sum covers the deposit, and the implied commission is plausible.
  const tooShort = deposit - grossSum > 0.01;
  const feeTooBig = commission > grossSum * MAX_FEE_PCT + 0.01;
  const canConfirm = selected.size > 0 && !tooShort && !feeTooBig && !isLoading;

  return (
    <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-indigo-800 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" /> Conciliar varios movimientos con este depósito
        </p>
        <span className="text-xs text-indigo-700 font-semibold">{money(deposit)}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Buscando movimientos…
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-gray-500">No hay movimientos sin conciliar cercanos a esta fecha.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1">
          {candidates.map((c) => {
            const isSel = selected.has(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-2 p-1.5 rounded border cursor-pointer text-xs ${
                  isSel ? 'bg-white border-indigo-300' : 'bg-white/60 border-transparent hover:border-indigo-200'
                }`}
              >
                <input type="checkbox" checked={isSel} onChange={() => toggle(c.id)} className="rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate">{c.counterpartyName || c.concept}</p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(c.transactionDate).toLocaleDateString('es-MX')}
                    {c.formaDePago ? ` · ${c.formaDePago}` : ''}
                  </p>
                </div>
                <span className="text-gray-700 font-medium whitespace-nowrap">{money(c.amount)}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Running totals */}
      <div className="text-xs space-y-0.5 border-t border-indigo-200 pt-2">
        <div className="flex justify-between text-gray-600">
          <span>Seleccionado ({selected.size})</span>
          <span className="font-medium">{money(grossSum)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Depósito</span>
          <span className="font-medium">{money(deposit)}</span>
        </div>
        <div className={`flex justify-between font-medium ${
          tooShort ? 'text-red-600' : feeTooBig ? 'text-red-600' : 'text-indigo-700'
        }`}>
          <span>{diff >= 0 ? 'Comisión implícita' : 'Faltante'}</span>
          <span>{money(Math.abs(diff))}</span>
        </div>
        {tooShort && (
          <p className="text-[10px] text-red-600">La suma seleccionada aún no cubre el depósito.</p>
        )}
        {feeTooBig && !tooShort && (
          <p className="text-[10px] text-red-600">La diferencia es demasiado grande para ser una comisión.</p>
        )}
      </div>

      {/* Commission egreso option */}
      {commission > 0.01 && !tooShort && !feeTooBig && (
        <div className="space-y-1.5 border-t border-indigo-200 pt-2">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={recordCommission}
              onChange={(e) => setRecordCommission(e.target.checked)}
              className="rounded"
            />
            Registrar la comisión de {money(commission)} como egreso
          </label>
          {recordCommission && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={commissionArea}
                onChange={(e) => setCommissionArea(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Área"
              />
              <input
                value={commissionConcept}
                onChange={(e) => setCommissionConcept(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Concepto"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            const commissionPayload =
              recordCommission && commission > 0.01 && commissionArea.trim()
                ? { area: commissionArea.trim(), concept: commissionConcept.trim() || undefined }
                : undefined;
            const ok = await onLinkSettlement(movement.id, Array.from(selected), commissionPayload);
            if (ok) onClose();
          }}
          disabled={!canConfirm}
          className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Conciliar {selected.size > 0 ? `${selected.size} movimientos` : ''}
        </button>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          Cancelar
        </button>
      </div>
    </div>
  );
}
