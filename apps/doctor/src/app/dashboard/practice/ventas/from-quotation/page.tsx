"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, FileText, ShoppingCart, Eye } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
}

interface Quotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  total: string;
  client: Client;
}

const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: '📤' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '❌' },
  EXPIRED: { label: 'Vencida', color: 'bg-orange-100 text-orange-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

export default function FromQuotationPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [convertingId, setConvertingId] = useState<number | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchQuotations();
    }
  }, [session, statusFilter]);

  const fetchQuotations = async () => {
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

      const response = await fetch(`${API_URL}/api/practice-management/cotizaciones?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar cotizaciones');
      const result = await response.json();
      setQuotations(result.data || []);
    } catch (err) {
      console.error('Error al cargar cotizaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToSale = async (quotationId: number) => {
    if (!session?.user?.email) return;

    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) return;

    if (!confirm(`¿Convertir la cotización ${quotation.quotationNumber} en una venta?`)) return;

    setConvertingId(quotationId);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/ventas/from-quotation/${quotationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al convertir cotización');

      const result = await response.json();
      router.push(`/dashboard/practice/ventas/${result.data.id}`);
    } catch (err) {
      console.error('Error al convertir cotización:', err);
      alert('Error al convertir cotización a venta');
      setConvertingId(null);
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

  const filteredQuotations = quotations.filter(quotation =>
    quotation.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quotation.client.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            href="/dashboard/practice/ventas"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ventas
          </Link>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Convertir Cotización a Venta
            </h1>
            <p className="text-gray-600 mt-2">
              Selecciona una cotización aprobada para convertirla en venta
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número o cliente..."
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
              <option value="APPROVED">Aprobadas</option>
              <option value="SENT">Enviadas</option>
              <option value="DRAFT">Borrador</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="EXPIRED">Vencidas</option>
            </select>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {filteredQuotations.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay cotizaciones disponibles
                </h3>
                <p className="text-gray-600 mb-4">
                  {statusFilter === 'APPROVED'
                    ? 'No hay cotizaciones aprobadas para convertir'
                    : 'No se encontraron cotizaciones con este filtro'
                  }
                </p>
                <Link
                  href="/dashboard/practice/cotizaciones"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Ver Cotizaciones
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Folio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Válida hasta</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuotations.map((quotation) => {
                    const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
                    const isConverting = convertingId === quotation.id;

                    return (
                      <tr key={quotation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{quotation.quotationNumber}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{quotation.client.businessName}</div>
                          {quotation.client.contactName && (
                            <div className="text-sm text-gray-500">{quotation.client.contactName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatDate(quotation.issueDate)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatDate(quotation.validUntil)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(quotation.total)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                            {config.icon} {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/practice/cotizaciones/${quotation.id}`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Ver cotización"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleConvertToSale(quotation.id)}
                              disabled={isConverting}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isConverting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Convirtiendo...
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4" />
                                  Convertir
                                </>
                              )}
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

        {filteredQuotations.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Mostrando {filteredQuotations.length} cotización{filteredQuotations.length !== 1 ? 'es' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
