'use client';

import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { SaleItem } from './sale-types';

interface Props {
  items: SaleItem[];
  taxColumnLabel: string;
  taxColumnLabel2: string;
  onTaxColumnLabelChange: (v: string) => void;
  onTaxColumnLabel2Change: (v: string) => void;
  onOpenServiceModal: () => void;
  onOpenProductModal: () => void;
  onOpenCustomModal: () => void;
  onRemoveItem: (tempId: string) => void;
  onUpdateQuantity: (tempId: string, quantity: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onUpdateDiscount: (tempId: string, discountRate: number) => void;
  onUpdateTaxRate: (tempId: string, taxRate: number) => void;
  onUpdateTaxRate2: (tempId: string, taxRate2: number) => void;
}

export function SaleItemsSection({
  items, taxColumnLabel, taxColumnLabel2,
  onTaxColumnLabelChange, onTaxColumnLabel2Change,
  onOpenServiceModal, onOpenProductModal, onOpenCustomModal,
  onRemoveItem, onUpdateQuantity, onUpdatePrice,
  onUpdateDiscount, onUpdateTaxRate, onUpdateTaxRate2,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Servicios</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          onClick={onOpenServiceModal}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors"
        >
          <Plus className="w-5 h-5" />
          Agregar Servicio
        </button>
        <button
          type="button"
          onClick={onOpenProductModal}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-md transition-colors border border-gray-300"
        >
          <Plus className="w-5 h-5" />
          Agregar Producto
        </button>
        <button
          type="button"
          onClick={onOpenCustomModal}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-md transition-colors border border-gray-300"
        >
          <Plus className="w-5 h-5" />
          Producto o Servicio Personalizado
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p>No hay servicios agregados</p>
          <p className="text-sm text-gray-400 mt-1">Haz clic en &quot;Agregar Servicio&quot; para comenzar</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cant.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P. Unit.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desc. %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  <input
                    type="text"
                    value={taxColumnLabel}
                    onChange={(e) => onTaxColumnLabelChange(e.target.value)}
                    className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                    placeholder="IVA %"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  <input
                    type="text"
                    value={taxColumnLabel2}
                    onChange={(e) => onTaxColumnLabel2Change(e.target.value)}
                    className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                    placeholder="Imp. 2 %"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
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
                      type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.tempId, parseFloat(e.target.value) || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={(e) => onUpdatePrice(item.tempId, parseFloat(e.target.value) || 0)}
                      className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={(item.discountRate * 100).toFixed(2)}
                      onChange={(e) => onUpdateDiscount(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={(item.taxRate * 100).toFixed(2)}
                      onChange={(e) => onUpdateTaxRate(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" min="0" max="100" step="0.01"
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
