'use client';

import Link from 'next/link';
import { Loader2, Plus, Trash2, Eye, Landmark } from 'lucide-react';
import { useConciliacionPage } from './_components/useConciliacionPage';
import { StatementUploadModal } from './_components/StatementUploadModal';
import { BANK_OPTIONS, MONTH_NAMES } from './_components/conciliacion-types';

function formatCurrency(val: string | null) {
  if (!val) return '-';
  const n = parseFloat(val);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function bankLabel(val: string) {
  return BANK_OPTIONS.find((b) => b.value === val)?.label || val;
}

export default function ConciliacionBancariaPage() {
  const page = useConciliacionPage();

  if (page.sessionStatus === 'loading' || page.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando conciliación bancaria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Conciliación Bancaria</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Sube estados de cuenta para conciliar movimientos automáticamente
            </p>
          </div>
          <button
            onClick={() => page.setShowUploadModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Subir Estado de Cuenta
          </button>
        </div>
      </div>

      {/* Statements list */}
      {page.statements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Landmark className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay estados de cuenta</h3>
          <p className="text-gray-500 mb-4">
            Sube tu primer estado de cuenta en formato CSV para comenzar la conciliación
          </p>
          <button
            onClick={() => page.setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Subir Estado de Cuenta
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Periodo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Banco</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cuenta</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Depósitos</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Retiros</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Movimientos</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Conciliados</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Nuevos</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {page.statements.map((stmt) => {
                  const total = stmt._count?.movements || stmt.movementCount;
                  const pct = total > 0 ? Math.round((stmt.matchedCount / total) * 100) : 0;
                  return (
                    <tr key={stmt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {MONTH_NAMES[stmt.periodMonth - 1]} {stmt.periodYear}
                      </td>
                      <td className="px-4 py-3">{bankLabel(stmt.bankName)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{stmt.accountNumber}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {formatCurrency(stmt.totalDeposits)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-700 font-medium">
                        {formatCurrency(stmt.totalWithdrawals)}
                      </td>
                      <td className="px-4 py-3 text-center">{total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-green-700 font-medium">{stmt.matchedCount}</span>
                          <span className="text-xs text-gray-400">({pct}%)</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-yellow-700 font-medium">{stmt.newCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/dashboard/practice/conciliacion-bancaria/${stmt.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => page.handleDelete(stmt.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {page.statements.map((stmt) => {
              const total = stmt._count?.movements || stmt.movementCount;
              const pct = total > 0 ? Math.round((stmt.matchedCount / total) * 100) : 0;
              return (
                <div key={stmt.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">
                      {MONTH_NAMES[stmt.periodMonth - 1]} {stmt.periodYear}
                    </span>
                    <span className="text-xs text-gray-500">{bankLabel(stmt.bankName)} &middot; {stmt.accountNumber}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div>
                      <span className="text-gray-500">Depósitos</span>
                      <p className="text-green-700 font-medium">{formatCurrency(stmt.totalDeposits)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Retiros</span>
                      <p className="text-red-700 font-medium">{formatCurrency(stmt.totalWithdrawals)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Conciliado</span>
                      <p className="font-medium">{stmt.matchedCount}/{total} ({pct}%)</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/practice/conciliacion-bancaria/${stmt.id}`}
                      className="flex-1 text-center text-sm font-medium text-blue-600 bg-blue-50 rounded-md py-1.5 hover:bg-blue-100"
                    >
                      Ver detalle
                    </Link>
                    <button
                      onClick={() => page.handleDelete(stmt.id)}
                      className="px-3 text-sm font-medium text-red-500 bg-red-50 rounded-md py-1.5 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <StatementUploadModal
        open={page.showUploadModal}
        onClose={() => page.setShowUploadModal(false)}
        onUpload={page.handleUpload}
        uploading={page.uploading}
      />
    </div>
  );
}
