"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Package, Eye, Truck, Download, CheckSquare } from "lucide-react";
import InlineStatusSelect from "@/components/practice/InlineStatusSelect";
import Toast, { ToastType } from "@/components/ui/Toast";
import { validatePurchaseTransition, PurchaseStatus } from "@/lib/practice/statusTransitions";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Supplier {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface Purchase {
  id: number;
  purchaseNumber: string;
  purchaseDate: string;
  deliveryDate: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string;
  tax: string | null;
  total: string;
  amountPaid: string;
  supplier: Supplier;
}

const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: '✅' }
};

export default function ComprasPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [doctorProfile, setDoctorProfile] = useState<{ id: string; slug: string; primarySpecialty: string } | null>(null);

  // Inline editing for Pagado (amountPaid)
  const [editingAmountPaidId, setEditingAmountPaidId] = useState<number | null>(null);
  const [editingAmountPaidValue, setEditingAmountPaidValue] = useState<string>('');
  const [updatingAmountPaid, setUpdatingAmountPaid] = useState(false);

  useEffect(() => {
    fetchPurchases();
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();
      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) setDoctorProfile(doctor);
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter);

      const response = await authFetch(`${API_URL}/api/practice-management/compras?${params}`);

      if (!response.ok) throw new Error('Error al cargar compras');
      const result = await response.json();
      setPurchases(result.data || []);
    } catch (err) {
      console.error('Error al cargar compras:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta compra?')) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/compras/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar compra');
      fetchPurchases();
    } catch (err) {
      console.error('Error al eliminar compra:', err);
      alert('Error al eliminar compra');
    }
  };

  const handlePurchaseStatusChange = async (purchaseId: number, oldStatus: string, newStatus: string) => {
    const validation = validatePurchaseTransition(oldStatus as PurchaseStatus, newStatus as PurchaseStatus);

    if (!validation.allowed) {
      setToastMessage({ message: validation.errorMessage || 'Transición no permitida', type: 'error' });
      return;
    }

    if (validation.requiresConfirmation && validation.confirmationMessage) {
      if (!confirm(validation.confirmationMessage)) {
        return;
      }
    }

    setPurchases(prev => prev.map(s =>
      s.id === purchaseId ? { ...s, status: newStatus } : s
    ));
    setUpdatingId(purchaseId);

    try {
      const fetchResponse = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`);

      if (!fetchResponse.ok) {
        throw new Error('Error al obtener compra');
      }

      const currentData = await fetchResponse.json();

      const updateResponse = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...currentData.data,
          status: newStatus
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Error al actualizar estado');
      }

      await fetchPurchases();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      setPurchases(prev => prev.map(s =>
        s.id === purchaseId ? { ...s, status: oldStatus } : s
      ));

      const errorMessage = error.message.includes('permisos')
        ? 'No tienes permisos para cambiar el estado'
        : error.message.includes('conectar')
        ? 'No se pudo conectar. Verifica tu conexión.'
        : 'Error al actualizar estado. Intenta de nuevo.';

      setToastMessage({ message: errorMessage, type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartEditAmountPaid = (purchase: Purchase) => {
    setEditingAmountPaidId(purchase.id);
    setEditingAmountPaidValue(purchase.amountPaid || '0');
  };

  const handleSaveAmountPaid = async (purchaseId: number, totalAmount: string) => {
    if (!session?.user?.email) return;

    const amountPaid = parseFloat(editingAmountPaidValue) || 0;
    const total = parseFloat(totalAmount) || 0;

    // Validate amount doesn't exceed total
    if (amountPaid > total) {
      setToastMessage({ message: 'El monto pagado no puede ser mayor al total', type: 'error' });
      return;
    }

    if (amountPaid < 0) {
      setToastMessage({ message: 'El monto no puede ser negativo', type: 'error' });
      return;
    }

    setUpdatingAmountPaid(true);

    // Determine payment status based on amount paid
    let paymentStatus: string;
    if (amountPaid === 0) {
      paymentStatus = 'PENDING';
    } else if (amountPaid >= total) {
      paymentStatus = 'PAID';
    } else {
      paymentStatus = 'PARTIAL';
    }

    try {
      // Fetch current purchase data
      const fetchResponse = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`);

      if (!fetchResponse.ok) {
        throw new Error('Error al obtener compra');
      }

      const currentData = await fetchResponse.json();

      // Update with new amountPaid
      const updateResponse = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...currentData.data,
          amountPaid: amountPaid,
          paymentStatus: paymentStatus
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Error al actualizar monto');
      }

      // Refresh list
      await fetchPurchases();
      setToastMessage({ message: 'Monto actualizado exitosamente', type: 'success' });

      // Reset editing state
      setEditingAmountPaidId(null);
      setEditingAmountPaidValue('');
    } catch (error: any) {
      const errorMessage = error.message.includes('permisos')
        ? 'No tienes permisos para actualizar el monto'
        : error.message.includes('conectar')
        ? 'No se pudo conectar. Verifica tu conexión.'
        : 'Error al actualizar monto. Intenta de nuevo.';

      setToastMessage({ message: errorMessage, type: 'error' });
    } finally {
      setUpdatingAmountPaid(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPurchases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPurchases.map(p => p.id)));
    }
  };

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;

    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const selectedPurchases = filteredPurchases.filter(p => selectedIds.has(p.id));

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Compras', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);

    if (doctorProfile) {
      doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, 34);
    }

    // Table data
    const tableData = selectedPurchases.map(purchase => {
      const total = parseFloat(purchase.total);
      const paid = parseFloat(purchase.amountPaid || '0');
      const pending = total - paid;
      const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
      const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

      return [
        purchase.purchaseNumber,
        purchase.supplier.businessName,
        formatDate(purchase.purchaseDate),
        formatCurrency(purchase.total),
        formatCurrency(purchase.amountPaid),
        pending > 0 ? formatCurrency(pending.toString()) : '-',
        paymentConf.label,
        statusConf.label,
      ];
    });

    autoTable(doc, {
      startY: doctorProfile ? 40 : 34,
      head: [['Folio', 'Proveedor', 'Fecha', 'Total', 'Pagado', 'Por Pagar', 'Estado Pago', 'Estado']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });

    // Summary
    const yPosition = (doc as any).lastAutoTable.finalY + 10;
    const totalCompras = selectedPurchases.reduce((sum, p) => sum + parseFloat(p.total), 0);
    const totalPagado = selectedPurchases.reduce((sum, p) => sum + parseFloat(p.amountPaid || '0'), 0);
    const totalPorPagar = totalCompras - totalPagado;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de compras: ${selectedPurchases.length}`, 14, yPosition);
    doc.text(`Total: ${formatCurrency(totalCompras.toString())}`, 14, yPosition + 6);
    doc.text(`Pagado: ${formatCurrency(totalPagado.toString())}`, 14, yPosition + 12);
    doc.text(`Por Pagar: ${formatCurrency(totalPorPagar.toString())}`, 14, yPosition + 18);

    const fileName = `compras-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Fix: Parse date components directly to avoid UTC timezone shift
  const formatDate = (dateString: string) => {
    try {
      // Extract just the date part (YYYY-MM-DD) from ISO timestamp (2026-01-23T00:00:00.000Z)
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.supplier.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPurchases = filteredPurchases.reduce((sum, purchase) => sum + parseFloat(purchase.total), 0);
  const totalPaid = filteredPurchases.reduce((sum, purchase) => sum + parseFloat(purchase.amountPaid || '0'), 0);
  const totalPending = totalPurchases - totalPaid;

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando compras...</p>
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Compras</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Gestiona tus compras a proveedores
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/practice/proveedores"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-semibold"
              >
                <Truck className="w-5 h-5" />
                <span className="hidden sm:inline">Proveedores</span>
              </Link>
              <Link
                href="/dashboard/practice/compras/new"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nueva Compra</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Total Compras</div>
            <div className="text-sm sm:text-2xl font-bold text-gray-900">{formatCurrency(totalPurchases)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Pagado</div>
            <div className="text-sm sm:text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">Pendiente</div>
            <div className="text-sm sm:text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="CONFIRMED">Confirmada</option>
              <option value="PROCESSING">En Proceso</option>
              <option value="SHIPPED">Enviada</option>
              <option value="RECEIVED">Recibida</option>
              <option value="CANCELLED">Cancelada</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los pagos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagada</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay compras registradas
            </h3>
            <p className="text-gray-600 mb-4">
              Comienza creando tu primera compra
            </p>
            <Link
              href="/dashboard/practice/compras/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Compra
            </Link>
          </div>
        ) : (
          <>
            {/* Batch Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {selectedIds.size} compra{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-gray-600 hover:text-gray-800 ml-auto"
                >
                  Deseleccionar
                </button>
              </div>
            )}

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {filteredPurchases.map((purchase) => {
                const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
                const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                return (
                  <div key={purchase.id} className={`bg-white rounded-lg shadow p-4 ${selectedIds.has(purchase.id) ? 'ring-2 ring-blue-400' : ''}`}>
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(purchase.id)}
                          onChange={() => toggleSelect(purchase.id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-semibold text-gray-900">{purchase.purchaseNumber}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(purchase.total)}</div>
                        {parseFloat(purchase.amountPaid) > 0 && (
                          <div className="text-xs text-green-600">Pagado: {formatCurrency(purchase.amountPaid)}</div>
                        )}
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-900">{purchase.supplier.businessName}</div>
                      {purchase.supplier.contactName && purchase.supplier.contactName !== purchase.supplier.businessName && (
                        <div className="text-xs text-gray-500">{purchase.supplier.contactName}</div>
                      )}
                    </div>

                    {/* Dates Row */}
                    <div className="flex gap-4 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-400">Fecha:</span> {formatDate(purchase.purchaseDate)}
                      </div>
                      {purchase.deliveryDate && (
                        <div>
                          <span className="text-gray-400">Entrega:</span> {formatDate(purchase.deliveryDate)}
                        </div>
                      )}
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${paymentConf.color}`}>
                        {paymentConf.icon} {paymentConf.label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
                        {statusConf.icon} {statusConf.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <InlineStatusSelect
                        currentStatus={purchase.status}
                        statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                          value,
                          label: conf.label,
                          color: conf.color,
                          icon: conf.icon
                        }))}
                        onStatusChange={(newStatus) => handlePurchaseStatusChange(purchase.id, purchase.status, newStatus)}
                        disabled={updatingId === purchase.id}
                      />
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/practice/compras/${purchase.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <Link
                          href={`/dashboard/practice/compras/${purchase.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={filteredPurchases.length > 0 && selectedIds.size === filteredPurchases.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">Pagado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">Por Pagar</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPurchases.map((purchase) => {
                      const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
                      const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                      return (
                        <tr key={purchase.id} className={`hover:bg-gray-50 ${selectedIds.has(purchase.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(purchase.id)}
                              onChange={() => toggleSelect(purchase.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-900">{purchase.purchaseNumber}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{purchase.supplier.businessName}</div>
                            {purchase.supplier.contactName && purchase.supplier.contactName !== purchase.supplier.businessName && (
                              <div className="text-sm text-gray-500">{purchase.supplier.contactName}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{formatDate(purchase.purchaseDate)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(purchase.total)}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {editingAmountPaidId === purchase.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={purchase.total}
                                  value={editingAmountPaidValue}
                                  onChange={(e) => setEditingAmountPaidValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  disabled={updatingAmountPaid}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveAmountPaid(purchase.id, purchase.total);
                                    if (e.key === 'Escape') { setEditingAmountPaidId(null); setEditingAmountPaidValue(''); }
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveAmountPaid(purchase.id, purchase.total)}
                                  disabled={updatingAmountPaid}
                                  className="px-1.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {updatingAmountPaid ? '...' : '✓'}
                                </button>
                                <button
                                  onClick={() => { setEditingAmountPaidId(null); setEditingAmountPaidValue(''); }}
                                  disabled={updatingAmountPaid}
                                  className="px-1.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                className="font-medium text-blue-600 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-end gap-1"
                                onClick={() => handleStartEditAmountPaid(purchase)}
                                title="Click para editar monto pagado"
                              >
                                <span>{formatCurrency(purchase.amountPaid)}</span>
                                <Edit2 className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(() => {
                              const total = parseFloat(purchase.total);
                              const paid = parseFloat(purchase.amountPaid || '0');
                              const balance = total - paid;
                              return balance > 0 ? (
                                <span className="font-semibold text-red-600">
                                  {formatCurrency(balance.toString())}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentConf.color}`}>
                              {paymentConf.icon} {paymentConf.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <InlineStatusSelect
                              currentStatus={purchase.status}
                              statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                                value,
                                label: conf.label,
                                color: conf.color,
                                icon: conf.icon
                              }))}
                              onStatusChange={(newStatus) => handlePurchaseStatusChange(purchase.id, purchase.status, newStatus)}
                              disabled={updatingId === purchase.id}
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/dashboard/practice/compras/${purchase.id}`}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Ver"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/dashboard/practice/compras/${purchase.id}/edit`}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(purchase.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {filteredPurchases.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredPurchases.length} compra{filteredPurchases.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </>
  );
}
