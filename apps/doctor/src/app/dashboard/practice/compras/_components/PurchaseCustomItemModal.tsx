'use client';

import { X } from 'lucide-react';

interface Props {
  show: boolean;
  itemType: 'product' | 'service';
  description: string;
  quantity: number;
  unit: string;
  price: number;
  onDescriptionChange: (v: string) => void;
  onQuantityChange: (v: number) => void;
  onUnitChange: (v: string) => void;
  onPriceChange: (v: number) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function PurchaseCustomItemModal({
  show, itemType, description, quantity, unit, price,
  onDescriptionChange, onQuantityChange, onUnitChange, onPriceChange,
  onAdd, onClose,
}: Props) {
  if (!show) return null;

  const isProduct = itemType === 'product';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className={`p-6 border-b flex justify-between items-center ${isProduct ? 'bg-purple-50' : 'bg-blue-50'}`}>
          <h3 className="text-xl font-bold text-gray-900">
            {isProduct ? 'Agregar Producto Personalizado' : 'Agregar Servicio Personalizado'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción {isProduct ? 'del producto' : 'del servicio'} *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder={isProduct
                ? 'Ej: Producto especial, Item único, etc.'
                : 'Ej: Consulta especializada, Instalación, etc.'}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => onQuantityChange(parseFloat(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unidad *</label>
              <select
                value={unit}
                onChange={(e) => onUnitChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {isProduct ? (
                  <>
                    <option value="pza">pza</option>
                    <option value="kg">kg</option>
                    <option value="lt">lt</option>
                    <option value="mt">mt</option>
                    <option value="caja">caja</option>
                    <option value="paquete">paquete</option>
                  </>
                ) : (
                  <>
                    <option value="servicio">servicio</option>
                    <option value="hora">hora</option>
                    <option value="día">día</option>
                    <option value="sesión">sesión</option>
                    <option value="consulta">consulta</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Precio unitario *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-xl font-bold text-gray-900">
                ${(quantity * price).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={onAdd}
              disabled={!description || price <= 0}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isProduct ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Agregar {isProduct ? 'Producto' : 'Servicio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
