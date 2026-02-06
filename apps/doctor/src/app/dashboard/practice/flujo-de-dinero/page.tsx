"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, DollarSign, Filter, FolderTree, ChevronLeft, ChevronRight, Calendar, ChevronDown, X, CheckSquare, Eye, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Estado de Resultados date filters
  const [estadoStartDate, setEstadoStartDate] = useState('');
  const [estadoEndDate, setEstadoEndDate] = useState('');

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Inline editing for Forma de Pago
  const [editingFormaPagoId, setEditingFormaPagoId] = useState<number | null>(null);
  const [editingFormaPagoValue, setEditingFormaPagoValue] = useState<string>('');
  const [updatingFormaPago, setUpdatingFormaPago] = useState(false);

  const formasDePago = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'deposito', label: 'Depósito' },
  ];

  // Inline editing for Cobrado/Pagado (amountPaid)
  const [editingAmountPaidId, setEditingAmountPaidId] = useState<number | null>(null);
  const [editingAmountPaidValue, setEditingAmountPaidValue] = useState<string>('');
  const [updatingAmountPaid, setUpdatingAmountPaid] = useState(false);

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

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.size} movimiento${selectedIds.size !== 1 ? 's' : ''}?`)) return;

    setDeletingBatch(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        const response = await authFetch(`${API_URL}/api/practice-management/ledger/${id}`, {
          method: 'DELETE'
        });
        if (response.ok || response.status === 204) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    setDeletingBatch(false);
    setSelectedIds(new Set());
    fetchEntries();
    fetchBalance();

    if (errorCount > 0) {
      alert(`Se eliminaron ${successCount} movimientos. ${errorCount} fallaron.`);
    }
  };

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;

    // Dynamic import of jsPDF and autoTable
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    // Get selected entries
    const selectedEntries = entries.filter(entry => selectedIds.has(entry.id));

    // Create PDF document
    const doc = new jsPDF();

    // Add header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Flujo de Dinero - Movimientos', 14, 20);

    // Add date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);

    // Add doctor info if available
    if (doctorProfile) {
      doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, 34);
    }

    // Prepare table data
    const tableData = selectedEntries.map(entry => {
      const amountPaid = parseFloat(entry.amountPaid || '0');
      const total = parseFloat(entry.amount);
      const balance = total - amountPaid;

      return [
        formatDate(entry.transactionDate),
        entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso',
        formatCurrency(entry.amount),
        entry.area,
        entry.subarea,
        cleanConcept(entry.concept).substring(0, 40) + (cleanConcept(entry.concept).length > 40 ? '...' : ''),
        entry.formaDePago || '-',
        entry.entryType === 'ingreso' ? formatCurrency(amountPaid) : '-',
        entry.entryType === 'ingreso' && balance > 0 ? formatCurrency(balance.toString()) : '-',
        entry.entryType === 'egreso' ? formatCurrency(amountPaid) : '-',
        entry.entryType === 'egreso' && balance > 0 ? formatCurrency(balance.toString()) : '-',
      ];
    });

    // Add table
    autoTable(doc, {
      startY: doctorProfile ? 40 : 34,
      head: [['Fecha', 'Tipo', 'Monto', 'Área', 'Subárea', 'Concepto', 'Forma Pago', 'Cobrado', 'Por Cobrar', 'Pagado', 'Por Pagar']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Fecha
        1: { cellWidth: 18 }, // Tipo
        2: { cellWidth: 20, halign: 'right' }, // Monto
        3: { cellWidth: 20 }, // Área
        4: { cellWidth: 20 }, // Subárea
        5: { cellWidth: 30 }, // Concepto
        6: { cellWidth: 18 }, // Forma Pago
        7: { cellWidth: 18, halign: 'right' }, // Cobrado
        8: { cellWidth: 18, halign: 'right' }, // Por Cobrar
        9: { cellWidth: 18, halign: 'right' }, // Pagado
        10: { cellWidth: 18, halign: 'right' }, // Por Pagar
      },
    });

    // Add summary
    const yPosition = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de movimientos: ${selectedEntries.length}`, 14, yPosition);

    // Calculate totals
    const totalIngresos = selectedEntries
      .filter(e => e.entryType === 'ingreso')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalEgresos = selectedEntries
      .filter(e => e.entryType === 'egreso')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    doc.text(`Total Ingresos: ${formatCurrency(totalIngresos.toString())}`, 14, yPosition + 6);
    doc.text(`Total Egresos: ${formatCurrency(totalEgresos.toString())}`, 14, yPosition + 12);
    doc.text(`Balance: ${formatCurrency((totalIngresos - totalEgresos).toString())}`, 14, yPosition + 18);

    // Save PDF
    const fileName = `flujo-de-dinero-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
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

  const handleStartEditFormaPago = (entry: LedgerEntry) => {
    setEditingFormaPagoId(entry.id);
    setEditingFormaPagoValue(entry.formaDePago || '');
  };

  const handleSaveFormaPago = async (entryId: number) => {
    if (!session?.user?.email) return;

    setUpdatingFormaPago(true);

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          formaDePago: editingFormaPagoValue
        })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar forma de pago');
      }

      // Update local state
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === entryId
            ? { ...e, formaDePago: editingFormaPagoValue }
            : e
        )
      );

      // Reset editing state
      setEditingFormaPagoId(null);
      setEditingFormaPagoValue('');
    } catch (err) {
      console.error('Error updating forma de pago:', err);
      alert('Error al actualizar la forma de pago');
    } finally {
      setUpdatingFormaPago(false);
    }
  };

  const handleStartEditAmountPaid = (entry: LedgerEntry) => {
    setEditingAmountPaidId(entry.id);
    setEditingAmountPaidValue(entry.amountPaid || '0');
  };

  const handleSaveAmountPaid = async (entryId: number, totalAmount: string) => {
    if (!session?.user?.email) return;

    const amountPaid = parseFloat(editingAmountPaidValue) || 0;
    const total = parseFloat(totalAmount) || 0;

    // Validate amount doesn't exceed total
    if (amountPaid > total) {
      alert('El monto pagado no puede ser mayor al total');
      return;
    }

    if (amountPaid < 0) {
      alert('El monto no puede ser negativo');
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
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amountPaid: amountPaid,
          paymentStatus: paymentStatus
        })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar monto');
      }

      // Update local state
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === entryId
            ? { ...e, amountPaid: amountPaid.toString(), paymentStatus: paymentStatus }
            : e
        )
      );

      // Reset editing state
      setEditingAmountPaidId(null);
      setEditingAmountPaidValue('');

      // Refresh balance
      fetchBalance();
    } catch (err) {
      console.error('Error updating amount paid:', err);
      alert('Error al actualizar el monto');
    } finally {
      setUpdatingAmountPaid(false);
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

    // Filter entries by date range if specified
    const filteredEntries = entries.filter(entry => {
      const entryDate = entry.transactionDate.split('T')[0];

      if (estadoStartDate && entryDate < estadoStartDate) return false;
      if (estadoEndDate && entryDate > estadoEndDate) return false;

      return true;
    });

    filteredEntries.forEach(entry => {
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

  const handleExportEstadoResultadosPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    let y = 14;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Estado de Resultados', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, y);
    y += 6;

    if (estadoStartDate || estadoEndDate) {
      const from = estadoStartDate || '...';
      const to = estadoEndDate || '...';
      doc.text(`Período: ${from} — ${to}`, 14, y);
      y += 6;
    }

    if (doctorProfile) {
      doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, y);
      y += 6;
    }

    y += 2;

    // --- INGRESOS table ---
    const ingresosRows: (string | number)[][] = [];
    Object.entries(estadoResultados.ingresos).forEach(([area, subareas]) => {
      Object.entries(subareas).forEach(([subarea, amount]) => {
        ingresosRows.push([area, subarea, formatCurrency(amount)]);
      });
    });

    const totalIngresos = Object.values(estadoResultados.ingresos)
      .flatMap(s => Object.values(s))
      .reduce((sum, val) => sum + val, 0);

    if (ingresosRows.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Ingresos', 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Área', 'Subárea', 'Monto']],
        body: ingresosRows,
        foot: [['', 'Total Ingresos Realizados', formatCurrency(totalIngresos)]],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      if (estadoResultados.cuentasPorCobrar > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cuentas por Cobrar: ${formatCurrency(estadoResultados.cuentasPorCobrar)}`, 14, y);
        y += 6;
      }
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No hay ingresos registrados', 14, y);
      y += 8;
    }

    y += 4;

    // --- EGRESOS table ---
    const egresosRows: (string | number)[][] = [];
    Object.entries(estadoResultados.egresos).forEach(([area, subareas]) => {
      Object.entries(subareas).forEach(([subarea, amount]) => {
        egresosRows.push([area, subarea, formatCurrency(amount)]);
      });
    });

    const totalEgresos = Object.values(estadoResultados.egresos)
      .flatMap(s => Object.values(s))
      .reduce((sum, val) => sum + val, 0);

    if (egresosRows.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Egresos', 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Área', 'Subárea', 'Monto']],
        body: egresosRows,
        foot: [['', 'Total Egresos Realizados', formatCurrency(totalEgresos)]],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      if (estadoResultados.cuentasPorPagar > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cuentas por Pagar: ${formatCurrency(estadoResultados.cuentasPorPagar)}`, 14, y);
        y += 6;
      }
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No hay egresos registrados', 14, y);
      y += 8;
    }

    y += 6;

    // --- Balance General ---
    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Monto']],
      body: [
        ['Total Ingresos Realizados', formatCurrency(totalIngresos)],
        ['Total Egresos Realizados', formatCurrency(totalEgresos)],
        ...(estadoResultados.cuentasPorCobrar > 0 ? [['Cuentas por Cobrar', formatCurrency(estadoResultados.cuentasPorCobrar)]] : []),
        ...(estadoResultados.cuentasPorPagar > 0 ? [['Cuentas por Pagar', formatCurrency(estadoResultados.cuentasPorPagar)]] : []),
      ],
      foot: [['Balance Neto', formatCurrency(totalIngresos - totalEgresos)]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 11 },
      columnStyles: { 1: { halign: 'right' } },
    });

    const fileName = `estado-de-resultados-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const getLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = getLocalDateString(new Date());

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Render sort icon for column header
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const filteredEntries = entries
    .filter(entry => {
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
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'fecha':
          aValue = new Date(a.transactionDate).getTime();
          bValue = new Date(b.transactionDate).getTime();
          break;
        case 'tipo':
          aValue = a.entryType;
          bValue = b.entryType;
          break;
        case 'monto':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'area':
          aValue = a.area.toLowerCase();
          bValue = b.area.toLowerCase();
          break;
        case 'concepto':
          aValue = a.concept.toLowerCase();
          bValue = b.concept.toLowerCase();
          break;
        case 'formaDePago':
          aValue = (a.formaDePago || '').toLowerCase();
          bValue = (b.formaDePago || '').toLowerCase();
          break;
        case 'cobrado':
          aValue = parseFloat(a.amountPaid || '0');
          bValue = parseFloat(b.amountPaid || '0');
          break;
        case 'pagado':
          aValue = parseFloat(a.amountPaid || '0');
          bValue = parseFloat(b.amountPaid || '0');
          break;
        case 'estadoPago':
          const statusOrder = { 'PAID': 3, 'PARTIAL': 2, 'PENDING': 1 };
          aValue = statusOrder[a.paymentStatus as keyof typeof statusOrder] || 0;
          bValue = statusOrder[b.paymentStatus as keyof typeof statusOrder] || 0;
          break;
        case 'paciente':
          aValue = (a.client?.businessName || '').toLowerCase();
          bValue = (b.client?.businessName || '').toLowerCase();
          break;
        case 'proveedor':
          aValue = (a.supplier?.businessName || '').toLowerCase();
          bValue = (b.supplier?.businessName || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
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

          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {selectedIds.size} movimiento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
              </div>
            </div>
          )}

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
              {/* Mobile Select All */}
              {filteredEntries.length > 0 && (
                <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                  <input
                    type="checkbox"
                    checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Seleccionar todos</span>
                </div>
              )}
              {filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">
                    {showAllEntries ? "No hay movimientos" : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className={`border rounded-lg p-3 ${selectedIds.has(entry.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                    {/* Checkbox + Amount + Type badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          entry.entryType === 'ingreso' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {entry.entryType === 'ingreso' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </div>
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
                        <button
                          onClick={() => setModalEntry(entry)}
                          className="text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                          className="text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
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
                    <th className="px-4 py-3 text-center w-12 sticky left-0 z-20 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky left-[48px] z-20 bg-gray-50"
                      onClick={() => handleSort('fecha')}
                    >
                      <div className="flex items-center">
                        Fecha
                        {renderSortIcon('fecha')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-[152px] z-20 bg-gray-50 border-r border-gray-200">
                      Acciones
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('tipo')}
                    >
                      <div className="flex items-center">
                        Tipo
                        {renderSortIcon('tipo')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('monto')}
                    >
                      <div className="flex items-center justify-end">
                        Monto
                        {renderSortIcon('monto')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => handleSort('area')}
                    >
                      <div className="flex items-center">
                        Área
                        {renderSortIcon('area')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('concepto')}
                    >
                      <div className="flex items-center">
                        Concepto
                        {renderSortIcon('concepto')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('estadoPago')}
                    >
                      <div className="flex items-center justify-center">
                        Estado Pago
                        {renderSortIcon('estadoPago')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => handleSort('formaDePago')}
                    >
                      <div className="flex items-center">
                        Forma de Pago
                        {renderSortIcon('formaDePago')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => handleSort('cobrado')}
                    >
                      <div className="flex items-center justify-end">
                        Cobrado
                        {renderSortIcon('cobrado')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">
                      Por Cobrar
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => handleSort('pagado')}
                    >
                      <div className="flex items-center justify-end">
                        Pagado
                        {renderSortIcon('pagado')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">
                      Por Pagar
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('paciente')}
                    >
                      <div className="flex items-center">
                        Paciente
                        {renderSortIcon('paciente')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('proveedor')}
                    >
                      <div className="flex items-center">
                        Proveedor
                        {renderSortIcon('proveedor')}
                      </div>
                    </th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">
                        {showAllEntries ? "No hay movimientos registrados" : `Sin movimientos para ${formatDate(ledgerDate + 'T00:00:00')}`}
                      </p>
                      {showAllEntries && <p className="text-sm mt-1">Crea tu primer movimiento para comenzar</p>}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                      {/* Checkbox */}
                      <td className="px-4 py-4 text-center sticky left-0 z-10 bg-white group-hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      {/* Fecha */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 sticky left-[48px] z-10 bg-white group-hover:bg-gray-50">
                        {formatDate(entry.transactionDate)}
                      </td>
                      {/* Acciones */}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium sticky left-[152px] z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setModalEntry(entry)}
                            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                      {/* Tipo */}
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
                      {/* Monto */}
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                        entry.entryType === 'ingreso' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
                      </td>
                      {/* Área */}
                      <td className="px-6 py-4 text-sm bg-amber-50">
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
                            onClick={() => handleStartEditArea(entry)}
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
                      {/* Concepto */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={cleanConcept(entry.concept)}>
                          {cleanConcept(entry.concept)}
                        </div>
                        {entry.bankAccount && (
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.bankAccount}
                          </div>
                        )}
                      </td>
                      {/* Estado Pago */}
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
                      {/* Forma de Pago */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm bg-amber-50">
                        {editingFormaPagoId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingFormaPagoValue}
                              onChange={(e) => setEditingFormaPagoValue(e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              disabled={updatingFormaPago}
                              autoFocus
                            >
                              <option value="">Seleccionar...</option>
                              {formasDePago.map(fp => (
                                <option key={fp.value} value={fp.value}>
                                  {fp.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveFormaPago(entry.id)}
                              disabled={updatingFormaPago || !editingFormaPagoValue}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingFormaPago ? '...' : '✓'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingFormaPagoId(null);
                                setEditingFormaPagoValue('');
                              }}
                              disabled={updatingFormaPago}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-gray-700 capitalize cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-between gap-2"
                            onClick={() => handleStartEditFormaPago(entry)}
                            title="Click para editar forma de pago"
                          >
                            <span>{entry.formaDePago || <span className="text-gray-400">-</span>}</span>
                            <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>
                      {/* Cobrado (for ventas/ingresos) */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm bg-blue-50">
                        {entry.entryType === 'ingreso' ? (
                          editingAmountPaidId === entry.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={entry.amount}
                                value={editingAmountPaidValue}
                                onChange={(e) => setEditingAmountPaidValue(e.target.value)}
                                className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={updatingAmountPaid}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAmountPaid(entry.id, entry.amount);
                                  if (e.key === 'Escape') { setEditingAmountPaidId(null); setEditingAmountPaidValue(''); }
                                }}
                              />
                              <button
                                onClick={() => handleSaveAmountPaid(entry.id, entry.amount)}
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
                              onClick={() => handleStartEditAmountPaid(entry)}
                              title="Click para editar monto cobrado"
                            >
                              <span>{formatCurrency(entry.amountPaid || '0')}</span>
                              <Edit2 className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Por Cobrar (for ventas/ingresos) */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {entry.entryType === 'ingreso' ? (
                          (() => {
                            const total = parseFloat(entry.amount);
                            const paid = parseFloat(entry.amountPaid || '0');
                            const balance = total - paid;
                            return balance > 0 ? (
                              <span className="font-semibold text-orange-600">
                                {formatCurrency(balance.toString())}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Pagado (for compras/egresos) */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm bg-blue-50">
                        {entry.entryType === 'egreso' ? (
                          editingAmountPaidId === entry.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={entry.amount}
                                value={editingAmountPaidValue}
                                onChange={(e) => setEditingAmountPaidValue(e.target.value)}
                                className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={updatingAmountPaid}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAmountPaid(entry.id, entry.amount);
                                  if (e.key === 'Escape') { setEditingAmountPaidId(null); setEditingAmountPaidValue(''); }
                                }}
                              />
                              <button
                                onClick={() => handleSaveAmountPaid(entry.id, entry.amount)}
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
                              onClick={() => handleStartEditAmountPaid(entry)}
                              title="Click para editar monto pagado"
                            >
                              <span>{formatCurrency(entry.amountPaid || '0')}</span>
                              <Edit2 className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Por Pagar (for compras/egresos) */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {entry.entryType === 'egreso' ? (
                          (() => {
                            const total = parseFloat(entry.amount);
                            const paid = parseFloat(entry.amountPaid || '0');
                            const balance = total - paid;
                            return balance > 0 ? (
                              <span className="font-semibold text-red-600">
                                {formatCurrency(balance.toString())}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Paciente */}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.client ? (
                          <div className="max-w-xs truncate" title={entry.client.businessName}>
                            {entry.client.businessName}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      {/* Proveedor */}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.supplier ? (
                          <div className="max-w-xs truncate" title={entry.supplier.businessName}>
                            {entry.supplier.businessName}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
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
            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Date Filter */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">Período:</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600 whitespace-nowrap">Desde:</label>
                      <input
                        type="date"
                        value={estadoStartDate}
                        onChange={(e) => setEstadoStartDate(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600 whitespace-nowrap">Hasta:</label>
                      <input
                        type="date"
                        value={estadoEndDate}
                        onChange={(e) => setEstadoEndDate(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {(estadoStartDate || estadoEndDate) && (
                      <button
                        onClick={() => {
                          setEstadoStartDate('');
                          setEstadoEndDate('');
                        }}
                        className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Limpiar
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleExportEstadoResultadosPDF}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors ml-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar PDF
                  </button>
                </div>
              </div>

              {/* INGRESOS Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-blue-600 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
                  <TrendingUp className="w-4 h-4" />
                  Ingresos
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {Object.keys(estadoResultados.ingresos).length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">No hay ingresos registrados</p>
                ) : (
                  Object.entries(estadoResultados.ingresos).map(([area, subareas]) => {
                    const areaTotal = Object.values(subareas).reduce((sum, val) => sum + val, 0);
                    return (
                      <div key={area} className="border-l-2 border-blue-400 pl-3">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2">{area}</h3>
                        <div className="space-y-1 ml-3">
                          {Object.entries(subareas).map(([subarea, amount]) => (
                            <div key={subarea} className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-gray-600 text-xs">└── {subarea}</span>
                              <span className="font-medium text-blue-600 text-xs">{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                          <span className="font-semibold text-gray-900 text-xs">Total {area}</span>
                          <span className="font-semibold text-blue-600 text-sm">{formatCurrency(areaTotal)}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Cuentas por Cobrar */}
                {estadoResultados.cuentasPorCobrar > 0 && (
                  <div className="bg-amber-50 border-l-2 border-amber-400 p-3 rounded-r">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-amber-900 text-xs flex items-center gap-1.5">
                          💵 Cuentas por Cobrar
                        </h3>
                        <p className="text-[10px] text-amber-700 mt-0.5">Monto pendiente de recibir</p>
                      </div>
                      <span className="font-semibold text-amber-700 text-sm">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
                    </div>
                  </div>
                )}

                {/* Total Ingresos */}
                <div className="bg-blue-50 border border-blue-300 p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900 text-xs uppercase tracking-wide">Total Ingresos Realizados</span>
                    <span className="font-bold text-blue-700 text-base">
                      {formatCurrency(
                        Object.values(estadoResultados.ingresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* EGRESOS Section */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-red-600 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
                  <TrendingDown className="w-4 h-4" />
                  Egresos
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {Object.keys(estadoResultados.egresos).length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">No hay egresos registrados</p>
                ) : (
                  Object.entries(estadoResultados.egresos).map(([area, subareas]) => {
                    const areaTotal = Object.values(subareas).reduce((sum, val) => sum + val, 0);
                    return (
                      <div key={area} className="border-l-2 border-red-400 pl-3">
                        <h3 className="font-semibold text-sm text-gray-900 mb-2">{area}</h3>
                        <div className="space-y-1 ml-3">
                          {Object.entries(subareas).map(([subarea, amount]) => (
                            <div key={subarea} className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-gray-600 text-xs">└── {subarea}</span>
                              <span className="font-medium text-red-600 text-xs">{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-red-200 flex justify-between items-center">
                          <span className="font-semibold text-gray-900 text-xs">Total {area}</span>
                          <span className="font-semibold text-red-600 text-sm">{formatCurrency(areaTotal)}</span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Cuentas por Pagar */}
                {estadoResultados.cuentasPorPagar > 0 && (
                  <div className="bg-orange-50 border-l-2 border-orange-400 p-3 rounded-r">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-orange-900 text-xs flex items-center gap-1.5">
                          💳 Cuentas por Pagar
                        </h3>
                        <p className="text-[10px] text-orange-700 mt-0.5">Monto pendiente de pagar</p>
                      </div>
                      <span className="font-semibold text-orange-700 text-sm">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
                    </div>
                  </div>
                )}

                {/* Total Egresos */}
                <div className="bg-red-50 border border-red-300 p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-900 text-xs uppercase tracking-wide">Total Egresos Realizados</span>
                    <span className="font-bold text-red-700 text-base">
                      {formatCurrency(
                        Object.values(estadoResultados.egresos)
                          .flatMap(subareas => Object.values(subareas))
                          .reduce((sum, val) => sum + val, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* Balance General */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
                  <DollarSign className="w-4 h-4" />
                  Balance General
                </h2>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 text-xs">Total Ingresos Realizados</span>
                  <span className="font-semibold text-blue-600 text-sm">
                    {formatCurrency(
                      Object.values(estadoResultados.ingresos)
                        .flatMap(subareas => Object.values(subareas))
                        .reduce((sum, val) => sum + val, 0)
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600 text-xs">Total Egresos Realizados</span>
                  <span className="font-semibold text-red-600 text-sm">
                    {formatCurrency(
                      Object.values(estadoResultados.egresos)
                        .flatMap(subareas => Object.values(subareas))
                        .reduce((sum, val) => sum + val, 0)
                    )}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-300 p-3 rounded mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900 text-sm">Balance Neto</span>
                    <span className="font-bold text-slate-700 text-base">
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
                  <p className="text-[10px] text-slate-600 mt-1 text-center">Ingresos Realizados - Egresos Realizados</p>
                </div>

                {(estadoResultados.cuentasPorCobrar > 0 || estadoResultados.cuentasPorPagar > 0) && (
                  <div className="bg-purple-50 border border-purple-300 p-3 rounded mt-2">
                    <h3 className="font-semibold text-purple-900 text-xs mb-2">Flujo Pendiente</h3>
                    <div className="space-y-1.5">
                      {estadoResultados.cuentasPorCobrar > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700 text-xs">Por Cobrar:</span>
                          <span className="font-medium text-amber-700 text-xs">{formatCurrency(estadoResultados.cuentasPorCobrar)}</span>
                        </div>
                      )}
                      {estadoResultados.cuentasPorPagar > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-purple-700 text-xs">Por Pagar:</span>
                          <span className="font-medium text-orange-700 text-xs">{formatCurrency(estadoResultados.cuentasPorPagar)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-purple-300">
                        <span className="font-semibold text-purple-900 text-xs">Diferencia:</span>
                        <span className="font-semibold text-purple-700 text-sm">
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
