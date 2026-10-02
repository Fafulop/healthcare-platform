'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface SaleQuotation {
  id: number;
  quotationNumber: string;
  issueDate: string;
}

export interface SaleItem {
  id: number;
  description: string;
  sku: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
}

export interface Sale {
  id: number;
  saleNumber: string;
  saleDate: string;
  deliveryDate: string | null;
  status: string;
  paymentStatus: string;
  subtotal: string;
  taxRate: string | null;
  tax: string | null;
  total: string;
  amountPaid: string;
  notes: string | null;
  termsAndConditions: string | null;
  client: Client;
  quotation: SaleQuotation | null;
  items: SaleItem[];
}

export const statusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: '✓' },
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: '⚙️' },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: '📦' },
  DELIVERED: { label: 'Entregada', color: 'bg-green-100 text-green-800', icon: '✅' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800', icon: '🚫' },
};

export const paymentStatusConfig = {
  PENDING: { label: 'Pendiente', color: 'bg-red-100 text-red-800', icon: '💵' },
  PARTIAL: { label: 'Pago Parcial', color: 'bg-orange-100 text-orange-800', icon: '💰' },
  PAID: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: '✅' },
};

export function useVentaDetail() {
  const params = useParams();
  const saleId = params.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (saleId) fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const fetchSale = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`);
      if (!response.ok) throw new Error('Error al cargar la venta');
      const result = await response.json();
      setSale(result.data);
    } catch (err: any) {
      console.error('Error al cargar venta:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { sale, loading, error };
}
