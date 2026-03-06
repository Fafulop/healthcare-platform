'use client';

import { X } from 'lucide-react';

interface Props {
  customItemType: 'product' | 'service';
  customDescription: string;
  customQuantity: number;
  customUnit: string;
  customPrice: number;
  onTypeChange: (v: 'product' | 'service') => void;
  onDescriptionChange: (v: string) => void;
  onQuantityChange: (v: number) => void;
  onUnitChange: (v: string) => void;
  onPriceChange: (v: number) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function SaleCustomItemModal({
  customItemType, customDescription, customQuantity, customUnit, customPrice,
  onTypeChange, onDescriptionChange, onQuantityChange, onUnitChange, onPriceChange,
  onAdd, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {customItemType === 'product' ? 'Producto Personalizado' : 'Servicio Personalizado'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { onTypeChange('service'); onUnitChange('servicio'); }}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                customItemType === 'service' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Servicio
            </button>
            <button
              type="button"
              onClick={() => { onTypeChange('product'); onUnitChange('pza'); }}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                customItemType === 'product' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Producto
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción *</label>
            <input
              type="text"
              value={customDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre del producto o servicio"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad *</label>
              <input
                type="number" min="0.01" step="0.01" value={customQuantity}
                onChange={(e) => onQuantityChange(parseFloat(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unidad *</label>
              <select
                value={customUnit}
                onChange={(e) => onUnitChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {customItemType === 'product' ? (
                  <>
                    <option value="pza">Pieza</option>
                    <option value="kg">Kilogramo</option>
                    <option value="lt">Litro</option>
                    <option value="mt">Metro</option>
                    <option value="caja">Caja</option>
                    <option value="paquete">Paquete</option>
                  </>
                ) : (
                  <>
                    <option value="servicio">Servicio</option>
                    <option value="hora">Hora</option>
                    <option value="día">Día</option>
                    <option value="sesión">Sesión</option>
                    <option value="consulta">Consulta</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Precio Unitario *</label>
            <input
              type="number" min="0" step="0.01" value={customPrice}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onAdd}
              disabled={!customDescription || customPrice <= 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
