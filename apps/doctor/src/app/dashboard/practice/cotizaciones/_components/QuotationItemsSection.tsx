'use client';

import { Plus, Trash2, FileText } from 'lucide-react';
import type { QuotationItem } from './quotation-types';

interface Props {
  items: QuotationItem[];
  taxColumnLabel: string;
  taxColumnLabel2: string;
  onTaxColumnLabelChange: (v: string) => void;
  onTaxColumnLabel2Change: (v: string) => void;
  onAddService: () => void;
  onAddProduct: () => void;
  onAddCustomItem: () => void;
  onRemoveItem: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, quantity: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onUpdateDiscount: (tempId: string, discountRate: number) => void;
  onUpdateTaxRate: (tempId: string, taxRate: number) => void;
  onUpdateTaxRate2: (tempId: string, taxRate2: number) => void;
}

export function QuotationItemsSection({
  items, taxColumnLabel, taxColumnLabel2,
  onTaxColumnLabelChange, onTaxColumnLabel2Change,
  onAddService, onAddProduct, onAddCustomItem,
  onRemoveItem, onUpdateQuantity, onUpdatePrice,
  onUpdateDiscount, onUpdateTaxRate, onUpdateTaxRate2,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Productos y Servicios</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          onClick={onAddService}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Agregar Servicio
        </button>
        <button
          type="button"
          onClick={onAddProduct}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300"
        >
          <Plus className="w-5 h-5" />
          Agregar Producto
        </button>
        <button
          type="button"
          onClick={onAddCustomItem}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300"
        >
          <Plus className="w-5 h-5" />
          Producto o Servicio Personalizado
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p>No hay productos o servicios agregados</p>
          <p className="text-sm text-gray-400 mt-1">Haz clic en los botones de arriba para agregar items</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cant.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">P. Unit.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Desc. %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                  <input
                    type="text"
                    value={taxColumnLabel}
                    onChange={(e) => onTaxColumnLabelChange(e.target.value)}
                    className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                    placeholder="RTP %"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                  <input
                    type="text"
                    value={taxColumnLabel2}
                    onChange={(e) => onTaxColumnLabel2Change(e.target.value)}
                    className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                    placeholder="Imp. 2 %"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subtotal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => (
                <tr key={item.tempId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.description}</div>
                    {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                    {!item.productId && (
                      <div className={`text-xs ${item.itemType === 'product' ? 'text-purple-600' : 'text-blue-600'}`}>
                        {item.itemType === 'product' ? 'Producto personalizado' : 'Servicio personalizado'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.tempId, parseFloat(e.target.value) || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => onUpdatePrice(item.tempId, parseFloat(e.target.value) || 0)}
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(item.discountRate * 100).toFixed(2)}
                      onChange={(e) => onUpdateDiscount(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(item.taxRate * 100).toFixed(2)}
                      onChange={(e) => onUpdateTaxRate(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(item.taxRate2 * 100).toFixed(2)}
                      onChange={(e) => onUpdateTaxRate2(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${item.subtotal.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemoveItem(item.tempId)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
