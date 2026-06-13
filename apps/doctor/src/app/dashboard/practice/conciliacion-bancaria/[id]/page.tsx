'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { useStatementDetail } from '../_components/useStatementDetail';
import { MovementActions } from '../_components/MovementActions';
import {
  BANK_OPTIONS,
  MONTH_NAMES,
  MATCH_STATUS_LABELS,
} from '../_components/conciliacion-types';

function formatCurrency(val: string | null) {
  if (!val) return '-';
  const n = parseFloat(val);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function bankLabel(val: string) {
  return BANK_OPTIONS.find((b) => b.value === val)?.label || val;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export default function StatementDetailPage() {
  const params = useParams();
  const id = parseInt(params.id as string);
  const detail = useStatementDetail(id);

  if (detail.sessionStatus === 'loading' || detail.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!detail.statement) {
    return (
      <div className="p-6 text-center text-gray-500">Estado de cuenta no encontrado.</div>
    );
  }

  const stmt = detail.statement;
  const total = stmt.movements.length;
  const matched = stmt.movements.filter(
    (m) => m.matchStatus === 'matched_auto' || m.matchStatus === 'matched_confirmed'
  ).length;
  const confirmed = stmt.movements.filter((m) => m.matchStatus === 'matched_confirmed').length;
  const unmatched = stmt.movements.filter((m) => m.matchStatus === 'unmatched').length;
  const ignored = stmt.movements.filter((m) => m.matchStatus === 'ignored').length;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/practice/conciliacion-bancaria"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {bankLabel(stmt.bankName)} &middot; {MONTH_NAMES[stmt.periodMonth - 1]} {stmt.periodYear}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Cuenta {stmt.accountNumber} &middot; {stmt.fileName}
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs text-gray-500">Conciliados</p>
          <p className="text-lg font-bold text-green-700">{matched}</p>
          <p className="text-xs text-gray-400">{confirmed} confirmados</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs text-gray-500">Sin match</p>
          <p className="text-lg font-bold text-yellow-700">{unmatched}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs text-gray-500">Ignorados</p>
          <p className="text-lg font-bold text-gray-500">{ignored}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs text-gray-500">Depósitos / Retiros</p>
          <p className="text-xs text-green-700 font-medium">{formatCurrency(stmt.totalDeposits)}</p>
          <p className="text-xs text-red-700 font-medium">{formatCurrency(stmt.totalWithdrawals)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-t-lg shadow border-b border-gray-200 flex overflow-x-auto">
        {([
          { key: 'all', label: `Todos (${total})` },
          { key: 'unmatched', label: `Sin match (${unmatched})` },
          { key: 'matched', label: `Conciliados (${matched})` },
          { key: 'ignored', label: `Ignorados (${ignored})` },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => detail.setFilter(tab.key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              detail.filter === tab.key
                ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Movements table */}
      <div className="bg-white rounded-b-lg shadow overflow-hidden">
        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-20">Fecha</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Descripción</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-600 w-28">Monto</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600 w-32">Estado</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-48">Match / Sugerencia</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-48">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.filteredMovements.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(mov.transactionDate)}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-900 text-xs leading-tight truncate max-w-xs" title={mov.description}>
                      {mov.description}
                    </p>
                    {mov.reference && (
                      <p className="text-[10px] text-gray-400 font-mono">Ref: {mov.reference}</p>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${
                    mov.movementType === 'deposit' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {mov.movementType === 'deposit' ? '+' : '-'}{formatCurrency(mov.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(() => {
                      const s = MATCH_STATUS_LABELS[mov.matchStatus];
                      return s ? (
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{mov.matchStatus}</span>
                      );
                    })()}
                    {mov.matchConfidence && (
                      <p className="text-[10px] text-gray-400">{Math.round(parseFloat(mov.matchConfidence) * 100)}%</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {mov.settlementItems && mov.settlementItems.length > 0 ? (
                      <div className="text-indigo-700">
                        <p className="font-medium">{mov.settlementItems.length} movimientos conciliados</p>
                        <p className="text-indigo-500/70 truncate max-w-[180px]">
                          {mov.settlementItems
                            .map((s) => s.ledgerEntry.counterpartyName || s.ledgerEntry.concept)
                            .slice(0, 2)
                            .join(', ')}
                          {mov.settlementItems.length > 2 ? '…' : ''}
                        </p>
                      </div>
                    ) : mov.ledgerEntry ? (
                      <div className="text-gray-600">
                        <p className="font-medium">{mov.ledgerEntry.area}</p>
                        <p className="text-gray-400 truncate max-w-[180px]">{mov.ledgerEntry.concept}</p>
                      </div>
                    ) : mov.suggestedArea ? (
                      <div className="text-amber-700">
                        <p className="font-medium">{mov.suggestedArea}</p>
                        {mov.suggestedSubarea && <p className="text-amber-600/70">{mov.suggestedSubarea}</p>}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <MovementActions
                      movement={mov}
                      actionLoading={detail.actionLoading}
                      onConfirm={detail.confirmMatch}
                      onUnmatch={detail.unmatch}
                      onIgnore={detail.ignore}
                      onCreateEntry={detail.createEntry}
                      onLinkExisting={detail.linkExisting}
                      onLinkSettlement={detail.linkSettlement}
                      statementId={id}
                    />
                  </td>
                </tr>
              ))}
              {detail.filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No hay movimientos con este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-gray-100">
          {detail.filteredMovements.map((mov) => {
            const s = MATCH_STATUS_LABELS[mov.matchStatus];
            return (
              <div key={mov.id} className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 truncate">{mov.description}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(mov.transactionDate)}</p>
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    mov.movementType === 'deposit' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {mov.movementType === 'deposit' ? '+' : '-'}{formatCurrency(mov.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {s && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                      {s.label}
                    </span>
                  )}
                  {mov.suggestedArea && !mov.ledgerEntry && (
                    <span className="text-[10px] text-amber-700">{mov.suggestedArea}</span>
                  )}
                  {mov.ledgerEntry && (
                    <span className="text-[10px] text-gray-600">{mov.ledgerEntry.area}: {mov.ledgerEntry.concept}</span>
                  )}
                  {mov.settlementItems && mov.settlementItems.length > 0 && (
                    <span className="text-[10px] text-indigo-700">{mov.settlementItems.length} movimientos conciliados</span>
                  )}
                </div>
                <MovementActions
                  movement={mov}
                  actionLoading={detail.actionLoading}
                  onConfirm={detail.confirmMatch}
                  onUnmatch={detail.unmatch}
                  onIgnore={detail.ignore}
                  onCreateEntry={detail.createEntry}
                  onLinkExisting={detail.linkExisting}
                  onLinkSettlement={detail.linkSettlement}
                  statementId={id}
                />
              </div>
            );
          })}
          {detail.filteredMovements.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              No hay movimientos con este filtro
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
