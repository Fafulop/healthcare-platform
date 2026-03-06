'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { validateQuotationTransition, QuotationStatus } from '@/lib/practice/statusTransitions';
import type { ToastType } from '@/components/ui/Toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import {
  formatCurrency,
  formatDateShort,
  fetchDoctorProfile as fetchDoctorProfileUtil,
  type PracticeDoctorProfile,
} from '@/lib/practice-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface QuotationClient {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

export interface QuotationListItem {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  tax: string | null;
  total: string;
  client: QuotationClient;
  items: QuotationListItem[];
}

export const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: '📤' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '❌' },
  EXPIRED: { label: 'Vencida', color: 'bg-orange-100 text-orange-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export function useCotizacionesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [doctorProfile, setDoctorProfile] = useState<PracticeDoctorProfile | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  const formatDate = formatDateShort;

  const fetchDoctorProfile = async (doctorId: string) => {
    const profile = await fetchDoctorProfileUtil(doctorId);
    if (profile) setDoctorProfile(profile);
  };

  const fetchQuotations = async (currentStatusFilter = statusFilter, currentPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentStatusFilter !== 'all') params.append('status', currentStatusFilter);
      if (search) params.append('search', search);
      params.append('page', String(currentPage));
      params.append('limit', '20');
      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones?${params}`);
      if (!response.ok) throw new Error('Error al obtener cotizaciones');
      const result = await response.json();
      setQuotations(result.data || []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      console.error('Error al obtener cotizaciones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when search changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchQuotations(statusFilter, 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (quotation: Quotation) => {
    if (!await practiceConfirm(`¿Eliminar la cotización "${quotation.quotationNumber}"?`)) return;
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotation.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar cotización');
      await fetchQuotations();
    } catch (err) {
      console.error('Error al eliminar cotización:', err);
      setToastMessage({ message: 'Error al eliminar la cotización', type: 'error' });
    }
  };

  const handleConvertToSale = async (quotation: Quotation) => {
    if (!await practiceConfirm(`¿Convertir la cotización "${quotation.quotationNumber}" en una venta?`)) return;
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/from-quotation/${quotation.id}`, { method: 'POST' });
      if (!response.ok) throw new Error('Error al convertir cotización a venta');
      const result = await response.json();
      setToastMessage({ message: `¡Venta creada exitosamente! Folio: ${result.data.saleNumber}`, type: 'success' });
      window.location.href = `/dashboard/practice/ventas/${result.data.id}`;
    } catch (err) {
      console.error('Error al convertir cotización:', err);
      setToastMessage({ message: 'Error al convertir la cotización a venta', type: 'error' });
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
      if (!await practiceConfirm(validation.confirmationMessage)) return;
    }

    setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: newStatus } : q));
    setUpdatingId(quotationId);

    try {
      const updateResponse = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!updateResponse.ok) throw new Error('Error al actualizar estado');
      await fetchQuotations();
      setToastMessage({ message: 'Estado actualizado exitosamente', type: 'success' });
    } catch (error: any) {
      setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: oldStatus } : q));
      const msg = error.message.includes('permisos') ? 'No tienes permisos para cambiar el estado'
        : error.message.includes('conectar') ? 'No se pudo conectar. Verifica tu conexión.'
        : 'Error al actualizar estado. Intenta de nuevo.';
      setToastMessage({ message: msg, type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredQuotations = quotations;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuotations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuotations.map(q => q.id)));
    }
  };

  const handleExportPDF = async () => {
    if (selectedIds.size === 0) return;
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const selectedQuotations = filteredQuotations.filter(q => selectedIds.has(q.id));
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Cotizaciones', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);
    if (doctorProfile) doc.text(`Doctor: ${doctorProfile.primarySpecialty}`, 14, 34);
    const tableData = selectedQuotations.map(q => {
      const config = statusConfig[q.status as keyof typeof statusConfig] || statusConfig.DRAFT;
      return [q.quotationNumber, q.client.businessName, formatDate(q.issueDate), formatDate(q.validUntil), formatCurrency(q.total), config.label];
    });
    autoTable(doc, {
      startY: doctorProfile ? 40 : 34,
      head: [['Folio', 'Paciente', 'Fecha', 'Válida hasta', 'Total', 'Estado']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' } },
    });
    const yPos = (doc as any).lastAutoTable.finalY + 10;
    const totalCotizaciones = selectedQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de cotizaciones: ${selectedQuotations.length}`, 14, yPos);
    doc.text(`Total: ${formatCurrency(totalCotizaciones.toString())}`, 14, yPos + 6);
    doc.save(`cotizaciones-${new Date().toISOString().split('T')[0]}.pdf`);
  };


  const isExpiringSoon = (validUntil: string) => {
    const daysUntilExpiry = Math.ceil((new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (validUntil: string) => new Date(validUntil) < new Date();

  return {
    quotations, loading,
    search, setSearch,
    statusFilter, setStatusFilter,
    updatingId,
    toastMessage, setToastMessage,
    error,
    selectedIds,
    doctorProfile,
    fetchDoctorProfile, fetchQuotations,
    handleDelete, handleConvertToSale, handleQuotationStatusChange,
    toggleSelect, toggleSelectAll, handleExportPDF,
    deselectAll: () => setSelectedIds(new Set()),
    formatDate, formatCurrency,
    isExpiringSoon, isExpired,
    filteredQuotations,
    page, setPage, pagination,
  };
}
