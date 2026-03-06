'use client';

import Link from 'next/link';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import type { LedgerEntry } from './ledger-types';
import { formatCurrency, formatDate } from './ledger-utils';

interface Props {
  entry: LedgerEntry;
  onClose: () => void;
}

export function EntryDetailModal({ entry, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 sm:pt-5 pb-2">
          <div>
            <span className="text-xs font-mono text-gray-500">{entry.internalId}</span>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Detalle del Movimiento</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 min-h-0">
          {/* Amount + Type */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
              entry.entryType === 'ingreso' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {entry.entryType === 'ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
            </span>
            <span className={`text-2xl font-bold ${entry.entryType === 'ingreso' ? 'text-teal-700' : 'text-rose-600'}`}>
              {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
            </span>
          </div>

          {/* Concepto */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Concepto</p>
            <p className="text-sm text-gray-900">{entry.concept}</p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</p>
              <p className="text-sm text-gray-900">{formatDate(entry.transactionDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                entry.porRealizar ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {entry.porRealizar ? 'Por Realizar' : 'Realizado'}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Área</p>
              <p className="text-sm text-gray-900">{entry.area || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subárea</p>
              <p className="text-sm text-gray-900">{entry.subarea || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Forma de Pago</p>
              <p className="text-sm text-gray-900 capitalize">{entry.formaDePago}</p>
            </div>
            {entry.bankAccount && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cuenta Bancaria</p>
                <p className="text-sm text-gray-900">{entry.bankAccount}</p>
              </div>
            )}
          </div>

          {/* Transaction block */}
          {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  entry.transactionType === 'VENTA' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {entry.transactionType === 'VENTA' ? 'Venta' : 'Compra'}
                </span>
                {entry.paymentStatus && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    entry.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                    entry.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {entry.paymentStatus === 'PAID' ? 'Pagado' : entry.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                  </span>
                )}
              </div>

              {(entry.client || entry.supplier) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {entry.transactionType === 'VENTA' ? 'Paciente' : 'Proveedor'}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {entry.client?.businessName || entry.supplier?.businessName}
                  </p>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(entry.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pagado</span>
                  <span className="font-semibold text-teal-700">{formatCurrency(entry.amountPaid || '0')}</span>
                </div>
                <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                  <span className="font-medium text-gray-700">Saldo</span>
                  <span className={`font-bold ${
                    (parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')) === 0 ? 'text-teal-700' : 'text-rose-600'
                  }`}>
                    {formatCurrency((parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')).toString())}
                  </span>
                </div>
              </div>

              {entry.sale && (
                <Link href={`/dashboard/practice/ventas/${entry.sale.id}`} className="text-slate-600 hover:text-slate-700 text-sm font-medium">
                  Ver venta {entry.sale.saleNumber} →
                </Link>
              )}
              {entry.purchase && (
                <Link href={`/dashboard/practice/compras/${entry.purchase.id}`} className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                  Ver compra {entry.purchase.purchaseNumber} →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white">
          <Link
            href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
            className="block w-full text-center px-4 py-3 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          >
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}
