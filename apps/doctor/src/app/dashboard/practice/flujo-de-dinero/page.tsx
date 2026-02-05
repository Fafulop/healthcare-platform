"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, DollarSign, Filter, FolderTree, ChevronLeft, ChevronRight, Calendar, ChevronDown, X } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Subarea {
  id: number;
  name: string;
  description: string | null;
}

interface Area {
  id: number;
  name: string;
  description: string | null;
  type: 'INGRESO' | 'EGRESO';
  subareas: Subarea[];
}

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
  const [areas, setAreas] = useState<Area[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [balance, setBalance] = useState<Balance>({
    totalIngresos: 0,
    totalEgresos: 0,
    balance: 0,
    pendingIngresos: 0,
    pendingEgresos: 0,
    projectedBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'movimientos' | 'estado-resultados'>('movimientos');
  const [searchTerm, setSearchTerm] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('all');
  const [porRealizarFilter, setPorRealizarFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAllEntries, setShowAllEntries] = useState(true);
  const [ledgerDate, setLedgerDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Inline editing state
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editingAreaData, setEditingAreaData] = useState<{
    area: string;
    subarea: string;
  }>({ area: '', subarea: '' });
  const [updatingArea, setUpdatingArea] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modalEntry, setModalEntry] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      if (session.user?.doctorId) {
        fetchDoctorProfile(session.user.doctorId);
      }
      fetchEntries();
      fetchBalance();
      fetchAreas();
    }
  }, [entryTypeFilter, porRealizarFilter, startDate, endDate]);

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

  const fetchBalance = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/balance`);

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
      const params = new URLSearchParams();
      if (entryTypeFilter !== 'all') params.append('entryType', entryTypeFilter);
      if (porRealizarFilter !== 'all') params.append('porRealizar', porRealizarFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (searchTerm) params.append('search', searchTerm);

      const response = await authFetch(`${API_URL}/api/practice-management/ledger?${params}`);

      if (!response.ok) throw new Error('Error al cargar movimientos');
      const result = await response.json();
      setEntries(result.data || []);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/areas`);

      if (!response.ok) throw new Error('Error al cargar áreas');
      const result = await response.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  };

  const handleDelete = async (id: number, internalId: string) => {
    if (!confirm(`¿Estás seguro de eliminar el movimiento ${internalId}?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${id}`, {
        method: 'DELETE'
      });

      // Try to parse response
      let result;
      try {
        result = await response.json();
      } catch (e) {
        // If JSON parsing fails, check if deletion was successful by status code
        if (response.ok || response.status === 204) {
          fetchEntries();
          fetchBalance();
          return;
        }
        throw new Error('Error al eliminar movimiento');
      }

      // Check if deletion was successful
      if (response.ok || result.success) {
        fetchEntries();
        fetchBalance();
      } else {
        throw new Error(result.error || 'Error al eliminar movimiento');
      }
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
    // Parse YYYY-MM-DD portion to avoid UTC timezone shift
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return dateString;
  };

  const cleanConcept = (concept: string) => {
    // Remove auto-generated prefixes from linked sales/purchases
    // Pattern: "Venta VTA-2026-006 - Cliente: Name" or "Compra CMP-2026-006 - Proveedor: Name"
    const ventaPattern = /^Venta VTA-\d{4}-\d{3} - Cliente: (.+)$/;
    const compraPattern = /^Compra CMP-\d{4}-\d{3} - Proveedor: (.+)$/;

    const ventaMatch = concept.match(ventaPattern);
    if (ventaMatch) {
      return ventaMatch[1]; // Return just the client name
    }

    const compraMatch = concept.match(compraPattern);
    if (compraMatch) {
      return compraMatch[1]; // Return just the supplier name
    }

    // Return original concept if no pattern matches (user input)
    return concept;
  };

  // Inline editing helper functions
  const getAvailableAreasForEntry = (entry: LedgerEntry) => {
    return areas.filter(a =>
      entry.entryType === 'ingreso' ? a.type === 'INGRESO' : a.type === 'EGRESO'
    );
  };

  const handleStartEditArea = (entry: LedgerEntry) => {
    setEditingAreaId(entry.id);
    setEditingAreaData({
      area: entry.area,
      subarea: entry.subarea
    });
  };

  const handleSaveArea = async (entryId: number) => {
    if (!session?.user?.email || !editingAreaData.area) return;

    setUpdatingArea(true);

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          area: editingAreaData.area,
          subarea: editingAreaData.subarea || ''
        })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar área');
      }

      // Update local state
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === entryId
            ? { ...e, area: editingAreaData.area, subarea: editingAreaData.subarea }
            : e
        )
      );

      // Reset editing state
      setEditingAreaId(null);
      setEditingAreaData({ area: '', subarea: '' });
    } catch (err) {
      console.error('Error updating area:', err);
      alert('Error al actualizar el área');
    } finally {
      setUpdatingArea(false);
    }
  };

  // Process entries for Estado de Resultados
  const processEstadoResultados = () => {
    const result = {
      ingresos: {} as Record<string, Record<string, number>>,
      egresos: {} as Record<string, Record<string, number>>,
      cuentasPorCobrar: 0,
      cuentasPorPagar: 0,
    };

    entries.forEach(entry => {
      const amount = parseFloat(entry.amount);
      const amountPaid = parseFloat(entry.amountPaid || '0');
      const saldo = amount - amountPaid;

      if (entry.entryType === 'ingreso') {
        // Group by area and subarea for ingresos
        if (!result.ingresos[entry.area]) {
          result.ingresos[entry.area] = {};
        }
        if (!result.ingresos[entry.area][entry.subarea]) {
          result.ingresos[entry.area][entry.subarea] = 0;
        }
        result.ingresos[entry.area][entry.subarea] += amountPaid;

        // Add saldo to cuentas por cobrar
        result.cuentasPorCobrar += saldo;
      } else if (entry.entryType === 'egreso') {
        // Group by area and subarea for egresos
        if (!result.egresos[entry.area]) {
          result.egresos[entry.area] = {};
        }
        if (!result.egresos[entry.area][entry.subarea]) {
          result.egresos[entry.area][entry.subarea] = 0;
        }
        result.egresos[entry.area][entry.subarea] += amountPaid;

        // Add saldo to cuentas por pagar
        result.cuentasPorPagar += saldo;
      }
    });

    return result;
  };

  const estadoResultados = processEstadoResultados();

  const getLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = getLocalDateString(new Date());

  const filteredEntries = entries.filter(entry => {
    // Day filter
    if (!showAllEntries) {
      const entryDate = entry.transactionDate.split('T')[0];
      if (entryDate !== ledgerDate) return false;
    }
    // Search filter
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
                <Link
                  href="/dashboard/practice/areas"
                  className="flex items-center gap-1.5 sm:gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 sm:px-4 py-2 rounded-md transition-colors text-sm sm:text-base"
                >
                  <FolderTree className="w-4 h-4 sm:w-5 sm:h-5" />
                  Áreas
                </Link>
                <Link
                  href="/dashboard/practice/flujo-de-dinero/new"
                  className="flex items-center gap-1.5 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 sm:px-4 py-2 rounded-md transition-colors text-sm sm:text-base"
                >
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
                <button
                  onClick={() => setActiveTab('movimientos')}
                  className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-colors text-sm sm:text-base ${
                    activeTab === 'movimientos'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Movimientos
                </button>
                <button
                  onClick={() => setActiveTab('estado-resultados')}
                  className={`px-4 sm:px-6 py-3 sm:py-4 font-semibold transition-colors text-sm sm:text-base ${
                    activeTab === 'estado-resultados'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Estado de Resultados
                </button>
              </div>
            </div>
          </div>

        {/* Movimientos Tab Content */}
        {activeTab === 'movimientos' && (
          <>
            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
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

          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(balance.totalIngresos)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-500">
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
        </div>

          {/* Mobile Filtros Toggle */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className="sm:hidden w-full flex items-center justify-between bg-white rounded-lg shadow px-4 py-3 mb-3"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-base font-semibold text-gray-900">Filtros</span>
              {(searchTerm || entryTypeFilter !== 'all' || porRealizarFilter !== 'all' || startDate || endDate) && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full">●</span>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Filters */}
          <div className={`bg-white rounded-lg shadow p-4 mb-6 ${!showFilters ? 'hidden sm:block' : 'block'}`}>
          <div className="hidden sm:flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

          {/* Entries Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Day Navigator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                {showAllEntries ? "Todos los Movimientos" : "Movimientos del Día"}
              </h3>
              <div className="flex items-center gap-1.5">
                {!showAllEntries && (
                  <>
                    <button
                      onClick={() => {
                        const d = new Date(ledgerDate + 'T12:00:00');
                        d.setDate(d.getDate() - 1);
                        setLedgerDate(getLocalDateString(d));
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="date"
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
                    />
                    <button
                      onClick={() => {
                        const d = new Date(ledgerDate + 'T12:00:00');
                        d.setDate(d.getDate() + 1);
                        setLedgerDate(getLocalDateString(d));
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {ledgerDate !== todayStr && (
                      <button
                        onClick={() => setLedgerDate(todayStr)}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Hoy
                      </button>
                    )}
                  </>
                )}
                <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
                  {filteredEntries.length} movimiento{filteredEntries.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setShowAllEntries(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    showAllEntries
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {showAllEntries ? "Por dia" : "Ver todos"}
                </button>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden p-3 space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">
                    {showAllEntries ? "No hay movimientos" : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-3 cursor-pointer active:bg-gray-50" onClick={() => setModalEntry(entry)}>
                    {/* Amount + Type badge */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        entry.entryType === 'ingreso' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.entryType === 'ingreso' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                      <span className={`font-bold text-base ${entry.entryType === 'ingreso' ? 'text-blue-600' : 'text-red-600'}`}>
                        {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                      </span>
                    </div>

                    {/* Concept */}
                    <p className="text-sm font-medium text-gray-900 mt-1.5 truncate">{cleanConcept(entry.concept)}</p>

                    {/* Date · Area / Subarea */}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(entry.transactionDate)} · {entry.area}{entry.subarea ? ` / ${entry.subarea}` : ''}
                    </p>

                    {/* Transaction type + client/supplier + payment status */}
                    {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          entry.transactionType === 'VENTA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {entry.transactionType === 'VENTA' ? 'Venta' : 'Compra'}
                        </span>
                        {(entry.client || entry.supplier) && (
                          <span className="text-xs text-gray-600">{entry.client?.businessName || entry.supplier?.businessName}</span>
                        )}
                        {entry.paymentStatus && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            entry.paymentStatus === 'PAID' ? 'bg-blue-100 text-blue-800' :
                            entry.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {entry.paymentStatus === 'PAID' ? 'Pagado' : entry.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Pagado / Saldo row for VENTA/COMPRA */}
                    {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                        <span>Pagado: <span className="font-semibold text-blue-600">{formatCurrency(entry.amountPaid || '0')}</span></span>
                        <span>Saldo: <span className={`font-semibold ${(parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')) === 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency((parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')).toString())}
                        </span></span>
                      </div>
                    )}

                    {/* Footer: Action buttons */}
                    <div className="flex items-center justify-end mt-2.5 pt-2.5 border-t border-gray-100">
                      <div className="flex gap-1">
                        <Link
                          href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                          className="text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id, entry.internalId); }}
                          className="text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Concepto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Área
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo Transacción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paciente/Proveedor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado Pago
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pagado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">
                        {showAllEntries ? "No hay movimientos registrados" : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
                      </p>
                      {showAllEntries && <p className="text-sm mt-1">Crea tu primer movimiento para comenzar</p>}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setModalEntry(entry)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.transactionDate)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={cleanConcept(entry.concept)}>
                          {cleanConcept(entry.concept)}
                        </div>
                        {entry.bankAccount && (
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.bankAccount} • {entry.formaDePago}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {editingAreaId === entry.id ? (
                          // EDIT MODE - Show dropdowns
                          <div className="space-y-2 min-w-[200px]">
                            {/* Area Dropdown */}
                            <select
                              value={editingAreaData.area ?? ''}
                              onChange={(e) => {
                                setEditingAreaData({
                                  area: e.target.value,
                                  subarea: '' // Reset subarea when area changes
                                });
                              }}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={updatingArea}
                            >
                              <option value="">Seleccionar área...</option>
                              {getAvailableAreasForEntry(entry).map(area => (
                                <option key={area.id} value={area.name}>
                                  {area.name}
                                </option>
                              ))}
                            </select>

                            {/* Subarea Dropdown */}
                            {editingAreaData.area && (() => {
                              const selectedArea = getAvailableAreasForEntry(entry).find(
                                a => a.name === editingAreaData.area
                              );
                              return selectedArea && selectedArea.subareas.length > 0 ? (
                                <select
                                  value={editingAreaData.subarea ?? ''}
                                  onChange={(e) => setEditingAreaData(prev => ({
                                    ...prev,
                                    subarea: e.target.value
                                  }))}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  disabled={updatingArea}
                                >
                                  <option value="">Seleccionar subárea...</option>
                                  {selectedArea.subareas.map(subarea => (
                                    <option key={subarea.id} value={subarea.name}>
                                      {subarea.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="text-xs text-gray-400 italic">
                                  No hay subáreas disponibles
                                </div>
                              );
                            })()}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveArea(entry.id)}
                                disabled={updatingArea || !editingAreaData.area}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingArea ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingAreaId(null);
                                  setEditingAreaData({ area: '', subarea: '' });
                                }}
                                disabled={updatingArea}
                                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          // VIEW MODE - Show current values with edit trigger
                          <div
                            className="text-gray-600 cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors group"
                            onClick={(e) => { e.stopPropagation(); handleStartEditArea(entry); }}
                            title="Click para editar área y subárea"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm">{entry.area}</div>
                                <div className="text-xs text-gray-500">{entry.subarea}</div>
                              </div>
                              <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          entry.entryType === 'ingreso'
                            ? 'bg-blue-100 text-blue-800'
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                        entry.entryType === 'ingreso' ? 'text-blue-600' : 'text-red-600'
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
                                balance === 0 ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(balance.toString())}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                            title="Editar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.id, entry.internalId); }}
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
            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">
                  Total: <strong>{filteredEntries.length}</strong> movimiento{filteredEntries.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={fetchEntries}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Actualizar
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}

          {/* Estado de Resultados Tab Content */}
          {activeTab === 'estado-resultados' && (
            <div className="space-y-6">
              {/* INGRESOS Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  INGRESOS
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {Object.keys(estadoResultados.ingresos).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay ingresos registrados</p>
                ) : (
                  Object.entries(estadoResultados.ingresos).map(([area, subareas]) => {
                    const areaTotal = Object.values(subareas).reduce((sum, val) => sum + val, 0);
                    return (
                      <div key={area} className="border-l-4 border-blue-500 pl-4">
                        <h3 className="font-bold text-lg text-gray-900 mb-3">{area}</h3>
                        <div className="space-y-2 ml-4">
                          {Object.entries(subareas).map(([subarea, amount]) => (
                            <div key={subarea} className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-700">└── {subarea}</span>
                              <span className="font-semibold text-blue-700">{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t-2 border-blue-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total {area}</span>
                          <span className="font-bold text-blue-700 text-lg">{formatCurrency(areaTotal)}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Cuentas por Cobrar */}
                {estadoResultados.cuentasPorCobrar > 0 && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-amber-900 flex items-center gap-2">
                          💵 Cuentas por Cobrar
                        </h3>
                        <p className="text-xs text-amber-700 mt-1">Monto pendiente de recibir</p>
                      </div>
                      <span className="font-bold text-amber-700 text-xl">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
                    </div>
                  </div>
                )}

                {/* Total Ingresos */}
                <div className="bg-blue-100 border-2 border-blue-500 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-900 text-lg">TOTAL INGRESOS</span>
                    <span className="font-bold text-blue-700 text-2xl">
                      {formatCurrency(
                        Object.values(estadoResultados.ingresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0) + estadoResultados.cuentasPorCobrar
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* EGRESOS Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-red-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-6 h-6" />
                  EGRESOS
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {Object.keys(estadoResultados.egresos).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay egresos registrados</p>
                ) : (
                  Object.entries(estadoResultados.egresos).map(([area, subareas]) => {
                    const areaTotal = Object.values(subareas).reduce((sum, val) => sum + val, 0);
                    return (
                      <div key={area} className="border-l-4 border-red-500 pl-4">
                        <h3 className="font-bold text-lg text-gray-900 mb-3">{area}</h3>
                        <div className="space-y-2 ml-4">
                          {Object.entries(subareas).map(([subarea, amount]) => (
                            <div key={subarea} className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-gray-700">└── {subarea}</span>
                              <span className="font-semibold text-red-700">{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t-2 border-red-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total {area}</span>
                          <span className="font-bold text-red-700 text-lg">{formatCurrency(areaTotal)}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Cuentas por Pagar */}
                {estadoResultados.cuentasPorPagar > 0 && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-orange-900 flex items-center gap-2">
                          💳 Cuentas por Pagar
                        </h3>
                        <p className="text-xs text-orange-700 mt-1">Monto pendiente de pagar</p>
                      </div>
                      <span className="font-bold text-orange-700 text-xl">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
                    </div>
                  </div>
                )}

                {/* Total Egresos */}
                <div className="bg-red-100 border-2 border-red-500 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-900 text-lg">TOTAL EGRESOS</span>
                    <span className="font-bold text-red-700 text-2xl">
                      {formatCurrency(
                        Object.values(estadoResultados.egresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0) + estadoResultados.cuentasPorPagar
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* Balance General */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-6 h-6" />
                  BALANCE GENERAL
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Total Ingresos Realizados</span>
                  <span className="font-bold text-blue-700 text-lg">
                    {formatCurrency(
                      Object.values(estadoResultados.ingresos)
                        .flatMap(subareas => Object.values(subareas))
                        .reduce((sum, val) => sum + val, 0)
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Total Egresos Realizados</span>
                  <span className="font-bold text-red-700 text-lg">
                    {formatCurrency(
                      Object.values(estadoResultados.egresos)
                        .flatMap(subareas => Object.values(subareas))
                        .reduce((sum, val) => sum + val, 0)
                    )}
                  </span>
                </div>

                <div className="bg-blue-50 border-2 border-blue-500 p-4 rounded-lg mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-900 text-lg">Balance Neto</span>
                    <span className="font-bold text-blue-700 text-2xl">
                      {formatCurrency(
                        Object.values(estadoResultados.ingresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0) -
                        Object.values(estadoResultados.egresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0)
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-2 text-center">Ingresos Realizados - Egresos Realizados</p>
                </div>

                {(estadoResultados.cuentasPorCobrar > 0 || estadoResultados.cuentasPorPagar > 0) && (
                  <div className="bg-purple-50 border-2 border-purple-400 p-4 rounded-lg mt-4">
                    <h3 className="font-bold text-purple-900 mb-3">Flujo Pendiente</h3>
                    <div className="space-y-2">
                      {estadoResultados.cuentasPorCobrar > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700">Por Cobrar:</span>
                          <span className="font-semibold text-amber-700">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
                        </div>
                      )}
                      {estadoResultados.cuentasPorPagar > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700">Por Pagar:</span>
                          <span className="font-semibold text-orange-700">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-purple-300">
                        <span className="font-bold text-purple-900">Diferencia:</span>
                        <span className="font-bold text-purple-700">
                          {formatCurrency(estadoResultados.cuentasPorCobrar - estadoResultados.cuentasPorPagar)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

        {/* Entry Detail Modal */}
        {modalEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setModalEntry(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle (mobile) */}
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 pt-2 sm:pt-5 pb-2">
                <div>
                  <span className="text-xs font-mono text-gray-500">{modalEntry.internalId}</span>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Detalle del Movimiento</h3>
                </div>
                <button onClick={() => setModalEntry(null)} className="text-gray-400 hover:text-gray-600 p-2 -mr-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 min-h-0">
                {/* Amount + Type */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    modalEntry.entryType === 'ingreso' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {modalEntry.entryType === 'ingreso' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {modalEntry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  </span>
                  <span className={`text-2xl font-bold ${modalEntry.entryType === 'ingreso' ? 'text-blue-600' : 'text-red-600'}`}>
                    {modalEntry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(modalEntry.amount)}
                  </span>
                </div>

                {/* Concept */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Concepto</p>
                  <p className="text-sm text-gray-900">{modalEntry.concept}</p>
                </div>

                {/* Grid: Fecha, Estado, Área, Subárea, Forma de Pago, Cuenta */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</p>
                    <p className="text-sm text-gray-900">{formatDate(modalEntry.transactionDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      modalEntry.porRealizar ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {modalEntry.porRealizar ? 'Por Realizar' : 'Realizado'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Área</p>
                    <p className="text-sm text-gray-900">{modalEntry.area || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subárea</p>
                    <p className="text-sm text-gray-900">{modalEntry.subarea || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Forma de Pago</p>
                    <p className="text-sm text-gray-900 capitalize">{modalEntry.formaDePago}</p>
                  </div>
                  {modalEntry.bankAccount && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cuenta Bancaria</p>
                      <p className="text-sm text-gray-900">{modalEntry.bankAccount}</p>
                    </div>
                  )}
                </div>

                {/* Transaction block: VENTA / COMPRA */}
                {(modalEntry.transactionType === 'VENTA' || modalEntry.transactionType === 'COMPRA') && (
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        modalEntry.transactionType === 'VENTA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {modalEntry.transactionType === 'VENTA' ? 'Venta' : 'Compra'}
                      </span>
                      {modalEntry.paymentStatus && (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          modalEntry.paymentStatus === 'PAID' ? 'bg-blue-100 text-blue-800' :
                          modalEntry.paymentStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {modalEntry.paymentStatus === 'PAID' ? 'Pagado' : modalEntry.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                        </span>
                      )}
                    </div>

                    {(modalEntry.client || modalEntry.supplier) && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {modalEntry.transactionType === 'VENTA' ? 'Paciente' : 'Proveedor'}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {modalEntry.client?.businessName || modalEntry.supplier?.businessName}
                        </p>
                      </div>
                    )}

                    {/* Payment breakdown */}
                    <div className="bg-blue-50 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(modalEntry.amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pagado</span>
                        <span className="font-semibold text-blue-600">{formatCurrency(modalEntry.amountPaid || '0')}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1.5 border-t border-blue-200">
                        <span className="font-medium text-gray-700">Saldo</span>
                        <span className={`font-bold ${
                          (parseFloat(modalEntry.amount) - parseFloat(modalEntry.amountPaid || '0')) === 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatCurrency((parseFloat(modalEntry.amount) - parseFloat(modalEntry.amountPaid || '0')).toString())}
                        </span>
                      </div>
                    </div>

                    {/* Link to sale / purchase */}
                    {modalEntry.sale && (
                      <Link href={`/dashboard/practice/ventas/${modalEntry.sale.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Ver venta {modalEntry.sale.saleNumber} →
                      </Link>
                    )}
                    {modalEntry.purchase && (
                      <Link href={`/dashboard/practice/compras/${modalEntry.purchase.id}`} className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                        Ver compra {modalEntry.purchase.purchaseNumber} →
                      </Link>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer — pinned, never scrolls away */}
              <div className="px-5 py-3 border-t border-gray-200 bg-white">
                <Link
                  href={`/dashboard/practice/flujo-de-dinero/${modalEntry.id}/edit`}
                  className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Editar
                </Link>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
