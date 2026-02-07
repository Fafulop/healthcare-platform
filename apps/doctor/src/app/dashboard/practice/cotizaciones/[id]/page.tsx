"use client";

import { useSession } from "next-auth/react";
import { redirect, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Trash2, Loader2, FileText, Download, ShoppingCart } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
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

interface QuotationItem {
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

interface Quotation {
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
  client: Client;
  items: QuotationItem[];
}

const statusConfig = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: '📝' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: '📤' },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: '❌' },
  EXPIRED: { label: 'Vencida', color: 'bg-orange-100 text-orange-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
};

export default function ViewQuotationPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const params = useParams();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (quotationId) {
      fetchQuotation();
    }
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

  const handleExportPDF = async () => {
    if (!quotation) return;
    setExportingPDF(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Blue header bar
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('COTIZACIÓN', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Folio: ${quotation.quotationNumber}`, pageWidth / 2, 28, { align: 'center' });

      // Reset text color
      doc.setTextColor(0, 0, 0);
      let y = 45;

      // Status badge
      const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Estado: ${config.label}`, 14, y);
      y += 10;

      // Dates
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Fecha de emisión', 14, y);
      doc.text('Válida hasta', 100, y);
      y += 5;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfFormatDate(quotation.issueDate), 14, y);
      doc.text(pdfFormatDate(quotation.validUntil), 100, y);
      y += 10;

      // Client box
      doc.setFillColor(249, 250, 251); // gray-50
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

      // Items table
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

      // Totals section (right-aligned)
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

      // Total line
      doc.setDrawColor(200, 200, 200);
      doc.line(totalsX - 5, y - 3, valuesX, y - 3);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', totalsX, y);
      doc.setTextColor(22, 163, 74); // green-600
      doc.text(formatCurrency(quotation.total), valuesX, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 12;

      // Notes and Terms
      if (quotation.notes || quotation.termsAndConditions) {
        if (y > 250) { doc.addPage(); y = 20; }

        if (quotation.notes) {
          // Blue-tinted background for notes (matching bg-blue-50)
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
          // Gray background for terms (matching bg-gray-50)
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
      alert('Error al generar el PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const pdfFormatDate = (dateString: string) => {
    try {
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateString;
    } catch { return dateString; }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const handleConvertToSale = async () => {
    if (!quotation) return;

    if (!confirm(`¿Convertir la cotización ${quotation.quotationNumber} en una venta?`)) return;

    setConverting(true);

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/from-quotation/${quotation.id}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Error al convertir cotización');

      const result = await response.json();
      router.push(`/dashboard/practice/ventas/${result.data.id}`);
    } catch (err) {
      console.error('Error al convertir cotización:', err);
      alert('Error al convertir cotización a venta');
    } finally {
      setConverting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cotización no encontrada</h2>
          <Link
            href="/dashboard/practice/cotizaciones"
            className="text-blue-600 hover:text-blue-700"
          >
            Volver a Cotizaciones
          </Link>
        </div>
      </div>
    );
  }

  const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard/practice/cotizaciones"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Cotizaciones
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                Cotización {quotation.quotationNumber}
              </h1>
              <div className="mt-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.color}`}>
                  {config.icon} {config.label}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConvertToSale}
                disabled={converting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Convirtiendo...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Convertir a Venta
                  </>
                )}
              </button>
              <Link
                href={`/dashboard/practice/cotizaciones/${quotation.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Link>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Descargar PDF"
              >
                {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Quotation Document */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Document Header */}
          <div className="bg-blue-600 text-white p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold">COTIZACIÓN</h2>
              <p className="text-blue-100 mt-2">Folio: {quotation.quotationNumber}</p>
            </div>
          </div>

          <div className="p-8">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm text-gray-600">Fecha de emisión</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(quotation.issueDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Válida hasta</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(quotation.validUntil)}</p>
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">CLIENTE</h3>
              <div className="space-y-2">
                <p className="text-xl font-bold text-gray-900">{quotation.client.businessName}</p>
                {quotation.client.contactName && (
                  <p className="text-gray-700">Contacto: {quotation.client.contactName}</p>
                )}
                {quotation.client.email && (
                  <p className="text-gray-700">Email: {quotation.client.email}</p>
                )}
                {quotation.client.phone && (
                  <p className="text-gray-700">Teléfono: {quotation.client.phone}</p>
                )}
                {quotation.client.rfc && (
                  <p className="text-gray-700">RFC: {quotation.client.rfc}</p>
                )}
                {quotation.client.street && (
                  <p className="text-gray-700">
                    {quotation.client.street}, {quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}
                  </p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">PRODUCTOS Y SERVICIOS</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Descripción</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Cant.</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Unidad</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">P. Unit.</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Desc. %</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">IVA %</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item, index) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-3 text-gray-900">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          {item.sku && (
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">{parseFloat(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.unit || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.discountRate ? `${(parseFloat(item.discountRate) * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.taxRate ? `${(parseFloat(item.taxRate) * 100).toFixed(0)}%` : '16%'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-full md:w-1/2">
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">IVA Total:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(quotation.tax || 0)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-300">
                    <span className="text-lg font-bold text-gray-900">TOTAL:</span>
                    <span className="text-lg font-bold text-green-600">{formatCurrency(quotation.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            {(quotation.notes || quotation.termsAndConditions) && (
              <div className="space-y-6">
                {quotation.notes && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">NOTAS</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                )}

                {quotation.termsAndConditions && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">TÉRMINOS Y CONDICIONES</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{quotation.termsAndConditions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
