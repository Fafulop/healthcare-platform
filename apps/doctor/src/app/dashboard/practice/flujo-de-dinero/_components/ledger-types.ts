/** Hardcoded area name for service-based ingresos (appointments, manual with service). */
export const AREA_INGRESOS_CONSULTA = 'Ingresos Consulta';

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

/** The Stripe/Mercado Pago payment behind a webhook_pago entry (evidence modal). */
export interface OnlinePaymentEvidence {
  proveedor: 'Stripe' | 'Mercado Pago';
  monto: number;
  moneda: string;
  descripcion: string | null;
  pagadoEl: string | null;
  metodo: string | null;
  referencia: string;
  /** Link status at read time (PAID, or CANCELLED/etc. after a refund/chargeback). */
  estado: string;
  /** true = identified by amount+time proximity (orphan link), not a hard bookingId link. */
  matchHeuristico: boolean;
}

/** A bank statement line that reconciled an entry (direct 1:1 or via a settlement). */
export interface BankMovementEvidence {
  id: number;
  transactionDate: string;
  description: string | null;
  reference: string | null;
  amount: string;
  movementType: string; // 'deposit' | 'withdrawal'
  bankStatement: {
    bankName: string;
    accountNumber: string;
    periodMonth: number;
    periodYear: number;
  } | null;
}

export interface LedgerEntry {
  id: number;
  amount: string;
  concept: string;
  bankAccount: string | null;
  bankMovementId: string | null;
  formaDePago: string | null;
  internalId: string;
  entryType: string;
  transactionDate: string;
  area: string | null;
  subarea: string | null;
  porRealizar: boolean;
  attachments: { id: number; fileName: string; fileUrl: string; fileSize: number; fileType: string; createdAt: string }[];
  facturas: any[];
  facturasXml: any[];
  transactionType?: string;
  clientId?: number;
  supplierId?: number;
  counterpartyRfc?: string | null;
  counterpartyName?: string | null;
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
  satCfdiUuid?: string | null;
  needsReview?: boolean;
  autoLinkedConfidence?: string | null;
}

export const ORIGIN_LABELS: Record<string, { label: string; color: string }> = {
  cita: { label: 'Cita', color: 'bg-blue-100 text-blue-800' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
  venta: { label: 'Venta', color: 'bg-purple-100 text-purple-800' },
  compra: { label: 'Compra', color: 'bg-orange-100 text-orange-800' },
  sat_recibido: { label: 'SAT Recibido', color: 'bg-amber-100 text-amber-800' },
  sat_emitido: { label: 'SAT Emitido', color: 'bg-amber-100 text-amber-800' },
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

export interface CfdiSuggestion {
  uuid: string;
  direction: string;
  efecto: string | null;
  issuerRfc: string;
  issuerName: string | null;
  receiverRfc: string;
  receiverName: string | null;
  monto: string;
  issuedAt: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

export const FORMAS_DE_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'deposito', label: 'Depósito' },
] as const;

/** SAT forma de pago codes → labels (used in CFDI detail views). */
export const SAT_FORMA_PAGO_LABELS: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque nominativo', '03': 'Transferencia',
  '04': 'Tarjeta de crédito', '06': 'Dinero electrónico',
  '28': 'Tarjeta de débito', '99': 'Por definir',
};

export const SAT_EFECTO_LABELS: Record<string, string> = {
  I: 'Ingreso', E: 'Egreso', P: 'Pago', T: 'Traslado', N: 'Nómina',
};
