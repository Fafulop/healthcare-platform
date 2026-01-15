"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Plus, Download, FileText, File, X } from "lucide-react";
import Link from "next/link";
import { uploadFiles } from "@/lib/uploadthing";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface LedgerEntry {
  id: number;
  amount: string;
  concept: string;
  bankAccount: string | null;
  formaDePago: string;
  internalId: string;
  bankMovementId: string | null;
  entryType: string;
  transactionDate: string;
  area: string;
  subarea: string;
  porRealizar: boolean;
  attachments: Attachment[];
  facturas: Factura[];
  facturasXml: FacturaXml[];
  transactionType?: string;
  clientId?: number;
  supplierId?: number;
  paymentStatus?: string;
  amountPaid?: string;
  client?: {
    id: number;
    businessName: string;
    contactName: string | null;
  };
  supplier?: {
    id: number;
    businessName: string;
    contactName: string | null;
  };
  sale?: {
    id: number;
    saleNumber: string;
    total: string;
  };
  purchase?: {
    id: number;
    purchaseNumber: string;
    total: string;
  };
}

interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

interface Factura {
  id: number;
  fileName: string;
  fileUrl: string;
  folio: string | null;
  uuid: string | null;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: string | null;
  createdAt: string;
}

interface FacturaXml {
  id: number;
  fileName: string;
  fileUrl: string;
  folio: string | null;
  uuid: string;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: string | null;
  subtotal: string | null;
  iva: string | null;
  fecha: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  moneda: string | null;
  createdAt: string;
}

export default function FlujoDeDineroDetailPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const params = useParams();
  const entryId = params.id as string;

  const [entry, setEntry] = useState<LedgerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'attachment' | 'factura' | 'xml' | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchEntry();
    }
  }, []);

  const fetchEntry = async () => {
    if (!session?.user?.email) return;

    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`);

      if (!response.ok) throw new Error('Error al cargar movimiento');
      const result = await response.json();
      setEntry(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm(`¿Estás seguro de eliminar el movimiento ${entry.internalId}?`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar movimiento');
      router.push('/dashboard/practice/flujo-de-dinero');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;

    setUploading(true);
    try {
      // Determine which UploadThing endpoint to use
      let uploadEndpoint: "ledgerAttachments" | "ledgerFacturasPdf" | "ledgerFacturasXml";
      if (uploadType === 'attachment') uploadEndpoint = 'ledgerAttachments';
      else if (uploadType === 'factura') uploadEndpoint = 'ledgerFacturasPdf';
      else uploadEndpoint = 'ledgerFacturasXml';

      // Upload file to UploadThing
      const uploadResult = await uploadFiles(uploadEndpoint, {
        files: [file]
      });

      if (!uploadResult || uploadResult.length === 0) {
        throw new Error('Error al subir archivo a UploadThing');
      }

      const uploadedFile = uploadResult[0];

      // Prepare metadata to send to our API
      const metadata: any = {
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: file.type
      };

      // For XML files, read the content
      if (uploadType === 'xml') {
        const xmlContent = await file.text();
        metadata.xmlContent = xmlContent;
      }

      // Determine API endpoint
      let apiEndpoint = '';
      if (uploadType === 'attachment') apiEndpoint = `/api/practice-management/ledger/${entryId}/attachments`;
      if (uploadType === 'factura') apiEndpoint = `/api/practice-management/ledger/${entryId}/facturas`;
      if (uploadType === 'xml') apiEndpoint = `/api/practice-management/ledger/${entryId}/facturas-xml`;

      // Send metadata to our API
      const response = await authFetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar archivo');
      }

      // Refresh entry data
      await fetchEntry();
      setUploadType(null);
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
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
          <Link
            href="/dashboard/practice/flujo-de-dinero"
            className="text-green-600 hover:text-green-700"
          >
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
          <div className="flex items-center justify-between">
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
            {/* Type and Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipo</label>
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-semibold ${
                entry.entryType === 'ingreso'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {entry.entryType === 'ingreso' ? (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Ingreso
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5" />
                    Egreso
                  </>
                )}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Monto</label>
              <p className={`text-2xl font-bold ${entry.entryType === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                {entry.entryType === 'ingreso' ? '+' : '-'} {formatCurrency(entry.amount)}
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de Transacción</label>
              <p className="text-gray-900">{formatDate(entry.transactionDate)}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Estado</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                entry.porRealizar
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {entry.porRealizar ? 'Por Realizar' : 'Realizado'}
              </span>
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Área</label>
              <p className="text-gray-900">{entry.area}</p>
            </div>

            {/* Subarea */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Subárea</label>
              <p className="text-gray-900">{entry.subarea}</p>
            </div>

            {/* Bank Account */}
            {entry.bankAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Cuenta Bancaria</label>
                <p className="text-gray-900">{entry.bankAccount}</p>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Forma de Pago</label>
              <p className="text-gray-900 capitalize">{entry.formaDePago}</p>
            </div>

            {/* Bank Movement ID */}
            {entry.bankMovementId && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">ID de Movimiento Bancario</label>
                <p className="text-gray-900 font-mono">{entry.bankMovementId}</p>
              </div>
            )}
          </div>

          {/* Concept */}
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
              {/* Transaction Type */}
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

              {/* Client or Supplier */}
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
                    <Link
                      href={`/dashboard/practice/clients/${entry.client.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline mt-2 inline-block"
                    >
                      Ver perfil del cliente →
                    </Link>
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

              {/* Payment Status */}
              {entry.paymentStatus && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Estado de Pago</label>
                  {entry.paymentStatus === 'PAID' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800">
                      Pagado
                    </span>
                  )}
                  {entry.paymentStatus === 'PARTIAL' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-800">
                      Pago Parcial
                    </span>
                  )}
                  {entry.paymentStatus === 'PENDING' && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-100 text-orange-800">
                      Pendiente
                    </span>
                  )}
                </div>
              )}

              {/* Total from Sale/Purchase */}
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
            {(entry.transactionType === 'VENTA' || entry.transactionType === 'COMPRA') && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Información de Pago</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monto Pagado:</span>
                    <span className="text-lg font-semibold text-blue-600">
                      {formatCurrency(entry.amountPaid || '0')}
                    </span>
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
            )}

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Nota:</strong> Este movimiento está vinculado a un registro de {entry.transactionType === 'VENTA' ? 'venta' : 'compra'}.
                Los cambios en el estado de pago o detalles deben realizarse desde el módulo de {entry.transactionType === 'VENTA' ? 'Ventas' : 'Compras'}.
              </p>
            </div>
          </div>
        )}

        {/* File Uploads Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Archivos</h2>

          {/* Upload Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all"
              >
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    setUploadType('attachment');
                    handleFileUpload(e);
                  }}
                  disabled={uploading}
                />
                {uploading && uploadType === 'attachment' ? (
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-2" />
                ) : (
                  <Plus className="w-8 h-8 text-gray-400 mb-2" />
                )}
                <span className="text-sm font-medium text-gray-700">Subir Archivo</span>
                <span className="text-xs text-gray-500 mt-1">Comprobante, recibo, etc.</span>
              </label>
            </div>

            <div>
              <label
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    setUploadType('factura');
                    handleFileUpload(e);
                  }}
                  disabled={uploading}
                />
                {uploading && uploadType === 'factura' ? (
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                ) : (
                  <FileText className="w-8 h-8 text-gray-400 mb-2" />
                )}
                <span className="text-sm font-medium text-gray-700">Factura PDF</span>
                <span className="text-xs text-gray-500 mt-1">Solo archivos PDF</span>
              </label>
            </div>

            <div>
              <label
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all"
              >
                <input
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    setUploadType('xml');
                    handleFileUpload(e);
                  }}
                  disabled={uploading}
                />
                {uploading && uploadType === 'xml' ? (
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                ) : (
                  <File className="w-8 h-8 text-gray-400 mb-2" />
                )}
                <span className="text-sm font-medium text-gray-700">Factura XML</span>
                <span className="text-xs text-gray-500 mt-1">CFDI - Auto-parseo</span>
              </label>
            </div>
          </div>

          {/* Attachments List */}
          {entry.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Archivos Adjuntos ({entry.attachments.length})</h3>
              <div className="space-y-2">
                {entry.attachments.map(attachment => (
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900">{attachment.fileName}</div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(attachment.fileSize)} • {formatDate(attachment.createdAt)}
                        </div>
                      </div>
                    </div>
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Invoices */}
          {entry.facturas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Facturas PDF ({entry.facturas.length})</h3>
              <div className="space-y-2">
                {entry.facturas.map(factura => (
                  <div key={factura.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900">{factura.fileName}</div>
                        <div className="text-xs text-gray-600">
                          {factura.folio && `Folio: ${factura.folio}`}
                          {factura.total && ` • Total: ${formatCurrency(factura.total)}`}
                        </div>
                      </div>
                    </div>
                    <a
                      href={factura.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* XML Invoices with parsed data */}
          {entry.facturasXml.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Facturas XML ({entry.facturasXml.length})</h3>
              <div className="space-y-4">
                {entry.facturasXml.map(xml => (
                  <div key={xml.id} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="font-medium text-gray-900">{xml.fileName}</div>
                          <div className="text-xs text-gray-600">UUID: {xml.uuid}</div>
                        </div>
                      </div>
                      <a
                        href={xml.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </a>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {xml.folio && (
                        <div>
                          <span className="text-gray-600">Folio:</span>
                          <span className="ml-2 font-medium">{xml.folio}</span>
                        </div>
                      )}
                      {xml.total && (
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="ml-2 font-medium">{formatCurrency(xml.total)}</span>
                        </div>
                      )}
                      {xml.rfcEmisor && (
                        <div>
                          <span className="text-gray-600">RFC Emisor:</span>
                          <span className="ml-2 font-medium">{xml.rfcEmisor}</span>
                        </div>
                      )}
                      {xml.rfcReceptor && (
                        <div>
                          <span className="text-gray-600">RFC Receptor:</span>
                          <span className="ml-2 font-medium">{xml.rfcReceptor}</span>
                        </div>
                      )}
                      {xml.metodoPago && (
                        <div>
                          <span className="text-gray-600">Método de Pago:</span>
                          <span className="ml-2 font-medium">{xml.metodoPago}</span>
                        </div>
                      )}
                      {xml.moneda && (
                        <div>
                          <span className="text-gray-600">Moneda:</span>
                          <span className="ml-2 font-medium">{xml.moneda}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {entry.attachments.length === 0 && entry.facturas.length === 0 && entry.facturasXml.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No hay archivos adjuntos</p>
              <p className="text-sm mt-1">Sube comprobantes, facturas o archivos XML</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
