'use client';

import Link from 'next/link';
import { Loader2, Plus, FolderTree } from 'lucide-react';
import { useLedgerPage } from './_components/useLedgerPage';
import { BalanceSummaryCards } from './_components/BalanceSummaryCards';
import { LedgerFilters } from './_components/LedgerFilters';
import { BatchActionBar } from './_components/BatchActionBar';
import { LedgerTable } from './_components/LedgerTable';
import { EstadoDeResultados } from './_components/EstadoDeResultados';
import { EntryDetailModal } from './_components/EntryDetailModal';

export default function FlujoDeDineroPage() {
  const page = useLedgerPage();

  if (page.sessionStatus === 'loading' || page.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando flujo de dinero...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Flujo de Dinero</h1>
            <p className="text-gray-600 mt-1">Gestiona tus ingresos y egresos</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/practice/areas" className="flex items-center gap-1.5 sm:gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold px-3 sm:px-4 py-2 rounded-md transition-colors text-sm sm:text-base">
              <FolderTree className="w-4 h-4 sm:w-5 sm:h-5" />
              Áreas
            </Link>
            <Link href="/dashboard/practice/flujo-de-dinero/new" className="flex items-center gap-1.5 sm:gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-3 sm:px-4 py-2 rounded-md transition-colors text-sm sm:text-base">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Nuevo Movimiento
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {(['movimientos', 'estado-resultados'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => page.setActiveTab(tab)}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-colors text-sm sm:text-base ${
                  page.activeTab === tab
                    ? 'text-slate-700 border-b-2 border-slate-500 bg-slate-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab === 'movimientos' ? 'Movimientos' : 'Estado de Resultados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Movimientos */}
      {page.activeTab === 'movimientos' && (
        <>
          <BalanceSummaryCards balance={page.balance} />

          <LedgerFilters
            searchTerm={page.searchTerm} onSearchChange={page.setSearchTerm}
            entryTypeFilter={page.entryTypeFilter} onEntryTypeChange={page.setEntryTypeFilter}
            porRealizarFilter={page.porRealizarFilter} onPorRealizarChange={page.setPorRealizarFilter}
            startDate={page.startDate} onStartDateChange={page.setStartDate}
            endDate={page.endDate} onEndDateChange={page.setEndDate}
            showFilters={page.showFilters} onToggleFilters={() => page.setShowFilters(v => !v)}
          />

          <BatchActionBar
            count={page.selectedIds.size}
            deletingBatch={page.deletingBatch}
            onClear={page.clearSelection}
            onDelete={page.handleBatchDelete}
            onExportPDF={page.handleExportPDF}
          />

          <LedgerTable
            filteredEntries={page.filteredEntries}
            areas={page.areas}
            selectedIds={page.selectedIds}
            onToggleSelect={page.toggleSelect}
            onToggleSelectAll={page.toggleSelectAll}
            showAllEntries={page.showAllEntries}
            onShowAllEntriesChange={page.setShowAllEntries}
            ledgerDate={page.ledgerDate}
            onLedgerDateChange={page.setLedgerDate}
            onViewEntry={page.setModalEntry}
            todayStr={page.todayStr}
            sortColumn={page.sortColumn}
            sortDirection={page.sortDirection}
            onSort={page.handleSort}
            onRefresh={page.fetchEntries}
            editingAreaId={page.editingAreaId}
            editingAreaData={page.editingAreaData}
            onEditAreaDataChange={page.setEditingAreaData}
            updatingArea={page.updatingArea}
            onStartEditArea={page.handleStartEditArea}
            onSaveArea={page.handleSaveArea}
            onCancelEditArea={page.handleCancelEditArea}
            editingFormaPagoId={page.editingFormaPagoId}
            editingFormaPagoValue={page.editingFormaPagoValue}
            onEditFormaPagoValueChange={page.setEditingFormaPagoValue}
            updatingFormaPago={page.updatingFormaPago}
            onStartEditFormaPago={page.handleStartEditFormaPago}
            onSaveFormaPago={page.handleSaveFormaPago}
            onCancelEditFormaPago={page.handleCancelEditFormaPago}
            editingAmountPaidId={page.editingAmountPaidId}
            editingAmountPaidValue={page.editingAmountPaidValue}
            onEditAmountPaidValueChange={page.setEditingAmountPaidValue}
            updatingAmountPaid={page.updatingAmountPaid}
            onStartEditAmountPaid={page.handleStartEditAmountPaid}
            onSaveAmountPaid={page.handleSaveAmountPaid}
            onCancelEditAmountPaid={page.handleCancelEditAmountPaid}
          />
        </>
      )}

      {/* Estado de Resultados */}
      {page.activeTab === 'estado-resultados' && (
        <EstadoDeResultados
          estadoResultados={page.estadoResultados}
          estadoStartDate={page.estadoStartDate}
          onEstadoStartDateChange={page.setEstadoStartDate}
          estadoEndDate={page.estadoEndDate}
          onEstadoEndDateChange={page.setEstadoEndDate}
          onExportPDF={page.handleExportEstadoResultadosPDF}
        />
      )}

      {/* Entry Detail Modal */}
      {page.modalEntry && (
        <EntryDetailModal entry={page.modalEntry} onClose={() => page.setModalEntry(null)} />
      )}
    </div>
  );
}
