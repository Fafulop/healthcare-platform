'use client';

import { useState } from 'react';
import { X, Loader2, Merge, ArrowRight } from 'lucide-react';
import type { LedgerEntry } from './ledger-types';
import { formatCurrency, formatDate } from './ledger-utils';

interface Props {
  entries: LedgerEntry[];
  merging: boolean;
  onMerge: (targetId: number, sourceId: number) => void;
  onClose: () => void;
}

function EntryCard({
  entry,
  selected,
  onSelect,
  label,
}: {
  entry: LedgerEntry;
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  const isIngreso = entry.entryType === 'ingreso';
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      {selected && (
        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
          {label}
        </span>
      )}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-500">{entry.internalId}</span>
        <span className={`text-lg font-bold ${isIngreso ? 'text-teal-700' : 'text-rose-600'}`}>
          {isIngreso ? '+' : '-'} {formatCurrency(entry.amount)}
        </span>
      </div>
      <p className="text-sm text-gray-900 mb-2 line-clamp-2">{entry.concept}</p>
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
        <span>{formatDate(entry.transactionDate)}</span>
        <span className="text-right capitalize">{entry.formaDePago || '—'}</span>
        <span>{entry.area || 'Sin área'}</span>
        <span className="text-right">{entry.origin || 'manual'}</span>
      </div>
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {entry.hasFactura && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
            {entry.satCfdiUuid ? 'CFDI' : 'Factura'}
          </span>
        )}
        {entry.hasComprobante && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-medium">Comprobante</span>
        )}
        {entry.bankAccount && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">Banco</span>
        )}
        {entry.needsReview && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Revisar</span>
        )}
      </div>
    </button>
  );
}

export function MergeModal({ entries, merging, onMerge, onClose }: Props) {
  const [targetIdx, setTargetIdx] = useState<number>(0);

  if (entries.length !== 2) return null;

  const targetEntry = entries[targetIdx];
  const sourceEntry = entries[targetIdx === 0 ? 1 : 0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-2xl sm:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 sm:pt-5 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-bold text-gray-900">Fusionar Movimientos</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          <p className="text-sm text-gray-600">
            Selecciona el movimiento que deseas <strong>conservar</strong>. Los datos del otro se transferirán y luego será eliminado.
          </p>

          {/* Side by side cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EntryCard
              entry={entries[0]}
              selected={targetIdx === 0}
              onSelect={() => setTargetIdx(0)}
              label="Conservar"
            />
            <EntryCard
              entry={entries[1]}
              selected={targetIdx === 1}
              onSelect={() => setTargetIdx(1)}
              label="Conservar"
            />
          </div>

          {/* Transfer preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span className="font-medium">{sourceEntry.internalId}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-medium">{targetEntry.internalId}</span>
            </div>
            <p className="text-xs text-gray-600">
              Se transferirán: facturas, comprobantes, datos bancarios, adjuntos y categorización faltante.
              El movimiento <strong>{sourceEntry.internalId}</strong> será eliminado.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onMerge(targetEntry.id, sourceEntry.id)}
            disabled={merging}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fusionando...
              </>
            ) : (
              <>
                <Merge className="w-4 h-4" />
                Fusionar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
