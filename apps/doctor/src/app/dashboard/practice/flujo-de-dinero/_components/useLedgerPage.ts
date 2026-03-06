'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getLocalDateString } from '@/lib/dates';
import { authFetch } from '@/lib/auth-fetch';
import type { LedgerEntry, Area, Balance, DoctorProfile } from './ledger-types';
import {
  formatCurrency,
  formatDate,
  cleanConcept,
  processEstadoResultados,
  type EstadoResultadosData,
} from './ledger-utils';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useLedgerPage() {
  const { data: session, status } = useSession({ required: true });

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [balance, setBalance] = useState<Balance>({
    totalIngresos: 0, totalEgresos: 0, balance: 0,
    pendingIngresos: 0, pendingEgresos: 0, projectedBalance: 0,
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

  // Inline editing — area
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editingAreaData, setEditingAreaData] = useState<{ area: string; subarea: string }>({ area: '', subarea: '' });
  const [updatingArea, setUpdatingArea] = useState(false);

  // Inline editing — forma de pago
  const [editingFormaPagoId, setEditingFormaPagoId] = useState<number | null>(null);
  const [editingFormaPagoValue, setEditingFormaPagoValue] = useState<string>('');
  const [updatingFormaPago, setUpdatingFormaPago] = useState(false);

  // Inline editing — amount paid
  const [editingAmountPaidId, setEditingAmountPaidId] = useState<number | null>(null);
  const [editingAmountPaidValue, setEditingAmountPaidValue] = useState<string>('');
  const [updatingAmountPaid, setUpdatingAmountPaid] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [modalEntry, setModalEntry] = useState<LedgerEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Estado de Resultados date filters
  const [estadoStartDate, setEstadoStartDate] = useState('');
  const [estadoEndDate, setEstadoEndDate] = useState('');

  // Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const todayStr = getLocalDateString(new Date());

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/doctors`);
      const result = await res.json();
      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) setDoctorProfile(doctor);
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
    }
  };

  const fetchBalance = async () => {
    if (!session?.user?.email) return;
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/balance`);
      if (!res.ok) throw new Error('Error al cargar balance');
      const result = await res.json();
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

      const res = await authFetch(`${API_URL}/api/practice-management/ledger?${params}`);
      if (!res.ok) throw new Error('Error al cargar movimientos');
      const result = await res.json();
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
      const res = await authFetch(`${API_URL}/api/practice-management/areas`);
      if (!res.ok) throw new Error('Error al cargar áreas');
      const result = await res.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      if (session.user?.doctorId) fetchDoctorProfile(session.user.doctorId);
      fetchEntries();
      fetchBalance();
      fetchAreas();
    }
  }, [entryTypeFilter, porRealizarFilter, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Delete handlers ────────────────────────────────────────────────────────

  const handleDelete = async (id: number, internalId: string) => {
    if (!await practiceConfirm(`¿Estás seguro de eliminar el movimiento ${internalId}?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${id}`, { method: 'DELETE' });
      let result: any;
      try { result = await res.json(); } catch (_) { /* no-op */ }
      if (res.ok || res.status === 204 || result?.success) {
        fetchEntries();
        fetchBalance();
      } else {
        throw new Error(result?.error || 'Error al eliminar movimiento');
      }
    } catch (err) {
      console.error('Error al eliminar movimiento:', err);
      toast.error('Error al eliminar movimiento');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await practiceConfirm(`¿Estás seguro de eliminar ${selectedIds.size} movimiento${selectedIds.size !== 1 ? 's' : ''}?`)) return;

    setDeletingBatch(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        const res = await authFetch(`${API_URL}/api/practice-management/ledger/${id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) successCount++;
        else errorCount++;
      } catch { errorCount++; }
    }

    setDeletingBatch(false);
    setSelectedIds(new Set());
    fetchEntries();
    fetchBalance();

    if (errorCount > 0) toast.error(`Se eliminaron ${successCount} movimientos. ${errorCount} fallaron.`);
  };

  // ─── Inline editing — area ──────────────────────────────────────────────────

  const handleStartEditArea = (entry: LedgerEntry) => {
    setEditingAreaId(entry.id);
    setEditingAreaData({ area: entry.area, subarea: entry.subarea });
  };

  const handleCancelEditArea = () => {
    setEditingAreaId(null);
    setEditingAreaData({ area: '', subarea: '' });
  };

  const handleSaveArea = async (entryId: number) => {
    if (!editingAreaData.area) return;
    setUpdatingArea(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: editingAreaData.area, subarea: editingAreaData.subarea || '' }),
      });
      if (!res.ok) throw new Error('Error al actualizar área');
      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, area: editingAreaData.area, subarea: editingAreaData.subarea }
        : e));
      setEditingAreaId(null);
      setEditingAreaData({ area: '', subarea: '' });
    } catch (err) {
      console.error('Error updating area:', err);
      toast.error('Error al actualizar el área');
    } finally {
      setUpdatingArea(false);
    }
  };

  // ─── Inline editing — forma de pago ─────────────────────────────────────────

  const handleStartEditFormaPago = (entry: LedgerEntry) => {
    setEditingFormaPagoId(entry.id);
    setEditingFormaPagoValue(entry.formaDePago || '');
  };

  const handleCancelEditFormaPago = () => {
    setEditingFormaPagoId(null);
    setEditingFormaPagoValue('');
  };

  const handleSaveFormaPago = async (entryId: number) => {
    setUpdatingFormaPago(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formaDePago: editingFormaPagoValue }),
      });
      if (!res.ok) throw new Error('Error al actualizar forma de pago');
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, formaDePago: editingFormaPagoValue } : e));
      setEditingFormaPagoId(null);
      setEditingFormaPagoValue('');
    } catch (err) {
      console.error('Error updating forma de pago:', err);
      toast.error('Error al actualizar la forma de pago');
    } finally {
      setUpdatingFormaPago(false);
    }
  };

  // ─── Inline editing — amount paid ───────────────────────────────────────────

  const handleStartEditAmountPaid = (entry: LedgerEntry) => {
    setEditingAmountPaidId(entry.id);
    setEditingAmountPaidValue(entry.amountPaid || '0');
  };

  const handleCancelEditAmountPaid = () => {
    setEditingAmountPaidId(null);
    setEditingAmountPaidValue('');
  };

  const handleSaveAmountPaid = async (entryId: number, totalAmount: string) => {
    const amountPaid = parseFloat(editingAmountPaidValue) || 0;
    const total = parseFloat(totalAmount) || 0;

    if (amountPaid > total) { toast.error('El monto pagado no puede ser mayor al total'); return; }
    if (amountPaid < 0) { toast.error('El monto no puede ser negativo'); return; }

    const paymentStatus = amountPaid === 0 ? 'PENDING' : amountPaid >= total ? 'PAID' : 'PARTIAL';

    setUpdatingAmountPaid(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountPaid, paymentStatus }),
      });
      if (!res.ok) throw new Error('Error al actualizar monto');
      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, amountPaid: amountPaid.toString(), paymentStatus }
        : e));
      setEditingAmountPaidId(null);
      setEditingAmountPaidValue('');
      fetchBalance();
    } catch (err) {
      console.error('Error updating amount paid:', err);
      toast.error('Error al actualizar el monto');
    } finally {
      setUpdatingAmountPaid(false);
    }
  };

  // ─── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // ─── Derived state ───────────────────────────────────────────────────────────

  const filteredEntries = entries
    .filter(entry => {
      if (!showAllEntries) {
        const entryDate = entry.transactionDate.split('T')[0];
        if (entryDate !== ledgerDate) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return entry.concept.toLowerCase().includes(s) ||
          entry.internalId.toLowerCase().includes(s) ||
          entry.area.toLowerCase().includes(s) ||
          entry.subarea.toLowerCase().includes(s);
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'fecha': aVal = new Date(a.transactionDate).getTime(); bVal = new Date(b.transactionDate).getTime(); break;
        case 'tipo': aVal = a.entryType; bVal = b.entryType; break;
        case 'monto': aVal = parseFloat(a.amount); bVal = parseFloat(b.amount); break;
        case 'area': aVal = a.area.toLowerCase(); bVal = b.area.toLowerCase(); break;
        case 'concepto': aVal = a.concept.toLowerCase(); bVal = b.concept.toLowerCase(); break;
        case 'formaDePago': aVal = (a.formaDePago || '').toLowerCase(); bVal = (b.formaDePago || '').toLowerCase(); break;
        case 'cobrado':
        case 'pagado': aVal = parseFloat(a.amountPaid || '0'); bVal = parseFloat(b.amountPaid || '0'); break;
        case 'estadoPago': {
          const ord = { PAID: 3, PARTIAL: 2, PENDING: 1 } as Record<string, number>;
          aVal = ord[a.paymentStatus || ''] || 0; bVal = ord[b.paymentStatus || ''] || 0; break;
        }
        case 'paciente': aVal = (a.client?.businessName || '').toLowerCase(); bVal = (b.client?.businessName || '').toLowerCase(); break;
        case 'proveedor': aVal = (a.supplier?.businessName || '').toLowerCase(); bVal = (b.supplier?.businessName || '').toLowerCase(); break;
        default: return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const estadoResultados: EstadoResultadosData = processEstadoResultados(entries, estadoStartDate, estadoEndDate);

  // ─── PDF exports ─────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const selectedEntries = entries.filter(e => selectedIds.has(e.id));
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Flujo de Dinero - Movimientos', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);
    if (doctorProfile) doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, 34);

    const tableData = selectedEntries.map(entry => {
      const paid = parseFloat(entry.amountPaid || '0');
      const total = parseFloat(entry.amount);
      const bal = total - paid;
      return [
        formatDate(entry.transactionDate),
        entry.entryType === 'ingreso' ? 'Ingreso' : 'Egreso',
        formatCurrency(entry.amount),
        entry.area, entry.subarea,
        cleanConcept(entry.concept).substring(0, 40) + (cleanConcept(entry.concept).length > 40 ? '...' : ''),
        entry.formaDePago || '-',
        entry.entryType === 'ingreso' ? formatCurrency(paid) : '-',
        entry.entryType === 'ingreso' && bal > 0 ? formatCurrency(bal.toString()) : '-',
        entry.entryType === 'egreso' ? formatCurrency(paid) : '-',
        entry.entryType === 'egreso' && bal > 0 ? formatCurrency(bal.toString()) : '-',
      ];
    });

    autoTable(doc, {
      startY: doctorProfile ? 40 : 34,
      head: [['Fecha', 'Tipo', 'Monto', 'Área', 'Subárea', 'Concepto', 'Forma Pago', 'Cobrado', 'Por Cobrar', 'Pagado', 'Por Pagar']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 18 }, 2: { cellWidth: 20, halign: 'right' }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 30 }, 6: { cellWidth: 18 }, 7: { cellWidth: 18, halign: 'right' }, 8: { cellWidth: 18, halign: 'right' }, 9: { cellWidth: 18, halign: 'right' }, 10: { cellWidth: 18, halign: 'right' } },
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    const totalIngresos = selectedEntries.filter(e => e.entryType === 'ingreso').reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalEgresos = selectedEntries.filter(e => e.entryType === 'egreso').reduce((s, e) => s + parseFloat(e.amount), 0);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Total de movimientos: ${selectedEntries.length}`, 14, y);
    doc.text(`Total Ingresos: ${formatCurrency(totalIngresos.toString())}`, 14, y + 6);
    doc.text(`Total Egresos: ${formatCurrency(totalEgresos.toString())}`, 14, y + 12);
    doc.text(`Balance: ${formatCurrency((totalIngresos - totalEgresos).toString())}`, 14, y + 18);
    doc.save(`flujo-de-dinero-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportEstadoResultadosPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    let y = 14;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Estado de Resultados', 14, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, y); y += 6;
    if (estadoStartDate || estadoEndDate) {
      doc.text(`Período: ${estadoStartDate || '...'} — ${estadoEndDate || '...'}`, 14, y); y += 6;
    }
    if (doctorProfile) { doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, y); y += 6; }
    y += 2;

    const totalIngresos = Object.values(estadoResultados.ingresos).flatMap(s => Object.values(s)).reduce((s, v) => s + v, 0);
    const totalEgresos = Object.values(estadoResultados.egresos).flatMap(s => Object.values(s)).reduce((s, v) => s + v, 0);

    const ingresosRows: (string | number)[][] = [];
    Object.entries(estadoResultados.ingresos).forEach(([area, subareas]) =>
      Object.entries(subareas).forEach(([subarea, amount]) => ingresosRows.push([area, subarea, formatCurrency(amount)]))
    );
    if (ingresosRows.length > 0) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Ingresos', 14, y); y += 2;
      autoTable(doc, { startY: y, head: [['Área', 'Subárea', 'Monto']], body: ingresosRows, foot: [['', 'Total Ingresos Realizados', formatCurrency(totalIngresos)]], styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold' }, columnStyles: { 2: { halign: 'right' } } });
      y = (doc as any).lastAutoTable.finalY + 4;
      if (estadoResultados.cuentasPorCobrar > 0) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(`Cuentas por Cobrar: ${formatCurrency(estadoResultados.cuentasPorCobrar)}`, 14, y); y += 6; }
    } else {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('No hay ingresos registrados', 14, y); y += 8;
    }
    y += 4;

    const egresosRows: (string | number)[][] = [];
    Object.entries(estadoResultados.egresos).forEach(([area, subareas]) =>
      Object.entries(subareas).forEach(([subarea, amount]) => egresosRows.push([area, subarea, formatCurrency(amount)]))
    );
    if (egresosRows.length > 0) {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Egresos', 14, y); y += 2;
      autoTable(doc, { startY: y, head: [['Área', 'Subárea', 'Monto']], body: egresosRows, foot: [['', 'Total Egresos Realizados', formatCurrency(totalEgresos)]], styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: 'bold' }, columnStyles: { 2: { halign: 'right' } } });
      y = (doc as any).lastAutoTable.finalY + 4;
      if (estadoResultados.cuentasPorPagar > 0) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(`Cuentas por Pagar: ${formatCurrency(estadoResultados.cuentasPorPagar)}`, 14, y); y += 6; }
    } else {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('No hay egresos registrados', 14, y); y += 8;
    }
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Monto']],
      body: [['Total Ingresos Realizados', formatCurrency(totalIngresos)], ['Total Egresos Realizados', formatCurrency(totalEgresos)], ...(estadoResultados.cuentasPorCobrar > 0 ? [['Cuentas por Cobrar', formatCurrency(estadoResultados.cuentasPorCobrar)]] : []), ...(estadoResultados.cuentasPorPagar > 0 ? [['Cuentas por Pagar', formatCurrency(estadoResultados.cuentasPorPagar)]] : [])],
      foot: [['Balance Neto', formatCurrency(totalIngresos - totalEgresos)]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 11 },
      columnStyles: { 1: { halign: 'right' } },
    });
    doc.save(`estado-de-resultados-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return {
    // Session/loading
    sessionStatus: status,
    loading,

    // Data
    entries,
    areas,
    doctorProfile,
    balance,
    filteredEntries,
    estadoResultados,
    todayStr,

    // Tab
    activeTab,
    setActiveTab,

    // Filters
    searchTerm, setSearchTerm,
    entryTypeFilter, setEntryTypeFilter,
    porRealizarFilter, setPorRealizarFilter,
    startDate, setStartDate,
    endDate, setEndDate,
    showFilters, setShowFilters,

    // Day navigator
    showAllEntries, setShowAllEntries,
    ledgerDate, setLedgerDate,

    // Selection
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,

    // Batch
    deletingBatch,
    handleBatchDelete,

    // Delete
    handleDelete,

    // Estado de Resultados date filters
    estadoStartDate, setEstadoStartDate,
    estadoEndDate, setEstadoEndDate,

    // Sorting
    sortColumn,
    sortDirection,
    handleSort,

    // Modal
    modalEntry, setModalEntry,

    // Inline editing — area
    editingAreaId,
    editingAreaData, setEditingAreaData,
    updatingArea,
    handleStartEditArea,
    handleSaveArea,
    handleCancelEditArea,

    // Inline editing — forma de pago
    editingFormaPagoId,
    editingFormaPagoValue, setEditingFormaPagoValue,
    updatingFormaPago,
    handleStartEditFormaPago,
    handleSaveFormaPago,
    handleCancelEditFormaPago,

    // Inline editing — amount paid
    editingAmountPaidId,
    editingAmountPaidValue, setEditingAmountPaidValue,
    updatingAmountPaid,
    handleStartEditAmountPaid,
    handleSaveAmountPaid,
    handleCancelEditAmountPaid,

    // PDF exports
    handleExportPDF,
    handleExportEstadoResultadosPDF,

    // Refresh
    fetchEntries,
    fetchBalance,
  };
}
