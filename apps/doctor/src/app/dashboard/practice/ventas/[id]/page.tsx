"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit2, Loader2, ShoppingCart, Download, FileText } from "lucide-react";
import { formatCurrency, formatDateLong } from "@/lib/practice-utils";
import { useVentaDetail, statusConfig, paymentStatusConfig } from "../_components/useVentaDetail";

export default function ViewSalePage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const { sale, loading, error, exportingPDF, handleExportPDF } = useVentaDetail();

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Venta no encontrada</h2>
          <Link href="/dashboard/practice/ventas" className="text-blue-600 hover:text-blue-700">
            Volver a Ventas
          </Link>
        </div>
      </div>
    );
  }

  const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
  const balanceDue = parseFloat(sale.total) - parseFloat(sale.amountPaid);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Link
          href="/dashboard/practice/ventas"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Ventas
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              Venta {sale.saleNumber}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusConf.color}`}>
                {statusConf.icon} {statusConf.label}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${paymentConf.color}`}>
                {paymentConf.icon} {paymentConf.label}
              </span>
            </div>
            {sale.quotation && (
              <Link
                href={`/dashboard/practice/cotizaciones/${sale.quotation.id}`}
                className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <FileText className="w-4 h-4" />
                Generada desde cotización {sale.quotation.quotationNumber}
              </Link>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/dashboard/practice/ventas/${sale.id}/edit`}
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

      {/* Sale Document */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-blue-600 text-white p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold">VENTA EN FIRME</h2>
            <p className="text-blue-100 mt-2">Folio: {sale.saleNumber}</p>
          </div>
        </div>

        <div className="p-8">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-600">Fecha de venta</p>
              <p className="text-lg font-semibold text-gray-900">{formatDateLong(sale.saleDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha de entrega</p>
              <p className="text-lg font-semibold text-gray-900">
                {sale.deliveryDate ? formatDateLong(sale.deliveryDate) : 'No especificada'}
              </p>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CLIENTE</h3>
            <div className="space-y-2">
              <p className="text-xl font-bold text-gray-900">{sale.client.businessName}</p>
              {sale.client.contactName && <p className="text-gray-700">Contacto: {sale.client.contactName}</p>}
              {sale.client.email && <p className="text-gray-700">Email: {sale.client.email}</p>}
              {sale.client.phone && <p className="text-gray-700">Teléfono: {sale.client.phone}</p>}
              {sale.client.rfc && <p className="text-gray-700">RFC: {sale.client.rfc}</p>}
              {sale.client.street && (
                <p className="text-gray-700">
                  {sale.client.street}, {sale.client.city}, {sale.client.state} {sale.client.postalCode}
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
                  {sale.items.map((item, index) => (
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
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">IVA Total:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.tax || 0)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300">
                  <span className="text-lg font-bold text-gray-900">TOTAL:</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(sale.total)}</span>
                </div>

                {parseFloat(sale.amountPaid) > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-t border-gray-200">
                      <span className="text-gray-700">Monto Pagado:</span>
                      <span className="font-semibold text-green-600">{formatCurrency(sale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-700">Saldo Pendiente:</span>
                      <span className={`font-semibold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(balanceDue)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          {(sale.notes || sale.termsAndConditions) && (
            <div className="space-y-4 border-t pt-6">
              {sale.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Notas:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{sale.notes}</p>
                </div>
              )}
              {sale.termsAndConditions && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Términos y Condiciones:</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{sale.termsAndConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
