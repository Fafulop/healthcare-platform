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
}

export function LedgerFilters({
  searchTerm, onSearchChange,
  entryTypeFilter, onEntryTypeChange,
  porRealizarFilter, onPorRealizarChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  showFilters, onToggleFilters,
}: Props) {
  const hasActiveFilters = searchTerm || entryTypeFilter !== 'all' || porRealizarFilter !== 'all' || startDate || endDate;

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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
