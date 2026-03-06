'use client';

import Link from 'next/link';
import { Plus, Edit2, Trash2, FileText, Eye, ShoppingCart, Download, CheckSquare } from 'lucide-react';
import InlineStatusSelect from '@/components/practice/InlineStatusSelect';
import { statusConfig, type Quotation } from './useCotizacionesPage';

interface Props {
  quotations: Quotation[];
  allCount: number;
  search: string;
  statusFilter: string;
  selectedIds: Set<number>;
  updatingId: number | null;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onStatusChange: (id: number, oldStatus: string, newStatus: string) => void;
  onConvertToSale: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
  onExportPDF: () => void;
  onDeselect: () => void;
  formatDate: (s: string) => string;
  formatCurrency: (a: string | number) => string;
  isExpiringSoon: (validUntil: string) => boolean;
  isExpired: (validUntil: string) => boolean;
}

const statusOptions = Object.entries(statusConfig).map(([value, conf]) => ({ value, ...conf }));

export function QuotationsTable({
  quotations, allCount, search, statusFilter,
  selectedIds, updatingId,
  onToggleSelect, onToggleSelectAll, onStatusChange,
  onConvertToSale, onDelete, onExportPDF, onDeselect,
  formatDate, formatCurrency, isExpiringSoon, isExpired,
}: Props) {
  if (quotations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {search || statusFilter !== 'all' ? 'No se encontraron cotizaciones' : 'No hay cotizaciones'}
        </h3>
        <p className="text-gray-600 mb-4">
          {!search && statusFilter === 'all' && 'Crea tu primera cotización para comenzar'}
        </p>
        {!search && statusFilter === 'all' && (
          <Link href="/dashboard/practice/cotizaciones/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />Nueva Cotización
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} cotización{selectedIds.size !== 1 ? 'es' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button onClick={onExportPDF} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <Download className="w-4 h-4" />Exportar PDF
          </button>
          <button onClick={onDeselect} className="text-sm text-gray-600 hover:text-gray-800 ml-auto">Deseleccionar</button>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {quotations.map(quotation => {
          const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
          const expiringSoon = isExpiringSoon(quotation.validUntil);
          const expired = isExpired(quotation.validUntil);
          return (
            <div key={quotation.id} className={`bg-white rounded-lg shadow p-4 ${expired ? 'border-l-4 border-red-500' : expiringSoon ? 'border-l-4 border-yellow-500' : ''} ${selectedIds.has(quotation.id) ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={selectedIds.has(quotation.id)} onChange={() => onToggleSelect(quotation.id)} className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <div className="font-semibold text-gray-900">{quotation.quotationNumber}</div>
                    <div className="text-xs text-gray-500">{quotation.items.length} item(s)</div>
                  </div>
                </div>
                <div className="font-bold text-gray-900">{formatCurrency(quotation.total)}</div>
              </div>
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-900">{quotation.client.businessName}</div>
                {quotation.client.contactName && quotation.client.contactName !== quotation.client.businessName && (
                  <div className="text-xs text-gray-500">{quotation.client.contactName}</div>
                )}
              </div>
              <div className="flex gap-4 text-xs text-gray-600 mb-3">
                <div><span className="text-gray-400">Fecha:</span> {formatDate(quotation.issueDate)}</div>
                <div>
                  <span className="text-gray-400">Válida:</span> {formatDate(quotation.validUntil)}
                  {expired && <span className="text-red-600 ml-1">(Vencida)</span>}
                  {expiringSoon && !expired && <span className="text-yellow-600 ml-1">(Por vencer)</span>}
                </div>
              </div>
              <div className="mb-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.icon} {config.label}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <InlineStatusSelect currentStatus={quotation.status} statuses={statusOptions} onStatusChange={(s) => onStatusChange(quotation.id, quotation.status, s)} disabled={updatingId === quotation.id} />
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/practice/cotizaciones/${quotation.id}`} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Eye className="w-5 h-5" /></Link>
                  <Link href={`/dashboard/practice/cotizaciones/${quotation.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-5 h-5" /></Link>
                  <button onClick={() => onConvertToSale(quotation)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><ShoppingCart className="w-5 h-5" /></button>
                  <button onClick={() => onDelete(quotation)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={quotations.length > 0 && selectedIds.size === quotations.length} onChange={onToggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Válida hasta</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotations.map(quotation => {
                const config = statusConfig[quotation.status as keyof typeof statusConfig] || statusConfig.DRAFT;
                const expiringSoon = isExpiringSoon(quotation.validUntil);
                const expired = isExpired(quotation.validUntil);
                return (
                  <tr key={quotation.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(quotation.id) ? 'bg-blue-50' : expired ? 'bg-red-50' : expiringSoon ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-4">
                      <input type="checkbox" checked={selectedIds.has(quotation.id)} onChange={() => onToggleSelect(quotation.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{quotation.quotationNumber}</div>
                      <div className="text-xs text-gray-500">{quotation.items.length} item(s)</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{quotation.client.businessName}</div>
                      {quotation.client.contactName && quotation.client.contactName !== quotation.client.businessName && (
                        <div className="text-sm text-gray-500">{quotation.client.contactName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(quotation.issueDate)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(quotation.validUntil)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(quotation.total)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <InlineStatusSelect currentStatus={quotation.status} statuses={statusOptions} onStatusChange={(s) => onStatusChange(quotation.id, quotation.status, s)} disabled={updatingId === quotation.id} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/practice/cotizaciones/${quotation.id}`} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Ver"><Eye className="w-4 h-4" /></Link>
                        <Link href={`/dashboard/practice/cotizaciones/${quotation.id}/edit`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></Link>
                        <button onClick={() => onConvertToSale(quotation)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Convertir a venta"><ShoppingCart className="w-4 h-4" /></button>
                        <button onClick={() => onDelete(quotation)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        Mostrando {quotations.length} de {allCount} cotización(es)
      </div>
    </>
  );
}
