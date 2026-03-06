"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit2, Loader2, FileText, Download, ShoppingCart } from "lucide-react";
import { formatCurrency, formatDateLong } from "@/lib/practice-utils";
import { useQuotationDetail, statusConfig } from "../_components/useQuotationDetail";

export default function ViewQuotationPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const { quotation, loading, error, converting, exportingPDF, handleConvertToSale, handleExportPDF } = useQuotationDetail();

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
          <Link href="/dashboard/practice/cotizaciones" className="text-blue-600 hover:text-blue-700">
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
              <p className="text-lg font-semibold text-gray-900">{formatDateLong(quotation.issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Válida hasta</p>
              <p className="text-lg font-semibold text-gray-900">{formatDateLong(quotation.validUntil)}</p>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CLIENTE</h3>
            <div className="space-y-2">
              <p className="text-xl font-bold text-gray-900">{quotation.client.businessName}</p>
              {quotation.client.contactName && <p className="text-gray-700">Contacto: {quotation.client.contactName}</p>}
              {quotation.client.email && <p className="text-gray-700">Email: {quotation.client.email}</p>}
              {quotation.client.phone && <p className="text-gray-700">Teléfono: {quotation.client.phone}</p>}
              {quotation.client.rfc && <p className="text-gray-700">RFC: {quotation.client.rfc}</p>}
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
                        {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
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
