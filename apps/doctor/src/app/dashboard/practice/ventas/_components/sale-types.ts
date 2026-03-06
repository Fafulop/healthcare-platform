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
