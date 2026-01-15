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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Cotización no encontrada</h2>
          <Link
            href="/dashboard/practice/cotizaciones"
            className="text-green-600 hover:text-green-700"
          >
            Volver a Cotizaciones
          </Link>
        </div>
      </div>
    );
  }

  const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard/practice/cotizaciones"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Cotizaciones
          </Link>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-600" />
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
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Descargar PDF (próximamente)"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Quotation Document */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Document Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold">COTIZACIÓN</h2>
              <p className="text-green-100 mt-2">Folio: {quotation.quotationNumber}</p>
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
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(quotation.total)}</span>
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
    </div>
  );
}
