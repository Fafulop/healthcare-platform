'use client';

import { Plus, Download, FileText, File, Loader2 } from 'lucide-react';
import type { Attachment, Factura, FacturaXml } from './useLedgerDetail';
import { formatFileSize } from './useLedgerDetail';
import { formatDate } from './ledger-utils';
import { formatCurrency } from './ledger-utils';

interface Props {
  attachments: Attachment[];
  facturas: Factura[];
  facturasXml: FacturaXml[];
  uploading: boolean;
  uploadType: 'attachment' | 'factura' | 'xml' | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'attachment' | 'factura' | 'xml') => void;
}

export function LedgerAttachmentsSection({
  attachments,
  facturas,
  facturasXml,
  uploading,
  uploadType,
  onUpload,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Archivos</h2>

      {/* Upload Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all">
          <input
            type="file"
            className="hidden"
            onChange={(e) => onUpload(e, 'attachment')}
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

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => onUpload(e, 'factura')}
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

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition-all">
          <input
            type="file"
            accept=".xml"
            className="hidden"
            onChange={(e) => onUpload(e, 'xml')}
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

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Archivos Adjuntos ({attachments.length})</h3>
          <div className="space-y-2">
            {attachments.map(attachment => (
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
      {facturas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Facturas PDF ({facturas.length})</h3>
          <div className="space-y-2">
            {facturas.map(factura => (
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

      {/* XML Invoices */}
      {facturasXml.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Facturas XML ({facturasXml.length})</h3>
          <div className="space-y-4">
            {facturasXml.map(xml => (
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
      {attachments.length === 0 && facturas.length === 0 && facturasXml.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No hay archivos adjuntos</p>
          <p className="text-sm mt-1">Sube comprobantes, facturas o archivos XML</p>
        </div>
      )}
    </div>
  );
}
