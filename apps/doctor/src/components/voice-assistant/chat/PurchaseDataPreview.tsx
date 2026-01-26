'use client';

/**
 * PurchaseDataPreview
 *
 * Displays extracted purchase data with supplier selection and items list.
 * Supplier selection: dropdown with fuzzy matching from passed suppliers list.
 * Items: each item can be linked to existing product OR kept as custom.
 */

import { CheckCircle2, Circle, Package, ShoppingBag, AlertCircle } from 'lucide-react';
import {
  FIELD_LABELS_ES,
  type VoicePurchaseData,
  type VoicePurchaseItemData,
} from '@/types/voice-assistant';

interface Supplier {
  id: number;
  businessName: string;
  contactName?: string | null;
}

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: string | null;
}

interface PurchaseDataPreviewProps {
  data: VoicePurchaseData;
  fieldsExtracted: string[];
  compact?: boolean;
  showMissing?: boolean;
  suppliers?: Supplier[];
  products?: Product[];
  onSupplierSelect?: (supplierId: number | null) => void;
  onProductLink?: (itemIndex: number, productId: number | null) => void;
}

const PURCHASE_GROUPS = {
  basic: {
    label: 'Información Básica',
    fields: ['supplierName', 'purchaseDate', 'deliveryDate'],
  },
  payment: {
    label: 'Información de Pago',
    fields: ['paymentStatus', 'amountPaid'],
  },
  additional: {
    label: 'Información Adicional',
    fields: ['notes', 'termsAndConditions'],
  },
};

