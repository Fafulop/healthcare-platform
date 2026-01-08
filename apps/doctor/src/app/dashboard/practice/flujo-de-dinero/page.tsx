"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Filter } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface LedgerEntry {
  id: number;
  amount: string;
  concept: string;
  bankAccount: string | null;
  formaDePago: string;
  internalId: string;
  entryType: string;
  transactionDate: string;
  area: string;
  subarea: string;
  porRealizar: boolean;
  attachments: any[];
  facturas: any[];
  facturasXml: any[];
  transactionType?: string;
  clientId?: number;
  supplierId?: number;
  paymentStatus?: string;
  amountPaid?: string;
  client?: {
    id: number;
    businessName: string;
    contactName: string | null;
  };
  supplier?: {
    id: number;
    businessName: string;
    contactName: string | null;
  };
  sale?: {
    id: number;
    saleNumber: string;
    total: string;
  };
  purchase?: {
    id: number;
    purchaseNumber: string;
    total: string;
  };
}

interface Balance {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  pendingIngresos: number;
  pendingEgresos: number;
  projectedBalance: number;
}

export default function FlujoDeDineroPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState<Balance>({
    totalIngresos: 0,
    totalEgresos: 0,
    balance: 0,
    pendingIngresos: 0,
    pendingEgresos: 0,
    projectedBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('all');
  const [porRealizarFilter, setPorRealizarFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (session?.user?.email) {
      fetchEntries();
      fetchBalance();
    }
  }, [session, entryTypeFilter, porRealizarFilter, startDate, endDate]);

  const fetchBalance = async () => {
    if (!session?.user?.email) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/ledger/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar balance');
      const result = await response.json();
      setBalance(result.data);
    } catch (err) {
      console.error('Error al cargar balance:', err);
    }
  };

  const fetchEntries = async () => {
    if (!session?.user?.email) return;

    setLoading(true);
    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const params = new URLSearchParams();
      if (entryTypeFilter !== 'all') params.append('entryType', entryTypeFilter);
      if (porRealizarFilter !== 'all') params.append('porRealizar', porRealizarFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`${API_URL}/api/practice-management/ledger?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar movimientos');
      const result = await response.json();
      setEntries(result.data || []);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, internalId: string) => {
    if (!confirm(`¿Estás seguro de eliminar el movimiento ${internalId}?`)) return;

    try {
      const token = btoa(JSON.stringify({
        email: session?.user?.email,
        role: session?.user?.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/ledger/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al eliminar movimiento');
      fetchEntries();
      fetchBalance();
    } catch (err) {
      console.error('Error al eliminar movimiento:', err);
      alert('Error al eliminar movimiento');
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredEntries = entries.filter(entry => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return entry.concept.toLowerCase().includes(search) ||
             entry.internalId.toLowerCase().includes(search) ||
             entry.area.toLowerCase().includes(search) ||
             entry.subarea.toLowerCase().includes(search);
    }
    return true;
  });

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-green-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando flujo de dinero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-green-600 hover:text-green-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Flujo de Dinero</h1>
              <p className="text-gray-600 mt-1">Gestiona tus ingresos y egresos</p>
            </div>
            <Link
              href="/dashboard/practice/flujo-de-dinero/new"
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Movimiento
            </Link>
          </div>
        </div>

        {/* Balance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Balance Actual</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance.balance)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(balance.totalIngresos)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Egresos</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(balance.totalEgresos)}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(balance.pendingIngresos - balance.pendingEgresos)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Balance proyectado: {formatCurrency(balance.projectedBalance)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Concepto o ID..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={entryTypeFilter}
                onChange={(e) => setEntryTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={porRealizarFilter}
                onChange={(e) => setPorRealizarFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Todos</option>
                <option value="false">Realizados</option>
                <option value="true">Por Realizar</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    ID Interno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Concepto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Área
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Tipo Transacción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Cliente/Proveedor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Estado Pago
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Pagado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No hay movimientos registrados</p>
                      <p className="text-sm mt-1">Crea tu primer movimiento para comenzar</p>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.transactionDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">
                          {entry.internalId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={entry.concept}>
                          {entry.concept}
                        </div>
                        {entry.bankAccount && (
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.bankAccount} • {entry.formaDePago}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{entry.area}</div>
                        <div className="text-xs text-gray-500">{entry.subarea}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          entry.entryType === 'ingreso'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {entry.entryType === 'ingreso' ? (
                            <>
                              <TrendingUp className="w-3 h-3" />
                              Ingreso
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-3 h-3" />
                              Egreso
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.transactionType === 'VENTA' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Venta
                          </span>
                        )}
                        {entry.transactionType === 'COMPRA' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Compra
                          </span>
                        )}
                        {(!entry.transactionType || entry.transactionType === 'N/A') && (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.client && (
                          <div className="max-w-xs truncate" title={entry.client.businessName}>
                            {entry.client.businessName}
                          </div>
                        )}
                        {entry.supplier && (
                          <div className="max-w-xs truncate" title={entry.supplier.businessName}>
                            {entry.supplier.businessName}
                          </div>
                        )}
                        {!entry.client && !entry.supplier && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {entry.paymentStatus === 'PAID' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Pagado
                          </span>
                        )}
                        {entry.paymentStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Parcial
                          </span>
                        )}
                        {entry.paymentStatus === 'PENDING' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Pendiente
                          </span>
                        )}
                        {!entry.paymentStatus && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Total */}
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                        entry.entryType === 'ingreso' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                      </td>
                      {/* Pagado - only for VENTA/COMPRA */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') ? (
                          <span className="font-medium text-blue-600">
                            {formatCurrency(entry.amountPaid || '0')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Saldo - only for VENTA/COMPRA */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') ? (
                          (() => {
                            const total = parseFloat(entry.amount);
                            const paid = parseFloat(entry.amountPaid || '0');
                            const balance = total - paid;
                            return (
                              <span className={`font-semibold ${
                                balance === 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(balance.toString())}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.porRealizar
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {entry.porRealizar ? 'Por Realizar' : 'Realizado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(entry.id, entry.internalId)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {filteredEntries.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">
                  Total: <strong>{filteredEntries.length}</strong> movimiento{filteredEntries.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={fetchEntries}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Actualizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
