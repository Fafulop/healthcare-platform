'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { authFetch } from '@/lib/auth-fetch';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Receipt,
  FolderTree,
  TrendingUp,
  AlertCircle,
  Landmark,
} from 'lucide-react';
import { ORIGIN_LABELS } from './ledger-types';
import { formatCurrency } from './ledger-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface EvidenceStats {
  withComprobante: number;
  withFactura: number;
  withArea: number;
  pctComprobante: number;
  pctFactura: number;
  pctCategorized: number;
}

interface BankReconciliation {
  reconcilable: number;
  matched: number;
  unmatched: number;
  pctReconciled: number;
  excludedCash: number;
  excludedWebhook: number;
}

interface OriginItem {
  origin: string;
  count: number;
  total: number;
}

interface TypeItem {
  entryType: string;
  count: number;
  total: number;
}

interface Alert {
  type: string;
  severity: string;
  count: number;
  message: string;
}

interface ReconciliationMatrix {
  fullyReconciled: number;
  invoicedUnmatched: number;
  matchedNoInvoice: number;
  undocumented: number;
  totalIngresos: number;
}

interface CompletenessData {
  total: number;
  evidence: EvidenceStats;
  bankReconciliation?: BankReconciliation;
  reconciliationMatrix?: ReconciliationMatrix;
  byOrigin: OriginItem[];
  byEntryType: TypeItem[];
  alerts: Alert[];
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export function CompletenessTab() {
  const { status } = useSession({ required: true });
  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    setError(false);
    authFetch(`${API_URL}/api/practice-management/ledger/completeness`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        Error al cargar estadisticas. Intenta de nuevo.
      </div>
    );
  }

  const severityIcon = (s: string) => {
    if (s === 'high') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (s === 'medium') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <AlertCircle className="w-4 h-4 text-gray-400" />;
  };

