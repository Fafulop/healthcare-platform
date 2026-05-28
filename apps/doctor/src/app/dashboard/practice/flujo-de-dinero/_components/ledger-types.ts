export interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

export interface Subarea {
  id: number;
  name: string;
  description: string | null;
}

export interface Area {
  id: number;
  name: string;
  description: string | null;
  type: 'INGRESO' | 'EGRESO';
  subareas: Subarea[];
}

export interface LedgerEntry {
  id: number;
  amount: string;
  concept: string;
  bankAccount: string | null;
  bankMovementId: string | null;
  formaDePago: string;
  internalId: string;
  entryType: string;
  transactionDate: string;
  area: string;
  subarea: string;
  porRealizar: boolean;
  attachments: any[];
  facturas: any[];
  facturasXml: any[];
  transactionType?: string;
  clientId?: number;
  supplierId?: number;
  paymentStatus?: string;
  amountPaid?: string;
  client?: { id: number; businessName: string; contactName: string | null };
  supplier?: { id: number; businessName: string; contactName: string | null };
  sale?: { id: number; saleNumber: string; total: string };
  purchase?: { id: number; purchaseNumber: string; total: string };
  origin?: string;
  hasComprobante?: boolean;
  hasFactura?: boolean;
  serviceId?: string | null;
  serviceName?: string | null;
}

export const ORIGIN_LABELS: Record<string, { label: string; color: string }> = {
  cita: { label: 'Cita', color: 'bg-blue-100 text-blue-800' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
  venta: { label: 'Venta', color: 'bg-purple-100 text-purple-800' },
  compra: { label: 'Compra', color: 'bg-orange-100 text-orange-800' },
  sat_recibido: { label: 'SAT', color: 'bg-amber-100 text-amber-800' },
  banco: { label: 'Banco', color: 'bg-indigo-100 text-indigo-800' },
  webhook_pago: { label: 'Pago Online', color: 'bg-cyan-100 text-cyan-800' },
};

export interface Balance {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  pendingIngresos: number;
  pendingEgresos: number;
  projectedBalance: number;
}

export const FORMAS_DE_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'deposito', label: 'Depósito' },
] as const;
