'use client';

import { Filter, Search, ChevronDown } from 'lucide-react';

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  entryTypeFilter: string;
  onEntryTypeChange: (v: string) => void;
  porRealizarFilter: string;
  onPorRealizarChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  originFilter: string;
  onOriginChange: (v: string) => void;
  evidenceFilter: string;
  onEvidenceChange: (v: string) => void;
  serviceFilter: string;
  onServiceChange: (v: string) => void;
  services: { id: string; serviceName: string }[];
  reviewFilter: string;
  onReviewChange: (v: string) => void;
}

export function LedgerFilters({
  searchTerm, onSearchChange,
  entryTypeFilter, onEntryTypeChange,
  porRealizarFilter, onPorRealizarChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  showFilters, onToggleFilters,
  originFilter, onOriginChange,
  evidenceFilter, onEvidenceChange,
  serviceFilter, onServiceChange, services,
  reviewFilter, onReviewChange,
}: Props) {
  const hasActiveFilters = searchTerm || entryTypeFilter !== 'all' || porRealizarFilter !== 'all' || startDate || endDate || originFilter !== 'all' || evidenceFilter !== 'all' || serviceFilter !== 'all' || reviewFilter !== 'all';

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggleFilters}
        className="sm:hidden w-full flex items-center justify-between bg-white rounded-lg shadow px-4 py-3 mb-3"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-base font-semibold text-gray-900">Filtros</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-500 text-white text-xs font-bold rounded-full">●</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter panel */}
      <div className={`bg-white rounded-lg shadow p-4 mb-6 ${!showFilters ? 'hidden sm:block' : 'block'}`}>
        <div className="hidden sm:flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
                placeholder="Concepto o ID..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={entryTypeFilter}
              onChange={(e) => onEntryTypeChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={porRealizarFilter}
              onChange={(e) => onPorRealizarChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="false">Realizados</option>
              <option value="true">Por Realizar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Origen</label>
            <select
              value={originFilter}
              onChange={(e) => onOriginChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="cita">Cita</option>
              <option value="manual">Manual</option>
              <option value="venta">Venta</option>
              <option value="compra">Compra</option>
              <option value="sat_recibido">SAT Recibido</option>
              <option value="sat_emitido">SAT Emitido</option>
              <option value="banco">Banco</option>
              <option value="webhook_pago">Pago Online</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Evidencia</label>
            <select
              value={evidenceFilter}
              onChange={(e) => onEvidenceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="con_comprobante">Con comprobante</option>
              <option value="sin_comprobante">Sin comprobante</option>
              <option value="con_factura">Con factura</option>
              <option value="sin_factura">Sin factura</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Revisión</label>
            <select
              value={reviewFilter}
              onChange={(e) => onReviewChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="needs_review">Por revisar</option>
              <option value="reviewed">Revisados</option>
            </select>
          </div>

          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Servicio</label>
              <select
                value={serviceFilter}
                onChange={(e) => onServiceChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="none">Sin servicio</option>
                {services.map(svc => (
                  <option key={svc.id} value={svc.serviceName}>{svc.serviceName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </>
  );
}