  const severityBg = (s: string) => {
    if (s === 'high') return 'bg-red-50 border-red-200';
    if (s === 'medium') return 'bg-amber-50 border-amber-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-slate-500">
          <p className="text-xs text-gray-500 mb-1">Total Movimientos</p>
          <p className="text-2xl font-bold text-gray-900">{data.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-teal-500">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt className="w-3.5 h-3.5 text-teal-600" />
            <p className="text-xs text-gray-500">Con Comprobante</p>
          </div>
          <p className="text-2xl font-bold text-teal-700">{data.evidence.pctComprobante}%</p>
          <p className="text-xs text-gray-400">{data.evidence.withComprobante} de {data.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-blue-500">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs text-gray-500">Con Factura</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{data.evidence.pctFactura}%</p>
          <p className="text-xs text-gray-400">{data.evidence.withFactura} de {data.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-purple-500">
          <div className="flex items-center gap-1.5 mb-1">
            <FolderTree className="w-3.5 h-3.5 text-purple-600" />
            <p className="text-xs text-gray-500">Categorizados</p>
          </div>
          <p className="text-2xl font-bold text-purple-700">{data.evidence.pctCategorized}%</p>
          <p className="text-xs text-gray-400">{data.evidence.withArea} de {data.total}</p>
        </div>
        {data.bankReconciliation && (
          <div className="bg-white rounded-lg shadow p-4 border-t-4 border-indigo-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Landmark className="w-3.5 h-3.5 text-indigo-600" />
              <p className="text-xs text-gray-500">Conciliado Banco</p>
            </div>
            <p className="text-2xl font-bold text-indigo-700">{data.bankReconciliation.pctReconciled}%</p>
            <p className="text-xs text-gray-400">{data.bankReconciliation.matched} de {data.bankReconciliation.reconcilable}</p>
          </div>
        )}
      </div>

      {/* Evidence Progress */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Capas de Evidencia</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Capa 1: Registro</span>
              <span className="font-medium text-gray-900">100%</span>
            </div>
            <ProgressBar pct={100} color="bg-green-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">Todos los movimientos tienen registro (LedgerEntry)</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Capa 2: Comprobante</span>
              <span className="font-medium text-teal-700">{data.evidence.pctComprobante}%</span>
            </div>
            <ProgressBar pct={data.evidence.pctComprobante} color="bg-teal-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">Ticket, voucher, estado de cuenta, o comprobante de pago</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Capa 3: Factura (CFDI)</span>
              <span className="font-medium text-blue-700">{data.evidence.pctFactura}%</span>
            </div>
            <ProgressBar pct={data.evidence.pctFactura} color="bg-blue-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">CFDI emitido, recibido, o descargado del SAT</p>
          </div>
          {data.bankReconciliation && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Capa 4: Conciliacion Bancaria</span>
                <span className="font-medium text-indigo-700">{data.bankReconciliation.pctReconciled}%</span>
              </div>
              <ProgressBar pct={data.bankReconciliation.pctReconciled} color="bg-indigo-500" />
              <p className="text-[10px] text-gray-400 mt-0.5">
                {data.bankReconciliation.matched} conciliados de {data.bankReconciliation.reconcilable} conciliables
                {(data.bankReconciliation.excludedCash > 0 || data.bankReconciliation.excludedWebhook > 0) && (
                  <span className="text-gray-300">
                    {' '}(excluye {data.bankReconciliation.excludedCash > 0 ? `${data.bankReconciliation.excludedCash} en efectivo` : ''}
                    {data.bankReconciliation.excludedCash > 0 && data.bankReconciliation.excludedWebhook > 0 ? ' y ' : ''}
                    {data.bankReconciliation.excludedWebhook > 0 ? `${data.bankReconciliation.excludedWebhook} pagos online` : ''})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reconciliation Matrix */}
      {data.reconciliationMatrix && data.reconciliationMatrix.totalIngresos > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Matriz de Conciliacion (Ingresos)</h3>
          <p className="text-[10px] text-gray-400 mb-4">Cruce entre factura emitida (CFDI) y conciliacion bancaria</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Fully Reconciled */}
            <div className="p-3 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-800">Totalmente Conciliado</span>
              </div>
              <p className="text-xl font-bold text-green-700">{data.reconciliationMatrix.fullyReconciled}</p>
              <p className="text-[10px] text-green-600">CFDI emitido + banco conciliado</p>
            </div>
            {/* Invoiced but Unmatched */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">Facturado sin Banco</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{data.reconciliationMatrix.invoicedUnmatched}</p>
              <p className="text-[10px] text-amber-600">CFDI emitido, sin match bancario</p>
            </div>
            {/* Matched but No Invoice */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Banco sin Factura</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{data.reconciliationMatrix.matchedNoInvoice}</p>
              <p className="text-[10px] text-blue-600">Banco conciliado, sin CFDI emitido</p>
            </div>
            {/* Undocumented */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-800">Sin Documentar</span>
              </div>
              <p className="text-xl font-bold text-red-700">{data.reconciliationMatrix.undocumented}</p>
              <p className="text-[10px] text-red-600">Sin CFDI ni match bancario</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-right">
            Total ingresos en matriz: {data.reconciliationMatrix.totalIngresos}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* By Origin */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Origen</h3>
          {data.byOrigin.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {data.byOrigin
                .sort((a, b) => b.count - a.count)
                .map((item) => {
                  const label = ORIGIN_LABELS[item.origin] || { label: item.origin, color: 'bg-gray-100 text-gray-600' };
                  const pct = data.total > 0 ? Math.round((item.count / data.total) * 100) : 0;
                  return (
                    <div key={item.origin} className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${label.color} w-20 text-center shrink-0`}>
                        {label.label}
                      </span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-slate-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{item.count}</span>
                      <span className="text-xs text-gray-400 w-24 text-right hidden sm:block">{formatCurrency(item.total)}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* By Type */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Tipo</h3>
          {data.byEntryType.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {data.byEntryType.map((item) => {
                const isIngreso = item.entryType === 'ingreso';
                return (
                  <div key={item.entryType} className={`p-3 rounded-lg border ${isIngreso ? 'border-teal-200 bg-teal-50' : 'border-rose-200 bg-rose-50'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={`w-4 h-4 ${isIngreso ? 'text-teal-600' : 'text-rose-600 rotate-180'}`} />
                        <span className={`text-sm font-medium ${isIngreso ? 'text-teal-800' : 'text-rose-800'}`}>
                          {isIngreso ? 'Ingresos' : 'Egresos'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{item.count} movimientos</span>
                    </div>
                    <p className={`text-lg font-bold mt-1 ${isIngreso ? 'text-teal-700' : 'text-rose-700'}`}>
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Alertas</h3>
          <div className="space-y-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.type}
                className={`flex items-center gap-3 p-3 rounded-lg border ${severityBg(alert.severity)}`}
              >
                {severityIcon(alert.severity)}
                <span className="text-sm text-gray-700 flex-1">{alert.message}</span>
                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">
                  {alert.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.alerts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No hay alertas pendientes</p>
        </div>
      )}
    </div>
  );
}
