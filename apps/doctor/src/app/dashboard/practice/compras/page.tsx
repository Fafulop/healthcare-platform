"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Package, ArrowLeft, Eye, FileText, Users } from "lucide-react";
import InlineStatusSelect, { StatusOption } from "@/components/practice/InlineStatusSelect";
import Toast, { ToastType } from "@/components/ui/Toast";
import { validatePurchaseTransition, PurchaseStatus } from "@/lib/practice/statusTransitions";

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
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: '⚙️' },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: '📦' },
  RECEIVED: { label: 'Recibida', color: 'bg-green-100 text-green-800', icon: '✅' },
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

  useEffect(() => {
    if (session?.user?.email) {
      fetchPurchases();
    }
  }, [session, statusFilter, paymentFilter]);

  const fetchPurchases = async () => {
    if (!session?.user?.email) return;

    setLoading(true);
    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter);

      const response = await fetch(`${API_URL}/api/practice-management/compras?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

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
      const token = btoa(JSON.stringify({
        email: session?.user?.email,
        role: session?.user?.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/compras/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al eliminar compra');
      fetchPurchases();
    } catch (err) {
      console.error('Error al eliminar compra:', err);
      alert('Error al eliminar compra');
    }
  };

  const handlePurchaseStatusChange = async (purchaseId: number, oldStatus: string, newStatus: string) => {
    if (!session?.user?.email) return;

    // Validate transition
    const validation = validatePurchaseTransition(oldStatus as PurchaseStatus, newStatus as PurchaseStatus);

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
    setPurchases(prev => prev.map(s =>
      s.id === purchaseId ? { ...s, status: newStatus } : s
    ));
    setUpdatingId(purchaseId);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      // Fetch current purchase
      const fetchResponse = await fetch(`${API_URL}/api/practice-management/compras/${purchaseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!fetchResponse.ok) {
        throw new Error('Error al obtener compra');
      }

      const currentData = await fetchResponse.json();

      // Update with new status
      const updateResponse = await fetch(`${API_URL}/api/practice-management/compras/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...currentData.data,
          status: newStatus
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Error al actualizar estado');
      }

      // Refresh list
      await fetchPurchases();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      // Revert on error
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

  const filteredPurchases = purchases.filter(purchase =>
    purchase.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.supplier.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPurchases = filteredPurchases.reduce((sum, purchase) => sum + parseFloat(purchase.total), 0);
  const totalPaid = filteredPurchases.reduce((sum, purchase) => sum + parseFloat(purchase.amountPaid || '0'), 0);
  const totalPending = totalPurchases - totalPaid;

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-green-600" />
                Compras
              </h1>
              <p className="text-gray-600 mt-2">
                Gestiona tus compras a proveedores
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/practice/proveedores"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-semibold"
              >
                <Users className="w-5 h-5" />
                Proveedores
              </Link>
              <Link
                href="/dashboard/practice/compras/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-semibold"
              >
                <Plus className="w-5 h-5" />
                Nueva Compra
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Compras</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPurchases)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Pagado</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Pendiente</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Todos los pagos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagada</option>
            </select>
          </div>
        </div>

        {/* Purchases Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay compras registradas
                </h3>
                <p className="text-gray-600 mb-4">
                  Comienza creando tu primera compra
                </p>
                <Link
                  href="/dashboard/practice/compras/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Compra
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Folio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Entrega</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado Pago</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPurchases.map((purchase) => {
                    const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
                    const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                    return (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{purchase.purchaseNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{purchase.supplier.businessName}</div>
                          {purchase.supplier.contactName && (
                            <div className="text-sm text-gray-500">{purchase.supplier.contactName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatDate(purchase.purchaseDate)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {purchase.deliveryDate ? formatDate(purchase.deliveryDate) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(purchase.total)}</div>
                          {parseFloat(purchase.amountPaid) > 0 && (
                            <div className="text-xs text-green-600">
                              Pagado: {formatCurrency(purchase.amountPaid)}
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
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
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
            )}
          </div>
        </div>

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
    </div>
  );
}
