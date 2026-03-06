'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency, formatDateLong } from '@/lib/practice-utils';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Client {
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

export interface SaleQuotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
}

export interface SaleItem {
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

export interface Sale {
  id: number;
  saleNumber: string;
  saleDate: string;
  deliveryDate: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string;
  taxRate: string | null;
  tax: string | null;
  total: string;
  amountPaid: string;
  notes: string | null;
  termsAndConditions: string | null;
  client: Client;
  quotation: SaleQuotation | null;
  items: SaleItem[];
}

export const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: '⚙️' },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: '📦' },
  DELIVERED: { label: 'Entregada', color: 'bg-green-100 text-green-800', icon: '✅' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Pago Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: '✅' },
};

export function useVentaDetail() {
  const params = useParams();
  const saleId = params.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (saleId) fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const fetchSale = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`);
      if (!response.ok) throw new Error('Error al cargar la venta');
      const result = await response.json();
      setSale(result.data);
    } catch (err: any) {
      console.error('Error al cargar venta:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!sale) return;
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
      doc.text('VENTA EN FIRME', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Folio: ${sale.saleNumber}`, pageWidth / 2, 28, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      let y = 45;

      const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
      const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Estado: ${statusConf.label}`, 14, y);
      doc.text(`Pago: ${paymentConf.label}`, 100, y);
      y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Fecha de venta', 14, y);
      doc.text('Fecha de entrega', 100, y);
      y += 5;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDateLong(sale.saleDate), 14, y);
      doc.text(sale.deliveryDate ? formatDateLong(sale.deliveryDate) : 'No especificada', 100, y);
      y += 10;

      doc.setFillColor(249, 250, 251);
      doc.roundedRect(14, y, pageWidth - 28, 40, 2, 2, 'F');
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE', 18, y);
      y += 6;
      doc.setFontSize(12);
      doc.text(sale.client.businessName, 18, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      if (sale.client.contactName) { doc.text(`Contacto: ${sale.client.contactName}`, 18, y); y += 4; }
      if (sale.client.email) { doc.text(`Email: ${sale.client.email}`, 18, y); y += 4; }
      if (sale.client.phone) { doc.text(`Tel: ${sale.client.phone}`, 18, y); y += 4; }
      if (sale.client.rfc) { doc.text(`RFC: ${sale.client.rfc}`, 18, y); y += 4; }
      if (sale.client.street) {
        doc.text(`${sale.client.street}, ${sale.client.city}, ${sale.client.state} ${sale.client.postalCode}`, 18, y);
        y += 4;
      }
      doc.setTextColor(0, 0, 0);
      y = Math.max(y + 6, y + 2);

      const tableData = sale.items.map((item, index) => [
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
      doc.text(formatCurrency(sale.subtotal), valuesX, y, { align: 'right' });
      y += 6;
      doc.text('IVA Total:', totalsX, y);
      doc.text(formatCurrency(sale.tax || 0), valuesX, y, { align: 'right' });
      y += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(totalsX - 5, y - 3, valuesX, y - 3);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', totalsX, y);
      doc.setTextColor(22, 163, 74);
      doc.text(formatCurrency(sale.total), valuesX, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 10;

      const amountPaid = parseFloat(sale.amountPaid);
      if (amountPaid > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Monto Pagado:', totalsX, y);
        doc.setTextColor(22, 163, 74);
        doc.text(formatCurrency(sale.amountPaid), valuesX, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 6;
        const balance = parseFloat(sale.total) - amountPaid;
        doc.text('Saldo Pendiente:', totalsX, y);
        if (balance > 0) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(22, 163, 74);
        doc.text(formatCurrency(balance), valuesX, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 10;
      }

      if (sale.notes || sale.termsAndConditions) {
        if (y > 250) { doc.addPage(); y = 20; }
        if (sale.notes) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Notas:', 14, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const noteLines = doc.splitTextToSize(sale.notes, pageWidth - 28);
          doc.text(noteLines, 14, y);
          y += noteLines.length * 4 + 6;
        }
        if (sale.termsAndConditions) {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Términos y Condiciones:', 14, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const termLines = doc.splitTextToSize(sale.termsAndConditions, pageWidth - 28);
          doc.text(termLines, 14, y);
        }
      }

      doc.save(`venta-${sale.saleNumber}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  return { sale, loading, error, exportingPDF, handleExportPDF };
}
