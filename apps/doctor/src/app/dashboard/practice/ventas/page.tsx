"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, ShoppingCart, Eye, FileText, Users } from "lucide-react";
import InlineStatusSelect, { StatusOption } from "@/components/practice/InlineStatusSelect";
import Toast, { ToastType } from "@/components/ui/Toast";
import { validateSaleTransition, SaleStatus } from "@/lib/practice/statusTransitions";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface Quotation {
  id: number;
  quotationNumber: string;
}

interface Sale {
  id: number;
  saleNumber: string;
  saleDate: string;
  deliveryDate: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string;
  tax: string | null;
  total: string;
  amountPaid: string;
  client: Client;
  quotation: Quotation | null;
}

const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: '⚙️' },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: '📦' },
  DELIVERED: { label: 'Entregada', color: 'bg-blue-100 text-blue-800', icon: '✅' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-blue-100 text-blue-800', icon: '✅' }
};

export default function VentasPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchSales();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter);

      const response = await authFetch(`${API_URL}/api/practice-management/ventas?${params}`);

      if (!response.ok) throw new Error('Error al cargar ventas');
      const result = await response.json();
      setSales(result.data || []);
    } catch (err) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta venta?')) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error al eliminar venta');
      fetchSales();
    } catch (err) {
      console.error('Error al eliminar venta:', err);
      alert('Error al eliminar venta');
    }
  };

  const handleSaleStatusChange = async (saleId: number, oldStatus: string, newStatus: string) => {
    if (!session?.user?.email) return;

    // Validate transition
    const validation = validateSaleTransition(oldStatus as SaleStatus, newStatus as SaleStatus);

    if (!validation.allowed) {
      setToastMessage({ message: validation.errorMessage || 'Transición no permitida', type: 'error' });
      return;
    }

    // Show confirmation if required
    if (validation.requiresConfirmation && validation.confirmationMessage) {
      if (!confirm(validation.confirmationMessage)) {
        return;
      }
    }

    // Optimistic update
    setSales(prev => prev.map(s =>
      s.id === saleId ? { ...s, status: newStatus } : s
    ));
    setUpdatingId(saleId);

    try {
      // Fetch current sale
      const fetchResponse = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`);

      if (!fetchResponse.ok) {
        throw new Error('Error al obtener venta');
      }

      const currentData = await fetchResponse.json();

      // Update with new status
      const updateResponse = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...currentData.data,
          status: newStatus
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Error al actualizar estado');
      }

      // Refresh list
      await fetchSales();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      // Revert on error
      setSales(prev => prev.map(s =>
        s.id === saleId ? { ...s, status: oldStatus } : s
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const filteredSales = sales.filter(sale =>
    sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSales = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
  const totalPaid = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid || '0'), 0);
  const totalPending = totalSales - totalPaid;

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
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  Gestiona tus ventas confirmadas
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/dashboard/practice/clients"
                  className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 transition-colors font-semibold"
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline">Clientes</span>
                </Link>
                <Link
                  href="/dashboard/practice/cotizaciones"
                  className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold"
                >
                  <FileText className="w-5 h-5" />
                  <span className="hidden sm:inline">Cotizaciones</span>
                </Link>
                <Link
                  href="/dashboard/practice/ventas/new"
                  className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nueva Venta</span>
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

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número o cliente..."
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
              <option value="DELIVERED">Entregada</option>
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
          {filteredSales.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay ventas registradas
              </h3>
              <p className="text-gray-600 mb-4">
                Comienza creando tu primera venta
              </p>
              <Link
                href="/dashboard/practice/ventas/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Venta
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {filteredSales.map((sale) => {
                  const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                  return (
                    <div key={sale.id} className="bg-white rounded-lg shadow p-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">{sale.saleNumber}</div>
                          {sale.quotation && (
                            <div className="text-xs text-gray-500">De: {sale.quotation.quotationNumber}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{formatCurrency(sale.total)}</div>
                          {parseFloat(sale.amountPaid) > 0 && (
                            <div className="text-xs text-blue-600">Pagado: {formatCurrency(sale.amountPaid)}</div>
                          )}
                        </div>
                      </div>

                      {/* Client */}
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-900">{sale.client.businessName}</div>
                        {sale.client.contactName && (
                          <div className="text-xs text-gray-500">{sale.client.contactName}</div>
                        )}
                      </div>

                      {/* Dates Row */}
                      <div className="flex gap-4 text-xs text-gray-600 mb-3">
                        <div>
                          <span className="text-gray-400">Fecha:</span> {formatDate(sale.saleDate)}
                        </div>
                        {sale.deliveryDate && (
                          <div>
                            <span className="text-gray-400">Entrega:</span> {formatDate(sale.deliveryDate)}
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
                          currentStatus={sale.status}
                          statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                            value,
                            label: conf.label,
                            color: conf.color,
                            icon: conf.icon
                          }))}
                          onStatusChange={(newStatus) => handleSaleStatusChange(sale.id, sale.status, newStatus)}
                          disabled={updatingId === sale.id}
                        />
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/dashboard/practice/ventas/${sale.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                          <Link
                            href={`/dashboard/practice/ventas/${sale.id}/edit`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(sale.id)}
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrega</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredSales.map((sale) => {
                        const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
                        const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                        return (
                          <tr key={sale.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{sale.saleNumber}</span>
                                {sale.quotation && (
                                  <span className="text-xs text-gray-500">
                                    De: {sale.quotation.quotationNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{sale.client.businessName}</div>
                              {sale.client.contactName && (
                                <div className="text-sm text-gray-500">{sale.client.contactName}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{formatDate(sale.saleDate)}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {sale.deliveryDate ? formatDate(sale.deliveryDate) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="font-semibold text-gray-900">{formatCurrency(sale.total)}</div>
                              {parseFloat(sale.amountPaid) > 0 && (
                                <div className="text-xs text-blue-600">
                                  Pagado: {formatCurrency(sale.amountPaid)}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentConf.color}`}>
                                {paymentConf.icon} {paymentConf.label}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <InlineStatusSelect
                                currentStatus={sale.status}
                                statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                                  value,
                                  label: conf.label,
                                  color: conf.color,
                                  icon: conf.icon
                                }))}
                                onStatusChange={(newStatus) => handleSaleStatusChange(sale.id, sale.status, newStatus)}
                                disabled={updatingId === sale.id}
                              />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/dashboard/practice/ventas/${sale.id}`}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Ver"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <Link
                                  href={`/dashboard/practice/ventas/${sale.id}/edit`}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleDelete(sale.id)}
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

        {filteredSales.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredSales.length} venta{filteredSales.length !== 1 ? 's' : ''}
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
