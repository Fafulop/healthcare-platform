'use client';

import { Loader2, Check, X, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { ReviewItem } from './pdf-import-types';

interface Props {
  items: ReviewItem[];
  selectedCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  meta: { pages: number; textLength: number; tokensUsed: number } | null;
  importing: boolean;
  onToggleItem: (index: number) => void;
  onToggleAll: (selected: boolean) => void;
  onUpdateItem: (index: number, field: keyof ReviewItem, value: string | number) => void;
  onImport: () => void;
  onCancel: () => void;
}

const FORMA_PAGO_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'deposito', label: 'Depósito' },
];

function formatCurrency(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function PdfReviewTable({
  items, selectedCount, totalDeposits, totalWithdrawals, meta,
  importing, onToggleItem, onToggleAll, onUpdateItem, onImport, onCancel,
}: Props) {
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Revisar Movimientos Extraídos
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {items.length} movimientos encontrados
              {meta ? ` · ${meta.pages} páginas` : ''}
              {' · '}{selectedCount} seleccionados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-700">
                <TrendingUp className="w-4 h-4" />
                {formatCurrency(totalDeposits)}
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <TrendingDown className="w-4 h-4" />
                {formatCurrency(totalWithdrawals)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleAll(!allSelected)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={importing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            onClick={onImport}
            disabled={importing || selectedCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Importar {selectedCount} movimientos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleAll(!allSelected)}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Concepto</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Monto</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Tipo</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Área</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Subárea</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-32">Forma de Pago</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr
                  key={i}
                  className={`${item.selected ? 'bg-white' : 'bg-gray-50 opacity-60'} hover:bg-blue-50/50 transition-colors`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => onToggleItem(i)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={item.transactionDate}
                      onChange={(e) => onUpdateItem(i, 'transactionDate', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.concept}
                      onChange={(e) => onUpdateItem(i, 'concept', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => onUpdateItem(i, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.entryType}
                      onChange={(e) => onUpdateItem(i, 'entryType', e.target.value)}
                      className={`w-full border border-gray-200 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${
                        item.entryType === 'ingreso' ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.area}
                      onChange={(e) => onUpdateItem(i, 'area', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.subarea}
                      onChange={(e) => onUpdateItem(i, 'subarea', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.formaDePago}
                      onChange={(e) => onUpdateItem(i, 'formaDePago', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    >
                      {FORMA_PAGO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.reference}
                      onChange={(e) => onUpdateItem(i, 'reference', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-500 focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {items.map((item, i) => (
            <div
              key={i}
              className={`p-4 ${item.selected ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => onToggleItem(i)}
                  className="rounded border-gray-300 mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="date"
                      value={item.transactionDate}
                      onChange={(e) => onUpdateItem(i, 'transactionDate', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                    <select
                      value={item.entryType}
                      onChange={(e) => onUpdateItem(i, 'entryType', e.target.value)}
                      className={`border border-gray-200 rounded px-2 py-1 text-xs font-medium ${
                        item.entryType === 'ingreso' ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={item.concept}
                    onChange={(e) => onUpdateItem(i, 'concept', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">Monto</label>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => onUpdateItem(i, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Forma de Pago</label>
                      <select
                        value={item.formaDePago}
                        onChange={(e) => onUpdateItem(i, 'formaDePago', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      >
                        {FORMA_PAGO_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">Área</label>
                      <input
                        type="text"
                        value={item.area}
                        onChange={(e) => onUpdateItem(i, 'area', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Subárea</label>
                      <input
                        type="text"
                        value={item.subarea}
                        onChange={(e) => onUpdateItem(i, 'subarea', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
