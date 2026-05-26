export interface BankStatement {
  id: number;
  fileName: string;
  fileUrl: string;
  bankName: string;
  accountNumber: string;
  periodMonth: number;
  periodYear: number;
  totalDeposits: string | null;
  totalWithdrawals: string | null;
  endingBalance: string | null;
  status: string;
  movementCount: number;
  matchedCount: number;
  newCount: number;
  createdAt: string;
  _count?: { movements: number };
}

export interface BankMovement {
  id: number;
  bankStatementId: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  amount: string;
  movementType: string;
  balance: string | null;
  suggestedArea: string | null;
  suggestedSubarea: string | null;
  suggestedConcept: string | null;
  matchStatus: string;
  matchConfidence: string | null;
  ledgerEntryId: number | null;
  ledgerEntry: {
    id: number;
    concept: string;
    amount: string;
    entryType: string;
    area: string;
    subarea: string;
    transactionDate: string;
  } | null;
}

export interface StatementDetail extends BankStatement {
  movements: BankMovement[];
}

export const BANK_OPTIONS = [
  { value: 'bbva', label: 'BBVA' },
  { value: 'banorte', label: 'Banorte' },
  { value: 'hsbc', label: 'HSBC' },
  { value: 'santander', label: 'Santander' },
  { value: 'scotiabank', label: 'Scotiabank' },
  { value: 'otro', label: 'Otro' },
] as const;

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MATCH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  matched_auto: { label: 'Match automático', color: 'bg-blue-100 text-blue-800' },
  matched_confirmed: { label: 'Confirmado', color: 'bg-green-100 text-green-800' },
  unmatched: { label: 'Sin match', color: 'bg-yellow-100 text-yellow-800' },
  ignored: { label: 'Ignorado', color: 'bg-gray-100 text-gray-600' },
};
