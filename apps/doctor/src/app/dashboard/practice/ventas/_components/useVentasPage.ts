'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { validateSaleTransition, SaleStatus } from '@/lib/practice/statusTransitions';
import type { ToastType } from '@/components/ui/Toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import {
  formatCurrency,
  formatDateShort,
  fetchDoctorProfile as fetchDoctorProfileUtil,
  type PracticeDoctorProfile,
} from '@/lib/practice-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
}

export interface Sale {
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

export const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-blue-100 text-blue-800', icon: '✅' },
};

export function useVentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);
  const [editingAmountPaidId, setEditingAmountPaidId] = useState<number | null>(null);
  const [editingAmountPaidValue, setEditingAmountPaidValue] = useState<string>('');
  const [updatingAmountPaid, setUpdatingAmountPaid] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  const formatDate = formatDateShort;

  const fetchDoctorProfile = async (doctorId: string) => {
    const profile = await fetchDoctorProfileUtil(doctorId);
    if (profile) setDoctorProfile(profile);
  };

  const fetchSales = async (currentStatusFilter = statusFilter, currentPaymentFilter = paymentFilter, currentPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentStatusFilter !== 'all') params.append('status', currentStatusFilter);
      if (currentPaymentFilter !== 'all') params.append('paymentStatus', currentPaymentFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', String(currentPage));
      params.append('limit', '20');
      const response = await authFetch(`${API_URL}/api/practice-management/ventas?${params}`);
      if (!response.ok) throw new Error('Error al cargar ventas');
      const result = await response.json();
      setSales(result.data || []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when search changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSales(statusFilter, paymentFilter, 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: number) => {
    if (!await practiceConfirm('¿Estás seguro de eliminar esta venta?')) return;
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar venta');
      fetchSales();
    } catch (err) {
      console.error('Error al eliminar venta:', err);
      setToastMessage({ message: 'Error al eliminar venta', type: 'error' });
    }
  };

  const handleSaleStatusChange = async (saleId: number, oldStatus: string, newStatus: string) => {
    const validation = validateSaleTransition(oldStatus as SaleStatus, newStatus as SaleStatus);
    if (!validation.allowed) {
      setToastMessage({ message: validation.errorMessage || 'Transición no permitida', type: 'error' });
      return;
    }
    if (validation.requiresConfirmation && validation.confirmationMessage) {
      if (!await practiceConfirm(validation.confirmationMessage)) return;
    }

    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: newStatus } : s));
    setUpdatingId(saleId);

    try {
      const updateResponse = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!updateResponse.ok) throw new Error('Error al actualizar estado');
      await fetchSales();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: oldStatus } : s));
      const msg = error.message.includes('permisos') ? 'No tienes permisos para cambiar el estado'
        : error.message.includes('conectar') ? 'No se pudo conectar. Verifica tu conexión.'
        : 'Error al actualizar estado. Intenta de nuevo.';
      setToastMessage({ message: msg, type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartEditAmountPaid = (sale: Sale) => {
    setEditingAmountPaidId(sale.id);
    setEditingAmountPaidValue(sale.amountPaid || '0');
  };

  const handleSaveAmountPaid = async (saleId: number, totalAmount: string) => {
    const amountPaid = parseFloat(editingAmountPaidValue) || 0;
    const total = parseFloat(totalAmount) || 0;
    if (amountPaid > total) {
      setToastMessage({ message: 'El monto cobrado no puede ser mayor al total', type: 'error' });
      return;
    }
    if (amountPaid < 0) {
      setToastMessage({ message: 'El monto no puede ser negativo', type: 'error' });
      return;
    }
    setUpdatingAmountPaid(true);
    try {
      const updateResponse = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ amountPaid }),
      });
      if (!updateResponse.ok) throw new Error('Error al actualizar monto');
      await fetchSales();
      setToastMessage({ message: 'Monto actualizado exitosamente', type: 'success' });
      setEditingAmountPaidId(null);
      setEditingAmountPaidValue('');
    } catch (error: any) {
      const msg = error.message.includes('permisos') ? 'No tienes permisos para actualizar el monto'
        : error.message.includes('conectar') ? 'No se pudo conectar. Verifica tu conexión.'
        : 'Error al actualizar monto. Intenta de nuevo.';
      setToastMessage({ message: msg, type: 'error' });
    } finally {
      setUpdatingAmountPaid(false);
    }
  };

  const handleCancelEditAmountPaid = () => {
    setEditingAmountPaidId(null);
    setEditingAmountPaidValue('');
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredSales = sales;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSales.map(s => s.id)));
    }
  };

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const selectedSales = filteredSales.filter(s => selectedIds.has(s.id));
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Ventas en Firme', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);
    if (doctorProfile) doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, 34);
    const tableData = selectedSales.map(sale => {
      const total = parseFloat(sale.total);
      const paid = parseFloat(sale.amountPaid || '0');
      const pending = total - paid;
      const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
      const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
      return [sale.saleNumber, sale.client.businessName, formatDate(sale.saleDate), formatCurrency(sale.total), formatCurrency(sale.amountPaid), pending > 0 ? formatCurrency(pending.toString()) : '-', paymentConf.label, statusConf.label];
    });
    autoTable(doc, {
      startY: doctorProfile ? 40 : 34,
      head: [['Folio', 'Paciente', 'Fecha', 'Total', 'Cobrado', 'Por Cobrar', 'Estado Pago', 'Estado']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
    const yPos = (doc as any).lastAutoTable.finalY + 10;
    const totalVentas = selectedSales.reduce((sum, s) => sum + parseFloat(s.total), 0);
    const totalCobrado = selectedSales.reduce((sum, s) => sum + parseFloat(s.amountPaid || '0'), 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de ventas: ${selectedSales.length}`, 14, yPos);
    doc.text(`Total: ${formatCurrency(totalVentas.toString())}`, 14, yPos + 6);
    doc.text(`Cobrado: ${formatCurrency(totalCobrado.toString())}`, 14, yPos + 12);
    doc.text(`Por Cobrar: ${formatCurrency((totalVentas - totalCobrado).toString())}`, 14, yPos + 18);
    doc.save(`ventas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalSales = filteredSales.reduce((sum, s) => sum + parseFloat(s.total), 0);
  const totalPaid = filteredSales.reduce((sum, s) => sum + parseFloat(s.amountPaid || '0'), 0);
  const totalPending = totalSales - totalPaid;

  return {
    sales, loading,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    paymentFilter, setPaymentFilter,
    updatingId,
    toastMessage, setToastMessage,
    selectedIds,
    doctorProfile,
    editingAmountPaidId,
    editingAmountPaidValue, setEditingAmountPaidValue,
    updatingAmountPaid,
    fetchDoctorProfile, fetchSales,
    handleDelete, handleSaleStatusChange,
    handleStartEditAmountPaid, handleSaveAmountPaid, handleCancelEditAmountPaid,
    toggleSelect, toggleSelectAll, handleExportPDF,
    deselectAll: () => setSelectedIds(new Set()),
    formatDate, formatCurrency,
    filteredSales,
    totalSales, totalPaid, totalPending,
    page, setPage, pagination,
  };
}
