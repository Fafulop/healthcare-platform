"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, ShoppingCart } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { useCotizacionesPage } from './_components/useCotizacionesPage';
import { QuotationsTable } from './_components/QuotationsTable';
import { PaginationControls } from '@/components/ui/PaginationControls';

export default function CotizacionesPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const {
    quotations, loading, search, setSearch, statusFilter, setStatusFilter,
    updatingId, toastMessage, setToastMessage, error,
    selectedIds, filteredQuotations,
    fetchQuotations, fetchDoctorProfile,
    handleDelete, handleConvertToSale, handleQuotationStatusChange,
    toggleSelect, toggleSelectAll, handleExportPDF, deselectAll,
    formatDate, formatCurrency, isExpiringSoon, isExpired,
    page, setPage, pagination,
  } = useCotizacionesPage();

  useEffect(() => {
    fetchQuotations(statusFilter, page);
    if (session?.user?.doctorId) fetchDoctorProfile(session.user.doctorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando cotizaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cotizaciones</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestiona las cotizaciones para tus clientes</p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/practice/ventas" className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold">
                <ShoppingCart className="w-5 h-5" /><span className="hidden sm:inline">Ventas</span>
              </Link>
              <Link href="/dashboard/practice/cotizaciones/new" className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold">
                <Plus className="w-5 h-5" /><span className="hidden sm:inline">Nueva</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por folio o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los Estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviada</option>
              <option value="APPROVED">Aprobada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="EXPIRED">Vencida</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <QuotationsTable
          quotations={filteredQuotations}
          allCount={pagination?.total ?? quotations.length}
          search={search}
          statusFilter={statusFilter}
          selectedIds={selectedIds}
          updatingId={updatingId}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onStatusChange={handleQuotationStatusChange}
          onConvertToSale={handleConvertToSale}
          onDelete={handleDelete}
          onExportPDF={handleExportPDF}
          onDeselect={deselectAll}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          isExpiringSoon={isExpiringSoon}
          isExpired={isExpired}
        />
        {pagination && (
          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        )}
      </div>

      {toastMessage && (
        <Toast message={toastMessage.message} type={toastMessage.type} onClose={() => setToastMessage(null)} />
      )}
    </>
  );
}
