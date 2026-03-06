'use client';

import { TrendingUp, TrendingDown, DollarSign, Calendar, Download, X } from 'lucide-react';
import { type EstadoResultadosData, formatCurrency } from './ledger-utils';

interface Props {
  estadoResultados: EstadoResultadosData;
  estadoStartDate: string;
  onEstadoStartDateChange: (v: string) => void;
  estadoEndDate: string;
  onEstadoEndDateChange: (v: string) => void;
  onExportPDF: () => void;
}

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

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">Período:</span>
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
                        <span className="text-gray-600 text-xs">└── {subarea}</span>
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
                  <h3 className="font-medium text-amber-900 text-xs flex items-center gap-1.5">💵 Cuentas por Cobrar</h3>
                  <p className="text-[10px] text-amber-700 mt-0.5">Monto pendiente de recibir</p>
                </div>
                <span className="font-semibold text-amber-700 text-sm">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
              </div>
            </div>
          )}
          <div className="bg-teal-50 border border-teal-200 p-3 rounded">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-teal-900 text-xs uppercase tracking-wide">Total Ingresos Realizados</span>
              <span className="font-bold text-teal-700 text-base">{formatCurrency(totalIngresos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Egresos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-rose-700 flex items-center gap-2 uppercase tracking-wide">
            <TrendingDown className="w-4 h-4" />Egresos
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {Object.keys(estadoResultados.egresos).length === 0 ? (
            <p className="text-center text-gray-500 py-4 text-sm">No hay egresos registrados</p>
          ) : (
            Object.entries(estadoResultados.egresos).map(([area, subareas]) => {
              const areaTotal = Object.values(subareas).reduce((s, v) => s + v, 0);
              return (
                <div key={area} className="border-l-2 border-rose-400 pl-3">
                  <h3 className="font-semibold text-sm text-gray-900 mb-2">{area}</h3>
                  <div className="space-y-1 ml-3">
                    {Object.entries(subareas).map(([subarea, amount]) => (
                      <div key={subarea} className="flex justify-between items-center py-1.5 border-b border-gray-100">
                        <span className="text-gray-600 text-xs">└── {subarea}</span>
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
                  <h3 className="font-medium text-orange-900 text-xs flex items-center gap-1.5">💳 Cuentas por Pagar</h3>
                  <p className="text-[10px] text-orange-700 mt-0.5">Monto pendiente de pagar</p>
                </div>
                <span className="font-semibold text-orange-700 text-sm">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
              </div>
            </div>
          )}
          <div className="bg-rose-50 border border-rose-200 p-3 rounded">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-rose-900 text-xs uppercase tracking-wide">Total Egresos Realizados</span>
              <span className="font-bold text-rose-700 text-base">{formatCurrency(totalEgresos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance General */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
            <DollarSign className="w-4 h-4" />Balance General
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 text-xs">Total Ingresos Realizados</span>
            <span className="font-semibold text-teal-700 text-sm">{formatCurrency(totalIngresos)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 text-xs">Total Egresos Realizados</span>
            <span className="font-semibold text-rose-600 text-sm">{formatCurrency(totalEgresos)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-300 p-3 rounded mt-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900 text-sm">Balance Neto</span>
              <span className="font-bold text-slate-700 text-base">{formatCurrency(totalIngresos - totalEgresos)}</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-1 text-center">Ingresos Realizados - Egresos Realizados</p>
          </div>
          {(estadoResultados.cuentasPorCobrar > 0 || estadoResultados.cuentasPorPagar > 0) && (
            <div className="bg-purple-50 border border-purple-300 p-3 rounded mt-2">
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
                <div className="flex justify-between items-center pt-1.5 border-t border-purple-300">
                  <span className="font-semibold text-purple-900 text-xs">Diferencia:</span>
                  <span className="font-semibold text-purple-700 text-sm">{formatCurrency(estadoResultados.cuentasPorCobrar - estadoResultados.cuentasPorPagar)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
