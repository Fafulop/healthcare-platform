'use client';

import { X } from 'lucide-react';
import type { Product } from './quotation-types';

interface Props {
  show: boolean;
  productTypeFilter: 'product' | 'service' | null;
  products: Product[];
  productSearch: string;
  onSearchChange: (v: string) => void;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function QuotationProductModal({
  show, productTypeFilter, products, productSearch,
  onSearchChange, onSelect, onClose,
}: Props) {
  if (!show) return null;

  const isService = productTypeFilter === 'service';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">
            {isService ? 'Seleccionar Servicio' : 'Seleccionar Producto'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b">
          <input
            type="text"
            placeholder={isService ? 'Buscar servicio por nombre...' : 'Buscar producto por nombre o SKU...'}
            value={productSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto max-h-96 p-6">
          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isService
                ? 'No se encontraron servicios. Crea uno en Productos y Servicios.'
                : 'No se encontraron productos'}
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <div
                  key={product.id}
                  onClick={() => onSelect(product)}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-500 cursor-pointer transition-all"
                >
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  {product.sku && <div className="text-sm text-gray-500">SKU: {product.sku}</div>}
                  {product.description && <div className="text-sm text-gray-600 mt-1">{product.description}</div>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-blue-600">
                      ${parseFloat(product.price || '0').toFixed(2)} {product.unit && `/ ${product.unit}`}
                    </span>
                    {product.stockQuantity !== null && (
                      <span className="text-sm text-gray-500">Stock: {product.stockQuantity}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
