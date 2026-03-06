'use client';

import { Save, Loader2 } from 'lucide-react';

interface Props {
  itemCount: number;
  subtotal: number;
  tax: number;
  tax2: number;
  total: number;
  taxColumnLabel: string;
  taxColumnLabel2: string;
  submitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSaveAsDraft: () => void;
  onSubmit: () => void;
}

export function QuotationSummaryCard({
  itemCount, subtotal, tax, tax2, total,
  taxColumnLabel, taxColumnLabel2,
  submitting, canSubmit,
  submitLabel, submittingLabel,
  onSaveAsDraft, onSubmit,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">Productos/Servicios</span>
          <span className="font-semibold text-gray-900">{itemCount}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">{taxColumnLabel || 'RTP %'} Total</span>
          <span className="font-semibold text-gray-900">${tax.toFixed(2)}</span>
        </div>
        {tax2 > 0 && (
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-600">{taxColumnLabel2 || 'Imp. 2 %'} Total</span>
            <span className="font-semibold text-gray-900">${tax2.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <span className="text-gray-900 font-bold text-lg">TOTAL</span>
          <span className="font-bold text-blue-600 text-xl">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <button
          onClick={onSaveAsDraft}
          disabled={submitting || !canSubmit}
          className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {submitting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Guardando...
            </div>
          ) : (
            'Guardar como Borrador'
          )}
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {submittingLabel}
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
