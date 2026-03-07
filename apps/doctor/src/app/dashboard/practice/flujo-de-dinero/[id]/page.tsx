"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ArrowLeft, Edit2, Trash2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useLedgerDetail } from "../_components/useLedgerDetail";
import { LedgerAttachmentsSection } from "../_components/LedgerAttachmentsSection";
import { formatCurrency, formatDate } from "../_components/ledger-utils";

export default function FlujoDeDineroDetailPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const {
    entry,
    loading,
    error,
    uploading,
    uploadType,
    handleDelete,
    handleFileUpload,
  } = useLedgerDetail();

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando movimiento...</p>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-4">{error || 'Movimiento no encontrado'}</p>
          <Link href="/dashboard/practice/flujo-de-dinero" className="text-green-600 hover:text-green-700">
            Volver a Flujo de Dinero
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard/practice/flujo-de-dinero"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Flujo de Dinero
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detalle del Movimiento</h1>
              <p className="text-gray-600 mt-1">
                ID Interno: <span className="font-mono font-semibold">{entry.internalId}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/dashboard/practice/flujo-de-dinero/${entry.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Link>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* Entry Details */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Información General</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipo</label>
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-semibold ${
                entry.entryType === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {entry.entryType === 'ingreso' ? (
                  <><TrendingUp className="w-5 h-5" /> Ingreso</>
                ) : (
                  <><TrendingDown className="w-5 h-5" /> Egreso</>
                )}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Monto</label>
              <p className={`text-2xl font-bold ${entry.entryType === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de Transacción</label>
              <p className="text-gray-900">{formatDate(entry.transactionDate)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Estado</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                entry.porRealizar ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {entry.porRealizar ? 'Por Realizar' : 'Realizado'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Área</label>
              <p className="text-gray-900">{entry.area}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Subárea</label>
              <p className="text-gray-900">{entry.subarea}</p>
            </div>

            {entry.bankAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Cuenta Bancaria</label>
                <p className="text-gray-900">{entry.bankAccount}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Forma de Pago</label>
              <p className="text-gray-900 capitalize">{entry.formaDePago}</p>
            </div>

            {entry.bankMovementId && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">ID de Movimiento Bancario</label>
                <p className="text-gray-900 font-mono">{entry.bankMovementId}</p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-600 mb-1">Concepto</label>
            <p className="text-gray-900 bg-gray-50 rounded-lg p-4">{entry.concept}</p>
          </div>
        </div>

        {/* Transaction Information */}
        {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Información de Transacción</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Tipo de Transacción</label>
                {entry.transactionType === 'VENTA' && (
                  <div>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800">
                      Venta
                    </span>
                    {entry.sale && (
                      <div className="mt-2">
                        <Link
                          href={`/dashboard/practice/ventas/${entry.sale.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
                        >
                          Ver venta {entry.sale.saleNumber} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {entry.transactionType === 'COMPRA' && (
                  <div>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-800">
                      Compra
                    </span>
                    {entry.purchase && (
                      <div className="mt-2">
                        <Link
                          href={`/dashboard/practice/compras/${entry.purchase.id}`}
                          className="text-purple-600 hover:text-purple-700 text-sm font-medium hover:underline"
                        >
                          Ver compra {entry.purchase.purchaseNumber} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  {entry.transactionType === 'VENTA' ? 'Cliente' : 'Proveedor'}
                </label>
                {entry.client && (
                  <div>
                    <p className="text-gray-900 font-medium">{entry.client.businessName}</p>
                    {entry.client.contactName && (
                      <p className="text-sm text-gray-600 mt-1">{entry.client.contactName}</p>
                    )}
                  </div>
                )}
                {entry.supplier && (
                  <div>
                    <p className="text-gray-900 font-medium">{entry.supplier.businessName}</p>
                    {entry.supplier.contactName && (
                      <p className="text-sm text-gray-600 mt-1">{entry.supplier.contactName}</p>
                    )}
                    <Link
                      href={`/dashboard/practice/suppliers/${entry.supplier.id}`}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium hover:underline mt-2 inline-block"
                    >
                      Ver perfil del proveedor →
                    </Link>
                  </div>
                )}
              </div>

              {entry.paymentStatus && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Estado de Pago</label>
                  {entry.paymentStatus === 'PAID' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800">Pagado</span>
                  )}
                  {entry.paymentStatus === 'PARTIAL' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-800">Pago Parcial</span>
                  )}
                  {entry.paymentStatus === 'PENDING' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-100 text-orange-800">Pendiente</span>
                  )}
                </div>
              )}

              {(entry.sale || entry.purchase) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Total de {entry.transactionType === 'VENTA' ? 'Venta' : 'Compra'}
                  </label>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(entry.sale?.total || entry.purchase?.total || '0')}
                  </p>
                </div>
              )}
            </div>

            {/* Payment Breakdown */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Información de Pago</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(entry.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Monto Pagado:</span>
                  <span className="text-lg font-semibold text-blue-600">{formatCurrency(entry.amountPaid || '0')}</span>
                </div>
                <div className="pt-2 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Saldo Pendiente:</span>
                    <span className={`text-xl font-bold ${
                      (parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')) === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {formatCurrency((parseFloat(entry.amount) - parseFloat(entry.amountPaid || '0')).toString())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Nota:</strong> Este movimiento está vinculado a un registro de {entry.transactionType === 'VENTA' ? 'venta' : 'compra'}.
                Los cambios en el estado de pago o detalles deben realizarse desde el módulo de {entry.transactionType === 'VENTA' ? 'Ventas' : 'Compras'}.
              </p>
            </div>
          </div>
        )}

        {/* File Uploads */}
        <LedgerAttachmentsSection
          attachments={entry.attachments}
          facturas={entry.facturas}
          facturasXml={entry.facturasXml}
          uploading={uploading}
          uploadType={uploadType}
          onUpload={handleFileUpload}
        />
      </div>
    </div>
  );
}
