"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, Package, Eye, Users } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import InlineStatusSelect, { StatusOption } from "@/components/practice/InlineStatusSelect";
import Toast, { ToastType } from "@/components/ui/Toast";
import { validatePurchaseTransition, PurchaseStatus } from "@/lib/practice/statusTransitions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

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
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchPurchases();
      if (session.user?.doctorId) {
        fetchDoctorProfile(session.user.doctorId);
      }
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

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading purchases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
                <p className="text-gray-600 mt-1">
                  Manage your supplier purchases
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/dashboard/practice/proveedores"
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  Suppliers
                </Link>
                <Link
                  href="/dashboard/practice/compras/new"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Purchase
                </Link>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600 mb-1">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPurchases)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600 mb-1">Total Pending</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by number or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Payments</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">No purchases yet</p>
                <p className="text-gray-500 mb-4">
                  Start by creating your first purchase
                </p>
                <Link
                  href="/dashboard/practice/compras/new"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Purchase
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPurchases.map((purchase) => {
                      const statusConf = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.PENDING;
                      const paymentConf = paymentStatusConfig[purchase.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;

                      return (
                        <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
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
                                Paid: {formatCurrency(purchase.amountPaid)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${paymentConf.color}`}>
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
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/dashboard/practice/compras/${purchase.id}/edit`}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(purchase.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
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
            )}
          </div>

          {filteredPurchases.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-600">
              Showing {filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>

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
