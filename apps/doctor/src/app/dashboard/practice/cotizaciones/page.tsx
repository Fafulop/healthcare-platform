"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, FileText, Eye, Users, ShoppingCart } from "lucide-react";
import InlineStatusSelect from "@/components/practice/InlineStatusSelect";
import Toast, { ToastType } from "@/components/ui/Toast";
import { validateQuotationTransition, QuotationStatus } from "@/lib/practice/statusTransitions";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface QuotationItem {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
}

interface Quotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  tax: string | null;
  total: string;
  client: Client;
  items: QuotationItem[];
}

const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: '📤' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '❌' },
  EXPIRED: { label: 'Vencida', color: 'bg-orange-100 text-orange-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

export default function CotizacionesPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchQuotations = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones?${params}`);

      if (!response.ok) throw new Error('Error al obtener cotizaciones');

      const result = await response.json();
      setQuotations(result.data || []);
    } catch (err: any) {
      console.error('Error al obtener cotizaciones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quotation: Quotation) => {
    if (!confirm(`¿Eliminar la cotización "${quotation.quotationNumber}"?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotation.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar cotización');
      await fetchQuotations();
    } catch (err) {
      console.error('Error al eliminar cotización:', err);
      alert('Error al eliminar la cotización');
    }
  };

  const handleConvertToSale = async (quotation: Quotation) => {
    if (!confirm(`¿Convertir la cotización "${quotation.quotationNumber}" en una venta?`)) return;

    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/from-quotation/${quotation.id}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Error al convertir cotización a venta');

      const result = await response.json();
      alert(`¡Venta creada exitosamente! Folio: ${result.data.saleNumber}`);
      window.location.href = `/dashboard/practice/ventas/${result.data.id}`;
    } catch (err) {
      console.error('Error al convertir cotización:', err);
      alert('Error al convertir la cotización a venta');
      setLoading(false);
    }
  };

  const handleQuotationStatusChange = async (quotationId: number, oldStatus: string, newStatus: string) => {
    const validation = validateQuotationTransition(oldStatus as QuotationStatus, newStatus as QuotationStatus);

    if (!validation.allowed) {
      setToastMessage({ message: validation.errorMessage || 'Transición no permitida', type: 'error' });
      return;
    }

    if (validation.requiresConfirmation && validation.confirmationMessage) {
      if (!confirm(validation.confirmationMessage)) {
        return;
      }
    }

    setQuotations(prev => prev.map(q =>
      q.id === quotationId ? { ...q, status: newStatus } : q
    ));
    setUpdatingId(quotationId);

    try {
      const fetchResponse = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`);

      if (!fetchResponse.ok) {
        throw new Error('Error al obtener cotización');
      }

      const currentData = await fetchResponse.json();

      const updateResponse = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...currentData.data,
          status: newStatus
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Error al actualizar estado');
      }

      await fetchQuotations();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      setQuotations(prev => prev.map(q =>
        q.id === quotationId ? { ...q, status: oldStatus } : q
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

  const filteredQuotations = quotations.filter(quotation =>
    quotation.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
    quotation.client.businessName.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const isExpiringSoon = (validUntil: string) => {
    const daysUntilExpiry = Math.ceil((new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

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
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Gestiona las cotizaciones para tus clientes
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
                href="/dashboard/practice/ventas"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-semibold"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="hidden sm:inline">Ventas</span>
              </Link>
              <Link
                href="/dashboard/practice/cotizaciones/new"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nueva</span>
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
              onChange={(e) => setStatusFilter(e.target.value)}
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {search || statusFilter !== 'all' ? 'No se encontraron cotizaciones' : 'No hay cotizaciones'}
            </h3>
            <p className="text-gray-600 mb-4">
              {!search && statusFilter === 'all' && 'Crea tu primera cotización para comenzar'}
            </p>
            {!search && statusFilter === 'all' && (
              <Link
                href="/dashboard/practice/cotizaciones/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Cotización
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {filteredQuotations.map(quotation => {
                const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
                const expiringSoon = isExpiringSoon(quotation.validUntil);
                const expired = isExpired(quotation.validUntil);

                return (
                  <div
                    key={quotation.id}
                    className={`bg-white rounded-lg shadow p-4 ${
                      expired ? 'border-l-4 border-red-500' : expiringSoon ? 'border-l-4 border-yellow-500' : ''
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-gray-900">{quotation.quotationNumber}</div>
                        <div className="text-xs text-gray-500">{quotation.items.length} item(s)</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(quotation.total)}</div>
                      </div>
                    </div>

                    {/* Client */}
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-900">{quotation.client.businessName}</div>
                      {quotation.client.contactName && (
                        <div className="text-xs text-gray-500">{quotation.client.contactName}</div>
                      )}
                    </div>

                    {/* Dates Row */}
                    <div className="flex gap-4 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-400">Fecha:</span> {formatDate(quotation.issueDate)}
                      </div>
                      <div>
                        <span className="text-gray-400">Válida:</span> {formatDate(quotation.validUntil)}
                        {expired && <span className="text-red-600 ml-1">(Vencida)</span>}
                        {expiringSoon && !expired && <span className="text-yellow-600 ml-1">(Por vencer)</span>}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <InlineStatusSelect
                        currentStatus={quotation.status}
                        statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                          value,
                          label: conf.label,
                          color: conf.color,
                          icon: conf.icon
                        }))}
                        onStatusChange={(newStatus) => handleQuotationStatusChange(quotation.id, quotation.status, newStatus)}
                        disabled={updatingId === quotation.id}
                      />
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/practice/cotizaciones/${quotation.id}`}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <Link
                          href={`/dashboard/practice/cotizaciones/${quotation.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleConvertToSale(quotation)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <ShoppingCart className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(quotation)}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Folio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Válida hasta
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredQuotations.map(quotation => {
                      const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
                      const expiringSoon = isExpiringSoon(quotation.validUntil);
                      const expired = isExpired(quotation.validUntil);

                      return (
                        <tr
                          key={quotation.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            expired ? 'bg-red-50' : expiringSoon ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{quotation.quotationNumber}</div>
                            <div className="text-xs text-gray-500">{quotation.items.length} item(s)</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{quotation.client.businessName}</div>
                            {quotation.client.contactName && (
                              <div className="text-sm text-gray-500">{quotation.client.contactName}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {formatDate(quotation.issueDate)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {formatDate(quotation.validUntil)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(quotation.total)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <InlineStatusSelect
                              currentStatus={quotation.status}
                              statuses={Object.entries(statusConfig).map(([value, conf]) => ({
                                value,
                                label: conf.label,
                                color: conf.color,
                                icon: conf.icon
                              }))}
                              onStatusChange={(newStatus) => handleQuotationStatusChange(quotation.id, quotation.status, newStatus)}
                              disabled={updatingId === quotation.id}
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/dashboard/practice/cotizaciones/${quotation.id}`}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Ver"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/dashboard/practice/cotizaciones/${quotation.id}/edit`}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleConvertToSale(quotation)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Convertir a venta"
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(quotation)}
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

        {/* Summary */}
        {filteredQuotations.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredQuotations.length} de {quotations.length} cotización(es)
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
