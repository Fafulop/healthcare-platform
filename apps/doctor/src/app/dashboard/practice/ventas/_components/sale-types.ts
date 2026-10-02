export interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: string | null;
  unit: string | null;
  stockQuantity: number | null;
  type: 'product' | 'service';
}

/**
 * A service shown in CITAS (`public.services`, the Perfil Público one) — a DIFFERENT catalog from
 * `Product`. It enters a sale as a free line (`productId = null`): `SaleItem.productId` is an FK
 * to `products`. See docs/DESDE JUNIO/VENTAS PACIENTE/01-DISENO.md.
 */
export interface CitaService {
  id: string;
  serviceName: string;
  shortDescription: string;
  price: number | null;
  isBookingActive: boolean;
}

export interface SaleItem {
  tempId: string;
  productId: number | null;
  itemType: 'product' | 'service';
  description: string;
  sku: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  taxRate2: number;
  taxAmount2: number;
}
