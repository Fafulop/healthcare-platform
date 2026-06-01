'use client';

import { TrendingUp, TrendingDown, DollarSign, Calendar, Download, X, CreditCard, BarChart3 } from 'lucide-react';
import { type EstadoResultadosData, formatCurrency } from './ledger-utils';
import { FORMAS_DE_PAGO } from './ledger-types';

interface Props {
  estadoResultados: EstadoResultadosData;
  estadoStartDate: string;
  onEstadoStartDateChange: (v: string) => void;
  estadoEndDate: string;
  onEstadoEndDateChange: (v: string) => void;
  onExportPDF: () => void;
}

const FORMA_LABELS: Record<string, string> = Object.fromEntries(
  FORMAS_DE_PAGO.map(f => [f.value, f.label])
);

export function EstadoDeResultados({
  estadoResultados,
  estadoStartDate, onEstadoStartDateChange,
  estadoEndDate, onEstadoEndDateChange,
  onExportPDF,
}: Props) {
  const totalIngresos = Object.values(estadoResultados.ingresos)
    .flatMap(s => Object.values(s))
    .reduce((sum, v) => sum + v, 0);
  const totalEgresos = Object.values(estadoResultados.egresos)
    .flatMap(s => Object.values(s))
    .reduce((sum, v) => sum + v, 0);
  const utilidad = totalIngresos - totalEgresos;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">Periodo:</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 whitespace-nowrap">Desde:</label>
              <input type="date" value={estadoStartDate} onChange={(e) => onEstadoStartDateChange(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-slate-300 focus:border-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 whitespace-nowrap">Hasta:</label>
              <input type="date" value={estadoEndDate} onChange={(e) => onEstadoEndDateChange(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-slate-300 focus:border-slate-400" />
            </div>
            {(estadoStartDate || estadoEndDate) && (
              <button onClick={() => { onEstadoStartDateChange(''); onEstadoEndDateChange(''); }} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" />Limpiar
              </button>
            )}
          </div>
          <button onClick={onExportPDF} className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors ml-auto">
            <Download className="w-3.5 h-3.5" />Exportar PDF
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ESTADO DE RESULTADOS
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* Ingresos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-teal-50 border-b border-teal-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-teal-800 flex items-center gap-2 uppercase tracking-wide">
            <TrendingUp className="w-4 h-4" />Ingresos
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {Object.keys(estadoResultados.ingresos).length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No hay ingresos registrados</p>
          ) : (
            Object.entries(estadoResultados.ingresos).map(([area, subareas]) => {
              const areaTotal = Object.values(subareas).reduce((s, v) => s + v, 0);
              return (
                <div key={area} className="border-l-2 border-teal-400 pl-3">
                  <h3 className="font-semibold text-sm text-gray-900 mb-2">{area}</h3>
                  <div className="space-y-1 ml-3">
                    {Object.entries(subareas).map(([subarea, amount]) => (
                      <div key={subarea} className="flex justify-between items-center py-1.5 border-b border-gray-100">
                        <span className="text-gray-600 text-xs">{subarea}</span>
                        <span className="font-medium text-teal-700 text-xs">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-teal-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-900 text-xs">Total {area}</span>
                    <span className="font-semibold text-teal-700 text-sm">{formatCurrency(areaTotal)}</span>
                  </div>
                </div>
              );
            })
          )}
          {estadoResultados.cuentasPorCobrar > 0 && (
            <div className="bg-amber-50 border-l-2 border-amber-400 p-3 rounded-r">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-amber-900 text-xs">Cuentas por Cobrar</h3>
                  <p className="text-[10px] text-amber-700 mt-0.5">Pendiente de recibir</p>
                </div>
                <span className="font-semibold text-amber-700 text-sm">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
              </div>
            </div>
          )}
          <div className="bg-teal-50 border border-teal-200 p-3 rounded">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-teal-900 text-xs uppercase tracking-wide">Total Ingresos</span>
              <span className="font-bold text-teal-700 text-base">{formatCurrency(totalIngresos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Egresos / Gastos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-rose-700 flex items-center gap-2 uppercase tracking-wide">
            <TrendingDown className="w-4 h-4" />Gastos
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {Object.keys(estadoResultados.egresos).length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No hay gastos registrados</p>
          ) : (
            Object.entries(estadoResultados.egresos).map(([area, subareas]) => {
              const areaTotal = Object.values(subareas).reduce((s, v) => s + v, 0);
              return (
                <div key={area} className="border-l-2 border-rose-400 pl-3">
                  <h3 className="font-semibold text-sm text-gray-900 mb-2">{area}</h3>
                  <div className="space-y-1 ml-3">
                    {Object.entries(subareas).map(([subarea, amount]) => (
                      <div key={subarea} className="flex justify-between items-center py-1.5 border-b border-gray-100">
                        <span className="text-gray-600 text-xs">{subarea}</span>
                        <span className="font-medium text-rose-600 text-xs">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-rose-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-900 text-xs">Total {area}</span>
                    <span className="font-semibold text-rose-600 text-sm">{formatCurrency(areaTotal)}</span>
                  </div>
                </div>
              );
            })
          )}
          {estadoResultados.cuentasPorPagar > 0 && (
            <div className="bg-orange-50 border-l-2 border-orange-400 p-3 rounded-r">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-orange-900 text-xs">Cuentas por Pagar</h3>
                  <p className="text-[10px] text-orange-700 mt-0.5">Pendiente de pagar</p>
                </div>
                <span className="font-semibold text-orange-700 text-sm">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
              </div>
            </div>
          )}
          <div className="bg-rose-50 border border-rose-200 p-3 rounded">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-rose-900 text-xs uppercase tracking-wide">Total Gastos</span>
              <span className="font-bold text-rose-700 text-base">{formatCurrency(totalEgresos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado del Periodo */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
            <DollarSign className="w-4 h-4" />Resultado del Periodo
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 text-xs">Total Ingresos</span>
            <span className="font-semibold text-teal-700 text-sm">{formatCurrency(totalIngresos)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 text-xs">(-) Total Gastos</span>
            <span className="font-semibold text-rose-600 text-sm">{formatCurrency(totalEgresos)}</span>
          </div>
          <div className={`border p-3 rounded mt-2 ${utilidad >= 0 ? 'bg-teal-50 border-teal-300' : 'bg-rose-50 border-rose-300'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold text-sm ${utilidad >= 0 ? 'text-teal-900' : 'text-rose-900'}`}>
                {utilidad >= 0 ? 'Utilidad' : 'Perdida'} del Periodo
              </span>
              <span className={`font-bold text-lg ${utilidad >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                {formatCurrency(utilidad)}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-center">Ingresos cobrados - Gastos pagados</p>
          </div>
          {(estadoResultados.cuentasPorCobrar > 0 || estadoResultados.cuentasPorPagar > 0) && (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded mt-2">
              <h3 className="font-semibold text-purple-900 text-xs mb-2">Flujo Pendiente</h3>
              <div className="space-y-1.5">
                {estadoResultados.cuentasPorCobrar > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-purple-700 text-xs">Por Cobrar:</span>
                    <span className="font-medium text-amber-700 text-xs">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
                  </div>
                )}
                {estadoResultados.cuentasPorPagar > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-purple-700 text-xs">Por Pagar:</span>
                    <span className="font-medium text-orange-700 text-xs">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-purple-200">
                  <span className="font-semibold text-purple-900 text-xs">Resultado proyectado:</span>
                  <span className="font-semibold text-purple-700 text-sm">
                    {formatCurrency(utilidad + estadoResultados.cuentasPorCobrar - estadoResultados.cuentasPorPagar)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FLUJO POR FORMA DE PAGO
         ═══════════════════════════════════════════════════════════════════════ */}

      {Object.keys(estadoResultados.flujoPorFormaPago).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-indigo-800 flex items-center gap-2 uppercase tracking-wide">
              <CreditCard className="w-4 h-4" />Flujo por Forma de Pago
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <th className="px-4 py-2.5 text-left font-semibold">Forma de Pago</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ingresos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gastos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(estadoResultados.flujoPorFormaPago)
                  .sort(([, a], [, b]) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))
                  .map(([forma, data]) => {
                    const neto = data.ingresos - data.egresos;
                    return (
                      <tr key={forma} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900 capitalize">
                          {FORMA_LABELS[forma] || forma}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-teal-700">
                          {data.ingresos > 0 ? formatCurrency(data.ingresos) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-600">
                          {data.egresos > 0 ? formatCurrency(data.egresos) : '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-medium ${neto >= 0 ? 'text-teal-700' : 'text-rose-600'}`}>
                          {formatCurrency(neto)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5 text-gray-900">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-teal-700">{formatCurrency(totalIngresos)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600">{formatCurrency(totalEgresos)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${utilidad >= 0 ? 'text-teal-700' : 'text-rose-600'}`}>
                    {formatCurrency(utilidad)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          COMPARACION MENSUAL
         ═══════════════════════════════════════════════════════════════════════ */}

      {estadoResultados.monthly.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-blue-800 flex items-center gap-2 uppercase tracking-wide">
              <BarChart3 className="w-4 h-4" />Comparacion Mensual
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <th className="px-4 py-2.5 text-left font-semibold">Mes</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ingresos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gastos</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estadoResultados.monthly.map(row => {
                  const balance = row.ingresos - row.egresos;
                  const margin = row.ingresos > 0 ? (balance / row.ingresos) * 100 : 0;
                  return (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-teal-700">{formatCurrency(row.ingresos)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-600">{formatCurrency(row.egresos)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-medium ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${margin >= 0 ? 'text-gray-600' : 'text-orange-700'}`}>
                        {margin.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5 text-gray-900">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-teal-700">{formatCurrency(totalIngresos)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600">{formatCurrency(totalEgresos)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${utilidad >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {utilidad >= 0 ? '+' : ''}{formatCurrency(utilidad)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${totalIngresos > 0 ? 'text-gray-600' : ''}`}>
                    {totalIngresos > 0 ? `${((utilidad / totalIngresos) * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Ingresos por Servicio (supplementary) */}
      {Object.keys(estadoResultados.ingresosByService).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-cyan-50 border-b border-cyan-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-cyan-800 flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="w-4 h-4" />Ingresos por Servicio
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-1">
              {Object.entries(estadoResultados.ingresosByService)
                .sort(([, a], [, b]) => b - a)
                .map(([service, amount]) => {
                  const pct = totalIngresos > 0 ? (amount / totalIngresos) * 100 : 0;
                  return (
                    <div key={service} className="flex items-center gap-3 py-1.5 border-b border-gray-100">
                      <span className="text-gray-700 text-xs flex-1 truncate">{service}</span>
                      <div className="w-24 bg-gray-100 rounded-full h-2 hidden sm:block">
                        <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                      <span className="font-medium text-cyan-700 text-xs w-24 text-right">{formatCurrency(amount)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
