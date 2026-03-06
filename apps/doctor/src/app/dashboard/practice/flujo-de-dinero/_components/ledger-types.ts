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
}

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
