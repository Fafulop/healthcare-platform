'use client';

import Link from 'next/link';
import { Plus, Edit2, Trash2, ShoppingCart, Eye, Download, CheckSquare } from 'lucide-react';
import InlineStatusSelect from '@/components/practice/InlineStatusSelect';
import { statusConfig, paymentStatusConfig, type Sale } from './useVentasPage';

interface Props {
  sales: Sale[];
  selectedIds: Set<number>;
  updatingId: number | null;
  editingAmountPaidId: number | null;
  editingAmountPaidValue: string;
  updatingAmountPaid: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onSaleStatusChange: (id: number, oldStatus: string, newStatus: string) => void;
  onStartEditAmountPaid: (sale: Sale) => void;
  onSaveAmountPaid: (saleId: number, total: string) => void;
  onEditAmountPaidValueChange: (value: string) => void;
  onCancelEditAmountPaid: () => void;
  onDelete: (id: number) => void;
  onExportPDF: () => void;
  onDeselect: () => void;
  formatDate: (s: string) => string;
  formatCurrency: (a: string | number) => string;
}

const statusOptions = Object.entries(statusConfig).map(([value, conf]) => ({ value, ...conf }));

export function SalesTable({
  sales, selectedIds, updatingId,
  editingAmountPaidId, editingAmountPaidValue, updatingAmountPaid,
  onToggleSelect, onToggleSelectAll, onSaleStatusChange,
  onStartEditAmountPaid, onSaveAmountPaid, onEditAmountPaidValueChange, onCancelEditAmountPaid,
  onDelete, onExportPDF, onDeselect,
  formatDate, formatCurrency,
}: Props) {
  if (sales.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay ventas registradas</h3>
        <p className="text-gray-600 mb-4">Comienza creando tu primera venta</p>
        <Link href="/dashboard/practice/ventas/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />Nueva Venta
        </Link>
      </div>
    );
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} venta{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button onClick={onExportPDF} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <Download className="w-4 h-4" />Exportar PDF
          </button>
          <button onClick={onDeselect} className="text-sm text-gray-600 hover:text-gray-800 ml-auto">Deseleccionar</button>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {sales.map((sale) => {
          const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
          const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
          return (
            <div key={sale.id} className={`bg-white rounded-lg shadow p-4 ${selectedIds.has(sale.id) ? 'ring-2 ring-blue-400' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={selectedIds.has(sale.id)} onChange={() => onToggleSelect(sale.id)} className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <div className="font-semibold text-gray-900">{sale.saleNumber}</div>
                    {sale.quotation && <div className="text-xs text-gray-500">De: {sale.quotation.quotationNumber}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(sale.total)}</div>
                  {parseFloat(sale.amountPaid) > 0 && <div className="text-xs text-blue-600">Pagado: {formatCurrency(sale.amountPaid)}</div>}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-900">{sale.client.businessName}</div>
                {sale.client.contactName && sale.client.contactName !== sale.client.businessName && (
                  <div className="text-xs text-gray-500">{sale.client.contactName}</div>
                )}
              </div>
              <div className="flex gap-4 text-xs text-gray-600 mb-3">
                <div><span className="text-gray-400">Fecha:</span> {formatDate(sale.saleDate)}</div>
                {sale.deliveryDate && <div><span className="text-gray-400">Entrega:</span> {formatDate(sale.deliveryDate)}</div>}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${paymentConf.color}`}>{paymentConf.icon} {paymentConf.label}</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>{statusConf.icon} {statusConf.label}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <InlineStatusSelect currentStatus={sale.status} statuses={statusOptions} onStatusChange={(s) => onSaleStatusChange(sale.id, sale.status, s)} disabled={updatingId === sale.id} />
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/practice/ventas/${sale.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-5 h-5" /></Link>
                  <Link href={`/dashboard/practice/ventas/${sale.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-5 h-5" /></Link>
                  <button onClick={() => onDelete(sale.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
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
                  <input type="checkbox" checked={sales.length > 0 && selectedIds.size === sales.length} onChange={onToggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">Cobrado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">Por Cobrar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => {
                const statusConf = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.PENDING;
                const paymentConf = paymentStatusConfig[sale.paymentStatus as keyof typeof paymentStatusConfig] || paymentStatusConfig.PENDING;
                const balance = parseFloat(sale.total) - parseFloat(sale.amountPaid || '0');
                return (
                  <tr key={sale.id} className={`hover:bg-gray-50 ${selectedIds.has(sale.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-4">
                      <input type="checkbox" checked={selectedIds.has(sale.id)} onChange={() => onToggleSelect(sale.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{sale.saleNumber}</span>
                        {sale.quotation && <span className="text-xs text-gray-500">De: {sale.quotation.quotationNumber}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{sale.client.businessName}</div>
                      {sale.client.contactName && sale.client.contactName !== sale.client.businessName && (
                        <div className="text-sm text-gray-500">{sale.client.contactName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(sale.saleDate)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(sale.total)}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingAmountPaidId === sale.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number" step="0.01" min="0" max={sale.total}
                            value={editingAmountPaidValue}
                            onChange={(e) => onEditAmountPaidValueChange(e.target.value)}
                            className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={updatingAmountPaid} autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveAmountPaid(sale.id, sale.total);
                              if (e.key === 'Escape') onCancelEditAmountPaid();
                            }}
                          />
                          <button onClick={() => onSaveAmountPaid(sale.id, sale.total)} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                            {updatingAmountPaid ? '...' : '✓'}
                          </button>
                          <button onClick={onCancelEditAmountPaid} disabled={updatingAmountPaid} className="px-1.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">✕</button>
                        </div>
                      ) : (
                        <div className="font-medium text-blue-600 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group flex items-center justify-end gap-1" onClick={() => onStartEditAmountPaid(sale)} title="Click para editar monto cobrado">
                          <span>{formatCurrency(sale.amountPaid)}</span>
                          <Edit2 className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {balance > 0 ? (
                        <span className="font-semibold text-orange-600">{formatCurrency(balance.toString())}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentConf.color}`}>{paymentConf.icon} {paymentConf.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <InlineStatusSelect currentStatus={sale.status} statuses={statusOptions} onStatusChange={(s) => onSaleStatusChange(sale.id, sale.status, s)} disabled={updatingId === sale.id} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/practice/ventas/${sale.id}`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Ver"><Eye className="w-4 h-4" /></Link>
                        <Link href={`/dashboard/practice/ventas/${sale.id}/edit`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></Link>
                        <button onClick={() => onDelete(sale.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