export function PurchaseDataPreview({
  data,
  fieldsExtracted,
  compact = false,
  showMissing = false,
  suppliers = [],
  products = [],
  onSupplierSelect,
  onProductLink,
}: PurchaseDataPreviewProps) {
  // Supplier matching suggestions based on supplierName
  const suggestedSuppliers = data.supplierName
    ? suppliers.filter((s) =>
        s.businessName.toLowerCase().includes(data.supplierName!.toLowerCase()) ||
        s.contactName?.toLowerCase().includes(data.supplierName!.toLowerCase())
      )
    : [];

  return (
    <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
      {/* Supplier Selection */}
      {data.supplierName && (
        <div className="border-l-2 border-orange-200 pl-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Proveedor
          </h4>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="font-medium text-gray-900">{data.supplierName}</span>
            </div>

            {suggestedSuppliers.length > 0 && (
              <div className="text-xs text-orange-700 mt-1">
                💡 Coincidencias: {suggestedSuppliers.map(s => s.businessName).join(', ')}
              </div>
            )}

            {suggestedSuppliers.length === 0 && suppliers.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                ℹ️ No se encontraron coincidencias automáticas. Podrás seleccionar manualmente en el formulario.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dates and Payment */}
      {Object.entries(PURCHASE_GROUPS).map(([key, group]) => {
        // Separate filled and missing fields
        const filledFields = group.fields.filter((field) => {
          const value = (data as any)[field];
          return value !== null && value !== undefined && value !== '';
        });

        const missingFields = showMissing
          ? group.fields.filter((field) => {
              const value = (data as any)[field];
              return value === null || value === undefined || value === '';
            })
          : [];

        // Skip group if no fields to show
        if (filledFields.length === 0 && missingFields.length === 0) return null;

        return (
          <div key={key} className="border-l-2 border-blue-200 pl-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {group.label}
              {showMissing && (
                <span className="ml-2 font-normal">
                  ({filledFields.length}/{group.fields.length})
                </span>
              )}
            </h4>
            <div className="space-y-1">
              {/* Show filled fields first */}
              {filledFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={(data as any)[field]}
                  isExtracted={fieldsExtracted.includes(field)}
                  isMissing={false}
                  compact={compact}
                />
              ))}
              {/* Show missing fields */}
              {missingFields.map((field) => (
                <FieldRow
                  key={field}
                  field={field}
                  value={null}
                  isExtracted={false}
                  isMissing={true}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Items List */}
      {data.items && data.items.length > 0 && (
        <div className="border-l-2 border-green-200 pl-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Productos ({data.items.length})
          </h4>
          <div className="space-y-2">
            {data.items.map((item, index) => (
              <PurchaseItemCard
                key={index}
                item={item}
                index={index}
                compact={compact}
                products={products}
              />
            ))}
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {(!data.supplierName || !data.items || data.items.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800">
            <strong>Información incompleta:</strong>
            {!data.supplierName && ' Falta nombre del proveedor.'}
            {(!data.items || data.items.length === 0) && ' Falta al menos un producto.'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single field row display
 */
function FieldRow({
  field,
  value,
  isExtracted,
  isMissing,
  compact,
}: {
  field: string;
  value: any;
  isExtracted: boolean;
  isMissing: boolean;
  compact: boolean;
}) {
  const label = FIELD_LABELS_ES[field] || field;
  const displayValue = isMissing ? 'Sin capturar' : formatValue(field, value);

  return (
    <div className={`flex items-start gap-2 ${isMissing ? 'opacity-60' : ''}`}>
      {isMissing ? (
        <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
      ) : isExtracted ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
      )}
      <div className={compact ? 'flex gap-1 flex-wrap' : ''}>
        <span className={`text-xs ${isMissing ? 'text-gray-400' : 'text-gray-500'}`}>
          {label}:
        </span>
        <span className={`${isMissing ? 'text-gray-400 italic' : 'text-gray-900'} ${compact ? 'text-xs' : 'text-sm'}`}>
          {displayValue}
        </span>
      </div>
    </div>
  );
}

/**
 * Format value for display
 */
function formatValue(field: string, value: any): string {
  if (value === null || value === undefined) return '—';

  if (field === 'paymentStatus') {
    const statusMap: Record<string, string> = {
      'PENDING': 'Pendiente',
      'PARTIAL': 'Pago Parcial',
      'PAID': 'Pagado',
    };
    return statusMap[value] || value;
  }

  if (field === 'amountPaid') {
    return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  }

  if (field.includes('Date') && typeof value === 'string') {
    try {
      // Extract just the date part (YYYY-MM-DD) from ISO timestamp (2026-01-23T00:00:00.000Z)
      const datePart = value.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return value;
    } catch {
      return value;
    }
  }

  return String(value);
}

/**
 * Single purchase item card
 */
function PurchaseItemCard({
  item,
  index,
  compact,
  products,
}: {
  item: VoicePurchaseItemData;
  index: number;
  compact: boolean;
  products: Product[];
}) {
  // Product matching suggestions based on productName
  const suggestedProducts = item.productName
    ? products.filter((p) =>
        p.name.toLowerCase().includes(item.productName!.toLowerCase()) ||
        p.sku?.toLowerCase().includes(item.productName!.toLowerCase())
      )
    : [];

  // Safe calculations with defaults for null/undefined values
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;
  const discountRate = item.discountRate ?? 0;
  const taxRate = item.taxRate !== null && item.taxRate !== undefined ? item.taxRate : 0.16;

  const subtotal = quantity * unitPrice;
  const discountAmount = discountRate > 0 ? subtotal * discountRate : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = subtotalAfterDiscount * taxRate;
  const total = subtotalAfterDiscount + taxAmount;

  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="flex items-start gap-2">
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.itemType === 'product' ? (
              <Package className="w-3 h-3 text-orange-600 flex-shrink-0" />
            ) : (
              <ShoppingBag className="w-3 h-3 text-blue-600 flex-shrink-0" />
            )}
            <span className="font-medium text-gray-900">{item.description}</span>
            {item.sku && (
              <span className="text-gray-400 text-xs">SKU: {item.sku}</span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              item.itemType === 'product'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {item.itemType === 'product' ? 'Producto' : 'Servicio'}
            </span>
          </div>

          {/* Product matching suggestion */}
          {item.productName && suggestedProducts.length > 0 && (
            <div className="text-xs text-blue-600 mt-1">
              💡 Podría corresponder a: {suggestedProducts.slice(0, 2).map(p => p.name).join(', ')}
              {suggestedProducts.length > 2 && ` y ${suggestedProducts.length - 2} más`}
            </div>
          )}

          {/* Item details */}
          <div className={`mt-1 text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
            <span className="font-medium">{quantity} {item.unit}</span>
            <span> × ${unitPrice.toFixed(2)}</span>
            {discountRate > 0 && (
              <span className="text-green-600"> • {(discountRate * 100).toFixed(0)}% desc.</span>
            )}
            {taxRate !== 0.16 && (
              <span> • IVA {(taxRate * 100).toFixed(0)}%</span>
            )}
            <span className="font-semibold text-gray-900"> = ${total.toFixed(2)}</span>
          </div>

          {/* Calculation breakdown (if has discount or custom tax) */}
          {(discountRate > 0) || (taxRate !== 0.16) ? (
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              <div>Subtotal: ${subtotal.toFixed(2)}</div>
              {discountRate > 0 && (
                <div className="text-green-600">Descuento: -${discountAmount.toFixed(2)}</div>
              )}
              <div>Subtotal después de desc.: ${subtotalAfterDiscount.toFixed(2)}</div>
              <div>Impuesto ({(taxRate * 100).toFixed(0)}%): +${taxAmount.toFixed(2)}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PurchaseDataPreview;
