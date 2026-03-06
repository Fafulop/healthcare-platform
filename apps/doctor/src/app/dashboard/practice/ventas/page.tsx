"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, FileText, Users } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { useVentasPage } from './_components/useVentasPage';
import { SalesTable } from './_components/SalesTable';
import { PaginationControls } from '@/components/ui/PaginationControls';

export default function VentasPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const {
    loading, searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    paymentFilter, setPaymentFilter, toastMessage, setToastMessage,
    selectedIds, filteredSales, totalSales, totalPaid, totalPending,
    updatingId, editingAmountPaidId, editingAmountPaidValue, setEditingAmountPaidValue, updatingAmountPaid,
    fetchSales, fetchDoctorProfile,
    handleDelete, handleSaleStatusChange,
    handleStartEditAmountPaid, handleSaveAmountPaid, handleCancelEditAmountPaid,
    toggleSelect, toggleSelectAll, handleExportPDF, deselectAll,
    formatDate, formatCurrency,
    page, setPage, pagination,
  } = useVentasPage();

  useEffect(() => {
    if (session?.user?.email) {
      fetchSales(statusFilter, paymentFilter, page);
      if (session.user?.doctorId) fetchDoctorProfile(session.user.doctorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter, page]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando ventas...</p>
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ventas en Firme</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestiona tus ventas confirmadas</p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/practice/clients" className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors font-semibold">
                <Users className="w-5 h-5" /><span className="hidden sm:inline">Clientes</span>
              </Link>
              <Link href="/dashboard/practice/cotizaciones" className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold">
                <FileText className="w-5 h-5" /><span className="hidden sm:inline">Cotizaciones</span>
              </Link>
              <Link href="/dashboard/practice/ventas/new" className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold">
                <Plus className="w-5 h-5" /><span className="hidden sm:inline">Nueva Venta</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Ventas</div>
            <div className="text-sm sm:text-2xl font-bold text-gray-900">{formatCurrency(totalSales)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Cobrado</div>
            <div className="text-sm sm:text-2xl font-bold text-blue-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Pendiente</div>
            <div className="text-sm sm:text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número o paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="PROCESSING">En Proceso</option>
              <option value="SHIPPED">Enviada</option>
              <option value="DELIVERED">Entregada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los pagos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagada</option>
            </select>
          </div>
        </div>

        <SalesTable
          sales={filteredSales}
          selectedIds={selectedIds}
          updatingId={updatingId}
          editingAmountPaidId={editingAmountPaidId}
          editingAmountPaidValue={editingAmountPaidValue}
          updatingAmountPaid={updatingAmountPaid}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onSaleStatusChange={handleSaleStatusChange}
          onStartEditAmountPaid={handleStartEditAmountPaid}
          onSaveAmountPaid={handleSaveAmountPaid}
          onEditAmountPaidValueChange={setEditingAmountPaidValue}
          onCancelEditAmountPaid={handleCancelEditAmountPaid}
          onDelete={handleDelete}
          onExportPDF={handleExportPDF}
          onDeselect={deselectAll}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
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
