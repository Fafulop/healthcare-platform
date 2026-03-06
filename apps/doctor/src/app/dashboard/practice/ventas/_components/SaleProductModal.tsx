'use client';

import { X } from 'lucide-react';
import type { Product } from './sale-types';

interface Props {
  products: Product[];
  productSearch: string;
  onProductSearchChange: (v: string) => void;
  productTypeFilter: 'product' | 'service' | null;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function SaleProductModal({
  products, productSearch, onProductSearchChange,
  productTypeFilter, onSelect, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {productTypeFilter === 'service' ? 'Seleccionar Servicio' : 'Seleccionar Producto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <input
            type="text"
            placeholder={productTypeFilter === 'service' ? 'Buscar servicio por nombre...' : 'Buscar producto por nombre o SKU...'}
            value={productSearch}
            onChange={(e) => onProductSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />

          <div className="overflow-y-auto max-h-96 space-y-2">
            {products.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {productTypeFilter === 'service'
                  ? 'No se encontraron servicios. Crea uno en Productos y Servicios.'
                  : 'No se encontraron productos'}
              </div>
            ) : (
              products.map(product => (
                <button
                  key={product.id}
                  onClick={() => onSelect(product)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">{product.name}</div>
                  {product.sku && <div className="text-sm text-gray-500">SKU: {product.sku}</div>}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-600">
                      {product.stockQuantity !== null
                        ? `Stock: ${product.stockQuantity} ${product.unit || 'unidades'}`
                        : 'Sin stock registrado'}
                    </span>
                    <span className="font-semibold text-blue-600">
                      ${parseFloat(product.price || '0').toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
