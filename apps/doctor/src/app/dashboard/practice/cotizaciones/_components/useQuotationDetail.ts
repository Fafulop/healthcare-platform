'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency, formatDateLong } from '@/lib/practice-utils';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface QuotationClient {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface QuotationDetailItem {
  id: number;
  description: string;
  sku: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  status: string;
  subtotal: string;
  taxRate: string | null;
  tax: string | null;
  total: string;
  notes: string | null;
  termsAndConditions: string | null;
  client: QuotationClient;
  items: QuotationDetailItem[];
}

export const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: '📤' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '❌' },
  EXPIRED: { label: 'Vencida', color: 'bg-orange-100 text-orange-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export function useQuotationDetail() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (quotationId) fetchQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const fetchQuotation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`);
      if (!response.ok) throw new Error('Error al cargar la cotización');
      const result = await response.json();
      setQuotation(result.data);
    } catch (err: any) {
      console.error('Error al cargar cotización:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToSale = async () => {
    if (!quotation) return;
    if (!await practiceConfirm(`¿Convertir la cotización ${quotation.quotationNumber} en una venta?`)) return;
    setConverting(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/from-quotation/${quotation.id}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Error al convertir cotización');
      const result = await response.json();
      router.push(`/dashboard/practice/ventas/${result.data.id}`);
    } catch (err) {
      console.error('Error al convertir cotización:', err);
      toast.error('Error al convertir cotización a venta');
    } finally {
      setConverting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!quotation) return;
    setExportingPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('COTIZACIÓN', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Folio: ${quotation.quotationNumber}`, pageWidth / 2, 28, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      let y = 45;

      const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Estado: ${config.label}`, 14, y);
      y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Fecha de emisión', 14, y);
      doc.text('Válida hasta', 100, y);
      y += 5;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDateLong(quotation.issueDate), 14, y);
      doc.text(formatDateLong(quotation.validUntil), 100, y);
      y += 10;

      doc.setFillColor(249, 250, 251);
      doc.roundedRect(14, y, pageWidth - 28, 40, 2, 2, 'F');
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE', 18, y);
      y += 6;
      doc.setFontSize(12);
      doc.text(quotation.client.businessName, 18, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      if (quotation.client.contactName) { doc.text(`Contacto: ${quotation.client.contactName}`, 18, y); y += 4; }
      if (quotation.client.email) { doc.text(`Email: ${quotation.client.email}`, 18, y); y += 4; }
      if (quotation.client.phone) { doc.text(`Tel: ${quotation.client.phone}`, 18, y); y += 4; }
      if (quotation.client.rfc) { doc.text(`RFC: ${quotation.client.rfc}`, 18, y); y += 4; }
      if (quotation.client.street) {
        doc.text(`${quotation.client.street}, ${quotation.client.city}, ${quotation.client.state} ${quotation.client.postalCode}`, 18, y);
        y += 4;
      }
      doc.setTextColor(0, 0, 0);
      y = Math.max(y + 6, y + 2);

      const tableData = quotation.items.map((item, index) => [
        (index + 1).toString(),
        item.description + (item.sku ? `\nSKU: ${item.sku}` : ''),
        parseFloat(item.quantity).toFixed(2),
        item.unit || '-',
        formatCurrency(item.unitPrice),
        item.discountRate ? `${(parseFloat(item.discountRate) * 100).toFixed(0)}%` : '-',
        item.taxRate ? `${(parseFloat(item.taxRate) * 100).toFixed(0)}%` : '16%',
        formatCurrency(item.subtotal),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Descripción', 'Cant.', 'Unidad', 'P. Unit.', 'Desc.%', 'IVA%', 'Total']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 18 },
          4: { halign: 'right', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 15 },
          6: { halign: 'center', cellWidth: 15 },
          7: { halign: 'right', cellWidth: 25 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      const totalsX = pageWidth - 80;
      const valuesX = pageWidth - 14;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, y);
      doc.text(formatCurrency(quotation.subtotal), valuesX, y, { align: 'right' });
      y += 6;
      doc.text('IVA Total:', totalsX, y);
      doc.text(formatCurrency(quotation.tax || 0), valuesX, y, { align: 'right' });
      y += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(totalsX - 5, y - 3, valuesX, y - 3);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', totalsX, y);
      doc.setTextColor(22, 163, 74);
      doc.text(formatCurrency(quotation.total), valuesX, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 12;

      if (quotation.notes || quotation.termsAndConditions) {
        if (y > 250) { doc.addPage(); y = 20; }
        if (quotation.notes) {
          doc.setFillColor(239, 246, 255);
          const noteLines = doc.splitTextToSize(quotation.notes, pageWidth - 36);
          const noteBoxHeight = noteLines.length * 4 + 14;
          doc.roundedRect(14, y, pageWidth - 28, noteBoxHeight, 2, 2, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('NOTAS', 18, y + 7);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(noteLines, 18, y + 13);
          y += noteBoxHeight + 6;
        }
        if (quotation.termsAndConditions) {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFillColor(249, 250, 251);
          const termLines = doc.splitTextToSize(quotation.termsAndConditions, pageWidth - 36);
          const termBoxHeight = termLines.length * 4 + 14;
          doc.roundedRect(14, y, pageWidth - 28, termBoxHeight, 2, 2, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('TÉRMINOS Y CONDICIONES', 18, y + 7);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(termLines, 18, y + 13);
        }
      }

      doc.save(`cotizacion-${quotation.quotationNumber}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  return { quotation, loading, error, converting, exportingPDF, handleConvertToSale, handleExportPDF };
}
