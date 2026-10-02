'use client';

import { X } from 'lucide-react';
import type { CitaService, Product } from './sale-types';

interface Props {
  products: Product[];
  /** Citas services (a separate catalog). Only passed with the service filter; empty for products. */
  citaServices: CitaService[];
  /** The Citas services failed to load: say so, don't show their absence as «no services». */
  citaServicesError?: boolean;
  productSearch: string;
  onProductSearchChange: (v: string) => void;
  productTypeFilter: 'product' | 'service' | null;
  onSelect: (product: Product) => void;
  onSelectCitaService: (service: CitaService) => void;
  onClose: () => void;
}

export function SaleProductModal({
  products, citaServices, citaServicesError = false, productSearch, onProductSearchChange,
  productTypeFilter, onSelect, onSelectCitaService, onClose,
}: Props) {
  const esServicio = productTypeFilter === 'service';
  const falloCitas = esServicio && citaServicesError;
  const vacio = products.length === 0 && citaServices.length === 0 && !falloCitas;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {esServicio ? 'Seleccionar Servicio' : 'Seleccionar Producto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <input
            type="text"
            placeholder={esServicio ? 'Buscar servicio por nombre...' : 'Buscar producto por nombre o SKU...'}
            value={productSearch}
            onChange={(e) => onProductSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />

          <div className="overflow-y-auto max-h-96 space-y-2">
            {vacio ? (
              <div className="text-center py-8 text-gray-500">
                {esServicio
                  ? 'No se encontraron servicios. Agrégalos en tu Perfil Público (los de tus citas) o en Productos y Servicios.'
                  : 'No se encontraron productos'}
              </div>
            ) : (
              <>
                {falloCitas && (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No se pudieron cargar los servicios de tus citas. Cierra y vuelve a abrir la venta para reintentar.
                  </p>
                )}
                {citaServices.length > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">Servicios de tus citas</p>
                    {citaServices.map(service => (
                      <button
                        key={service.id}
                        onClick={() => onSelectCitaService(service)}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{service.serviceName}</div>
                            {service.shortDescription && (
                              <div className="text-sm text-gray-500 line-clamp-2">{service.shortDescription}</div>
                            )}
                            {!service.isBookingActive && (
                              <div className="text-xs text-amber-700 mt-1">No se agenda en línea</div>
                            )}
                          </div>
                          <span className="font-semibold text-blue-600 whitespace-nowrap">
                            {service.price != null ? `$${service.price.toFixed(2)}` : 'Sin precio'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {products.length > 0 && (
                  <>
                    {(citaServices.length > 0 || falloCitas) && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-3">De Productos y Servicios</p>
                    )}
                    {products.map(product => (
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
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
