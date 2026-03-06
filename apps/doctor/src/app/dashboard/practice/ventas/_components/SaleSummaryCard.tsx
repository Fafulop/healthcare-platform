'use client';

import { Loader2, Save } from 'lucide-react';

interface Props {
  itemCount: number;
  subtotal: number;
  tax: number;
  tax2: number;
  total: number;
  taxColumnLabel: string;
  taxColumnLabel2: string;
  amountPaid: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
  submitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: () => void;
}

export function SaleSummaryCard({
  itemCount, subtotal, tax, tax2, total,
  taxColumnLabel, taxColumnLabel2,
  amountPaid, paymentStatus,
  submitting, canSubmit,
  submitLabel, submittingLabel,
  onSubmit,
}: Props) {
  const balance = total - amountPaid;

  return (
    <div className="bg-white rounded-lg shadow p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">Servicios</span>
          <span className="font-semibold text-gray-900">{itemCount}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pb-3 border-b">
          <span className="text-gray-600">{taxColumnLabel || 'IVA %'} Total</span>
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
        {amountPaid > 0 && (
          <>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-gray-600">Monto Pagado</span>
              <span className="font-semibold text-blue-600">${amountPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Saldo Pendiente</span>
              <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${balance.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
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
