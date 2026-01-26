'use client';

/**
 * BatchEntryList
 *
 * Component to display and edit multiple ledger entries in the voice chat sidebar.
 * Used when the LLM detects multiple entries in a single voice recording.
 */

import { useState } from 'react';
import { Trash2, Edit2, Plus, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import type { VoiceLedgerEntryData } from '@/types/voice-assistant';

interface BatchEntryListProps {
  entries: VoiceLedgerEntryData[];
  onUpdateEntries: (entries: VoiceLedgerEntryData[]) => void;
}

export function BatchEntryList({ entries, onUpdateEntries }: BatchEntryListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleRemoveEntry = (index: number) => {
    const updated = entries.filter((_, i) => i !== index);
    onUpdateEntries(updated);
  };

  const handleEditEntry = (index: number) => {
    setEditingIndex(index);
  };

  const handleAddEntry = () => {
    const newEntry: VoiceLedgerEntryData = {
      entryType: 'ingreso',
      amount: null,
      transactionDate: null,
      concept: null,
      transactionType: 'N/A',
      clientId: null,
      supplierId: null,
      paymentStatus: null,
      amountPaid: null,
      area: null,
      subarea: null,
      bankAccount: null,
      formaDePago: 'efectivo',
      bankMovementId: null,
    };
    onUpdateEntries([...entries, newEntry]);
    setEditingIndex(entries.length); // Edit the new entry
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (!amount) return 'Sin monto';
    return `$${amount.toLocaleString('es-MX')}`;
  };

  const formatPaymentMethod = (method: string | null | undefined) => {
    const methods: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
      cheque: 'Cheque',
      deposito: 'Depósito',
    };
    return methods[method || 'efectivo'] || 'Efectivo';
  };

  // Format date without UTC conversion (YYYY-MM-DD -> local date display)
  const formatDate = (dateStr: string) => {
    try {
      // Extract just the date part (YYYY-MM-DD) from ISO timestamp (2026-01-23T00:00:00.000Z)
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('es-MX');
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">
          {entries.length} {entries.length === 1 ? 'Movimiento' : 'Movimientos'} Detectados
        </h3>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>

      {entries.map((entry, index) => (
        <div
          key={index}
          className={`border rounded-lg p-3 ${
            entry.entryType === 'ingreso'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {entry.entryType === 'ingreso' ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className="text-xs font-medium text-gray-500">
                #{index + 1} {entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleEditEntry(index)}
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                title="Editar"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleRemoveEntry(index)}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-bold ${
                entry.entryType === 'ingreso' ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatAmount(entry.amount)}
              </span>
              <span className="text-xs text-gray-500">
                {formatPaymentMethod(entry.formaDePago)}
              </span>
            </div>

            {entry.concept && (
              <p className="text-sm text-gray-700 line-clamp-2">
                {entry.concept}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {/* Warning if date is missing */}
              {!entry.transactionDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
                  <AlertCircle className="w-3 h-3" />
                  Sin fecha
                </span>
              )}

              {entry.area && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {entry.area}
                </span>
              )}
              {entry.transactionType && entry.transactionType !== 'N/A' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  {entry.transactionType}
                </span>
              )}
              {entry.transactionDate && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                  {formatDate(entry.transactionDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
