'use client';

import Link from 'next/link';
import { Edit2, Eye, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getLocalDateString } from '@/lib/dates';
import type { LedgerEntry, Area } from './ledger-types';
import { FORMAS_DE_PAGO } from './ledger-types';
import { formatCurrency, formatDate, cleanConcept, getAvailableAreasForEntry } from './ledger-utils';

interface Props {
  filteredEntries: LedgerEntry[];
  areas: Area[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  showAllEntries: boolean;
  onShowAllEntriesChange: (v: boolean) => void;
  ledgerDate: string;
  onLedgerDateChange: (v: string) => void;
  onViewEntry: (entry: LedgerEntry) => void;
  todayStr: string;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (col: string) => void;
  onRefresh: () => void;
  // Inline editing — area
  editingAreaId: number | null;
  editingAreaData: { area: string; subarea: string };
  onEditAreaDataChange: (data: { area: string; subarea: string }) => void;
  updatingArea: boolean;
  onStartEditArea: (entry: LedgerEntry) => void;
  onSaveArea: (id: number) => void;
  onCancelEditArea: () => void;
  // Inline editing — forma de pago
  editingFormaPagoId: number | null;
  editingFormaPagoValue: string;
  onEditFormaPagoValueChange: (v: string) => void;
  updatingFormaPago: boolean;
  onStartEditFormaPago: (entry: LedgerEntry) => void;
  onSaveFormaPago: (id: number) => void;
  onCancelEditFormaPago: () => void;
  // Inline editing — amount paid
  editingAmountPaidId: number | null;
  editingAmountPaidValue: string;
  onEditAmountPaidValueChange: (v: string) => void;
  updatingAmountPaid: boolean;
  onStartEditAmountPaid: (entry: LedgerEntry) => void;
  onSaveAmountPaid: (id: number, total: string) => void;
  onCancelEditAmountPaid: () => void;
}

function SortIcon({ column, sortColumn, sortDirection }: { column: string; sortColumn: string | null; sortDirection: 'asc' | 'desc' }) {
  if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
  return sortDirection === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 text-slate-600" />
    : <ArrowDown className="w-3 h-3 ml-1 text-slate-600" />;
}

export function LedgerTable({
  filteredEntries, areas, selectedIds, onToggleSelect, onToggleSelectAll,
  showAllEntries, onShowAllEntriesChange, ledgerDate, onLedgerDateChange,
  onViewEntry, todayStr, sortColumn, sortDirection, onSort, onRefresh,
  editingAreaId, editingAreaData, onEditAreaDataChange, updatingArea, onStartEditArea, onSaveArea, onCancelEditArea,
  editingFormaPagoId, editingFormaPagoValue, onEditFormaPagoValueChange, updatingFormaPago, onStartEditFormaPago, onSaveFormaPago, onCancelEditFormaPago,
  editingAmountPaidId, editingAmountPaidValue, onEditAmountPaidValueChange, updatingAmountPaid, onStartEditAmountPaid, onSaveAmountPaid, onCancelEditAmountPaid,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Day Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
          {showAllEntries ? 'Todos los Movimientos' : 'Movimientos del Día'}
        </h3>
        <div className="flex items-center gap-1.5">
          {!showAllEntries && (
            <>
              <button
                onClick={() => {
                  const d = new Date(ledgerDate + 'T12:00:00');
                  d.setDate(d.getDate() - 1);
                  onLedgerDateChange(getLocalDateString(d));
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={ledgerDate}
                onChange={(e) => onLedgerDateChange(e.target.value)}
                className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300 w-[140px]"
              />
              <button
                onClick={() => {
                  const d = new Date(ledgerDate + 'T12:00:00');
                  d.setDate(d.getDate() + 1);
                  onLedgerDateChange(getLocalDateString(d));
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {ledgerDate !== todayStr && (
                <button
                  onClick={() => onLedgerDateChange(todayStr)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Hoy
                </button>
              )}
            </>
          )}
          <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
            {filteredEntries.length} movimiento{filteredEntries.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onShowAllEntriesChange(!showAllEntries)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showAllEntries ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showAllEntries ? 'Por dia' : 'Ver todos'}
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden p-3 space-y-3">
        {filteredEntries.length > 0 && (
          <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
            <input
              type="checkbox"
              checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
              onChange={onToggleSelectAll}
              className="w-5 h-5 text-slate-600 border-gray-300 rounded focus:ring-slate-300 cursor-pointer"
            />
            <span className="text-sm text-gray-600">Seleccionar todos</span>
          </div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="font-medium">
              {showAllEntries ? 'No hay movimientos' : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className={`border rounded-lg p-3 ${selectedIds.has(entry.id) ? 'border-slate-400 bg-slate-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => onToggleSelect(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-slate-600 border-gray-300 rounded focus:ring-slate-300 cursor-pointer"
                  />
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    entry.entryType === 'ingreso' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {entry.entryType === 'ingreso' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  </span>
                </div>
                <span className={`font-bold text-base ${entry.entryType === 'ingreso' ? 'text-teal-700' : 'text-rose-600'}`}>
                  {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-900 mt-1.5 truncate">{cleanConcept(entry.concept)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(entry.transactionDate)} · {entry.area}{entry.subarea ? ` / ${entry.subarea}` : ''}
              </p>

              {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    entry.transactionType === 'VENTA' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {entry.transactionType === 'VENTA' ? 'Venta' : 'Compra'}
                  </span>
                  {(entry.client || entry.supplier) && (
                    <span className="text-xs text-gray-600">{entry.client?.businessName || entry.supplier?.businessName}</span>
                  )}
                  {entry.paymentStatus && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      entry.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                      entry.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {entry.paymentStatus === 'PAID' ? 'Pagado' : entry.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                    </span>
                  )}
                </div>
              )}

              {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
                <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                  <span>Pagado: <span className="font-semibold text-teal-700">{formatCurrency(entry.amountPaid || '0')}</span></span>
                  <span>Saldo: <span className={`font-semibold ${(parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')) === 0 ? 'text-teal-700' : 'text-rose-600'}`}>
                    {formatCurrency((parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')).toString())}
                  </span></span>
                </div>
              )}

              <div className="flex items-center justify-end mt-2.5 pt-2.5 border-t border-gray-100">
                <div className="flex gap-1">
                  <button onClick={() => onViewEntry(entry)} className="text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                    <Eye className="w-4 h-4" />
                  </button>
                  <Link href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`} className="text-slate-600 p-1.5 rounded-lg hover:bg-slate-50">
                    <Edit2 className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-center w-12 sticky left-0 z-20 bg-gray-50">
                <input
                  type="checkbox"
                  checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-300 cursor-pointer"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky left-[48px] z-20 bg-gray-50" onClick={() => onSort('fecha')}>
                <div className="flex items-center">Fecha<SortIcon column="fecha" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[152px] z-20 bg-gray-50 border-r border-gray-200">
                Acciones
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('tipo')}>
                <div className="flex items-center">Tipo<SortIcon column="tipo" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('monto')}>
                <div className="flex items-center justify-end">Monto<SortIcon column="monto" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => onSort('area')}>
                <div className="flex items-center">Área<SortIcon column="area" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('concepto')}>
                <div className="flex items-center">Concepto<SortIcon column="concepto" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('estadoPago')}>
                <div className="flex items-center justify-center">Estado Pago<SortIcon column="estadoPago" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => onSort('formaDePago')}>
                <div className="flex items-center">Forma de Pago<SortIcon column="formaDePago" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-teal-700 uppercase tracking-wider bg-teal-50 cursor-pointer hover:bg-teal-100 transition-colors" onClick={() => onSort('cobrado')}>
                <div className="flex items-center justify-end">Cobrado<SortIcon column="cobrado" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">Por Cobrar</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-teal-700 uppercase tracking-wider bg-teal-50 cursor-pointer hover:bg-teal-100 transition-colors" onClick={() => onSort('pagado')}>
                <div className="flex items-center justify-end">Pagado<SortIcon column="pagado" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-rose-600 uppercase tracking-wider">Por Pagar</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('paciente')}>
                <div className="flex items-center">Paciente<SortIcon column="paciente" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort('proveedor')}>
                <div className="flex items-center">Proveedor<SortIcon column="proveedor" sortColumn={sortColumn} sortDirection={sortDirection} /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">
                    {showAllEntries ? 'No hay movimientos registrados' : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
                  </p>
                  {showAllEntries && <p className="text-sm mt-1">Crea tu primer movimiento para comenzar</p>}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                  {/* Checkbox */}
                  <td className="px-4 py-4 text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50">
                    <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => onToggleSelect(entry.id)} className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-300 cursor-pointer" />
                  </td>
                  {/* Fecha */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 sticky left-[48px] z-10 bg-white group-hover:bg-gray-50">
                    {formatDate(entry.transactionDate)}
                  </td>
                  {/* Acciones */}
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium sticky left-[152px] z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onViewEntry(entry)} className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-lg transition-colors" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                      <Link href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`} className="text-slate-600 hover:text-slate-800 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                  {/* Tipo */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      entry.entryType === 'ingreso' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {entry.entryType === 'ingreso' ? <><TrendingUp className="w-3 h-3" />Ingreso</> : <><TrendingDown className="w-3 h-3" />Egreso</>}
                    </span>
                  </td>
                  {/* Monto */}
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${entry.entryType === 'ingreso' ? 'text-teal-700' : 'text-rose-600'}`}>
                    {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                  </td>
                  {/* Área — inline editable */}
                  <td className="px-6 py-4 text-sm bg-amber-50">
                    {editingAreaId === entry.id ? (
                      <div className="space-y-2 min-w-[200px]">
                        <select
                          value={editingAreaData.area ?? ''}
                          onChange={(e) => onEditAreaDataChange({ area: e.target.value, subarea: '' })}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
                          disabled={updatingArea}
                        >
                          <option value="">Seleccionar área...</option>
                          {getAvailableAreasForEntry(entry, areas).map(a => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                        {editingAreaData.area && (() => {
                          const selectedArea = getAvailableAreasForEntry(entry, areas).find(a => a.name === editingAreaData.area);
                          return selectedArea && selectedArea.subareas.length > 0 ? (
                            <select
                              value={editingAreaData.subarea ?? ''}
                              onChange={(e) => onEditAreaDataChange({ ...editingAreaData, subarea: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
                              disabled={updatingArea}
                            >
                              <option value="">Seleccionar subárea...</option>
                              {selectedArea.subareas.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-gray-400 italic">No hay subáreas disponibles</div>
                          );
                        })()}
                        <div className="flex items-center gap-2">
                          <button onClick={() => onSaveArea(entry.id)} disabled={updatingArea || !editingAreaData.area} className="px-3 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {updatingArea ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button onClick={onCancelEditArea} disabled={updatingArea} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-600 cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors group" onClick={() => onStartEditArea(entry)} title="Click para editar área y subárea">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm">{entry.area}</div>
                            <div className="text-xs text-gray-500">{entry.subarea}</div>
                          </div>
                          <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                  </td>
                  {/* Concepto */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={cleanConcept(entry.concept)}>{cleanConcept(entry.concept)}</div>
                    {entry.bankAccount && <div className="text-xs text-gray-500 mt-1">{entry.bankAccount}</div>}
                  </td>
                  {/* Estado Pago */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {entry.paymentStatus === 'PAID' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Pagado</span>}
                    {entry.paymentStatus === 'PARTIAL' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Parcial</span>}
                    {entry.paymentStatus === 'PENDING' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pendiente</span>}
                    {!entry.paymentStatus && <span className="text-xs text-gray-400">-</span>}
                  </td>
                  {/* Forma de Pago — inline editable */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm bg-amber-50">
                    {editingFormaPagoId === entry.id ? (
                      <div className="flex items-center gap-2">
                        <select value={editingFormaPagoValue} onChange={(e) => onEditFormaPagoValueChange(e.target.value)} className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent" disabled={updatingFormaPago} autoFocus>
                          <option value="">Seleccionar...</option>
                          {FORMAS_DE_PAGO.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                        </select>
                        <button onClick={() => onSaveFormaPago(entry.id)} disabled={updatingFormaPago || !editingFormaPagoValue} className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                          {updatingFormaPago ? '...' : '✓'}
                        </button>
                        <button onClick={onCancelEditFormaPago} disabled={updatingFormaPago} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">✕</button>
                      </div>
                    ) : (
                      <div className="text-gray-700 capitalize cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-between gap-2" onClick={() => onStartEditFormaPago(entry)} title="Click para editar forma de pago">
                        <span>{entry.formaDePago || <span className="text-gray-400">-</span>}</span>
                        <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>
                  {/* Cobrado (ingresos) — inline editable */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm bg-teal-50">
                    {entry.entryType === 'ingreso' ? (
                      editingAmountPaidId === entry.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-500">$</span>
                          <input type="number" step="0.01" min="0" max={entry.amount} value={editingAmountPaidValue} onChange={(e) => onEditAmountPaidValueChange(e.target.value)} className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent" disabled={updatingAmountPaid} autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') onSaveAmountPaid(entry.id, entry.amount); if (e.key === 'Escape') onCancelEditAmountPaid(); }}
                          />
                          <button onClick={() => onSaveAmountPaid(entry.id, entry.amount)} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50">{updatingAmountPaid ? '...' : '✓'}</button>
                          <button onClick={onCancelEditAmountPaid} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">✕</button>
                        </div>
                      ) : (
                        <div className="font-medium text-teal-700 cursor-pointer hover:bg-teal-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-end gap-1" onClick={() => onStartEditAmountPaid(entry)} title="Click para editar monto cobrado">
                          <span>{formatCurrency(entry.amountPaid || '0')}</span>
                          <Edit2 className="w-3 h-3 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  {/* Por Cobrar */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {entry.entryType === 'ingreso' ? (() => {
                      const bal = parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0');
                      return bal > 0 ? <span className="font-semibold text-orange-600">{formatCurrency(bal.toString())}</span> : <span className="text-xs text-gray-400">-</span>;
                    })() : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  {/* Pagado (egresos) — inline editable */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm bg-teal-50">
                    {entry.entryType === 'egreso' ? (
                      editingAmountPaidId === entry.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-500">$</span>
                          <input type="number" step="0.01" min="0" max={entry.amount} value={editingAmountPaidValue} onChange={(e) => onEditAmountPaidValueChange(e.target.value)} className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent" disabled={updatingAmountPaid} autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') onSaveAmountPaid(entry.id, entry.amount); if (e.key === 'Escape') onCancelEditAmountPaid(); }}
                          />
                          <button onClick={() => onSaveAmountPaid(entry.id, entry.amount)} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50">{updatingAmountPaid ? '...' : '✓'}</button>
                          <button onClick={onCancelEditAmountPaid} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">✕</button>
                        </div>
                      ) : (
                        <div className="font-medium text-teal-700 cursor-pointer hover:bg-teal-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-end gap-1" onClick={() => onStartEditAmountPaid(entry)} title="Click para editar monto pagado">
                          <span>{formatCurrency(entry.amountPaid || '0')}</span>
                          <Edit2 className="w-3 h-3 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  {/* Por Pagar */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {entry.entryType === 'egreso' ? (() => {
                      const bal = parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0');
                      return bal > 0 ? <span className="font-semibold text-rose-600">{formatCurrency(bal.toString())}</span> : <span className="text-xs text-gray-400">-</span>;
                    })() : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  {/* Paciente */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.client ? <div className="max-w-xs truncate" title={entry.client.businessName}>{entry.client.businessName}</div> : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  {/* Proveedor */}
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.supplier ? <div className="max-w-xs truncate" title={entry.supplier.businessName}>{entry.supplier.businessName}</div> : <span className="text-xs text-gray-400">-</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {filteredEntries.length > 0 && (
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Total: <strong>{filteredEntries.length}</strong> movimiento{filteredEntries.length !== 1 ? 's' : ''}
            </span>
            <button onClick={onRefresh} className="text-slate-600 hover:text-slate-700 font-medium">
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
