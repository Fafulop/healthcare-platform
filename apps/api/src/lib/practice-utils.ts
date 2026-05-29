import { prisma } from '@healthcare/database';
import type { PrismaClient } from '@healthcare/database';

// Prisma transaction client type
type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ─── Payment Status ──────────────────────────────────────────────────────────

export function calculatePaymentStatus(
  amountPaid: number,
  total: number
): 'PENDING' | 'PARTIAL' | 'PAID' {
  if (amountPaid <= 0) return 'PENDING';
  if (amountPaid >= total) return 'PAID';
  return 'PARTIAL';
}

// ─── Document Number Generation ─────────────────────────────────────────────

/**
 * Computes the next sequential number string given the last known ID with the
 * same prefix. Format: {PREFIX}-{YYYY}-{NNN}
 */
function nextSequence(lastId: string | null | undefined, prefix: string): string {
  if (!lastId) return `${prefix}001`;
  const parts = lastId.split('-');
  const lastNum = parseInt(parts[parts.length - 1], 10);
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${prefix}${next.toString().padStart(3, '0')}`;
}

export async function generateSaleNumber(
  _doctorId: string,
  tx: TxClient | PrismaClient = prisma
): Promise<string> {
  const prefix = `VTA-${new Date().getFullYear()}-`;
  const last = await (tx as PrismaClient).sale.findFirst({
    where: { saleNumber: { startsWith: prefix } },
    orderBy: { saleNumber: 'desc' },
    select: { saleNumber: true },
  });
  return nextSequence(last?.saleNumber, prefix);
}

export async function generatePurchaseNumber(
  _doctorId: string,
  tx: TxClient | PrismaClient = prisma
): Promise<string> {
  const prefix = `CMP-${new Date().getFullYear()}-`;
  const last = await (tx as PrismaClient).purchase.findFirst({
    where: { purchaseNumber: { startsWith: prefix } },
    orderBy: { purchaseNumber: 'desc' },
    select: { purchaseNumber: true },
  });
  return nextSequence(last?.purchaseNumber, prefix);
}

export async function generateQuotationNumber(
  _doctorId: string,
  tx: TxClient | PrismaClient = prisma
): Promise<string> {
  const prefix = `COT-${new Date().getFullYear()}-`;
  const last = await (tx as PrismaClient).quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix } },
    orderBy: { quotationNumber: 'desc' },
    select: { quotationNumber: true },
  });
  return nextSequence(last?.quotationNumber, prefix);
}

export async function generateLedgerInternalId(
  doctorId: string,
  entryType: string,
  tx: TxClient | PrismaClient = prisma
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = entryType === 'ingreso' ? `ING-${year}-` : `EGR-${year}-`;
  const last = await (tx as PrismaClient).ledgerEntry.findFirst({
    where: { doctorId, internalId: { startsWith: prefix } },
    orderBy: { internalId: 'desc' },
    select: { internalId: true },
  });
  return nextSequence(last?.internalId, prefix);
}

// ─── Webhook Payment → LedgerEntry ──────────────────────────────────────────

interface PaymentLedgerInput {
  doctorId: string;
  amount: number;
  concept: string;
  bookingId?: string | null;
  formaDePago: string;
  paymentProvider: 'stripe' | 'mercadopago';
}

/**
 * Creates a LedgerEntry from a payment webhook (Stripe or MercadoPago).
 * Idempotent: skips if a LedgerEntry already exists for the bookingId.
 * Returns the created entry or null if skipped.
 */
export async function createPaymentLedgerEntry(
  input: PaymentLedgerInput
): Promise<{ id: number; internalId: string } | null> {
  const { doctorId, amount, concept, bookingId, formaDePago, paymentProvider } = input;

  // Idempotency: if bookingId is set, check if a LedgerEntry already exists
  if (bookingId) {
    const existing = await prisma.ledgerEntry.findUnique({
      where: { bookingId },
      select: { id: true, internalId: true },
    });
    if (existing) return null;
  }

  const internalId = await generateLedgerInternalId(doctorId, 'ingreso');

  // Resolve service from linked booking if available
  let serviceId: string | null = null;
  let serviceName: string | null = null;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { serviceId: true, serviceName: true },
    });
    if (booking) {
      serviceId = booking.serviceId;
      serviceName = booking.serviceName;
    }
  }

  const defaultArea = await getDefaultArea(doctorId, 'INGRESO');

  const entry = await prisma.ledgerEntry.create({
    data: {
      doctorId,
      amount,
      concept: concept.substring(0, 500),
      entryType: 'ingreso',
      transactionDate: new Date(),
      internalId,
      formaDePago,
      area: defaultArea.area,
      subarea: serviceName || defaultArea.subarea,
      origin: 'webhook_pago',
      transactionType: 'N/A',
      amountPaid: amount,
      paymentStatus: 'PAID',
      hasComprobante: true,
      ...(bookingId ? { bookingId } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(serviceName ? { serviceName } : {}),
    },
    select: { id: true, internalId: true },
  });

  console.log(`[${paymentProvider}] LedgerEntry ${entry.internalId} created for payment of $${amount}${bookingId ? ` (booking ${bookingId})` : ''}`);
  return entry;
}

// ─── Default Area Resolution ────────────────────────────────────────────────

/**
 * Look up the doctor's first configured area (and optionally first subarea)
 * for the given type. Returns empty strings if no area is configured.
 */
export async function getDefaultArea(
  doctorId: string,
  type: 'INGRESO' | 'EGRESO',
  tx?: TxClient | PrismaClient,
): Promise<{ area: string; subarea: string }> {
  const db = (tx || prisma) as PrismaClient;
  const found = await db.practiceArea.findFirst({
    where: { doctorId, type },
    include: { subareas: { take: 1, orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });
  if (!found) return { area: '', subarea: '' };
  return {
    area: found.name,
    subarea: found.subareas[0]?.name || '',
  };
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse page/limit from URL search params.
 * @param defaultLimit - default rows per page (use 50 for transaction lists, 200 for master data)
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 50
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? defaultLimit : rawLimit), 500);
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(total: number, { page, limit }: PaginationParams): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// ─── Item Calculation ────────────────────────────────────────────────────────

export interface LineItem {
  quantity: number | string;
  unitPrice: number | string;
  discountRate?: number | string;
  taxRate?: number | string;
  productId?: number | null;
  itemType?: string;
  description?: string;
  sku?: string | null;
  unit?: string | null;
}

export interface ComputedItem {
  productId: number | null;
  itemType: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  order: number;
}

export interface ItemTotals {
  subtotal: number;
  totalTax: number;
  total: number;
  items: ComputedItem[];
}

export function computeItemTotals(rawItems: LineItem[]): ItemTotals {
  let subtotal = 0;
  let totalTax = 0;

  const items: ComputedItem[] = rawItems.map((item, index) => {
    const qty = parseFloat(String(item.quantity));
    const price = parseFloat(String(item.unitPrice));
    const discountRate = item.discountRate !== undefined ? parseFloat(String(item.discountRate)) : 0;
    const itemTaxRate = item.taxRate !== undefined ? parseFloat(String(item.taxRate)) : 0.16;

    const base = qty * price;
    const itemSubtotal = base - base * discountRate;
    const taxAmount = itemSubtotal * itemTaxRate;

    subtotal += itemSubtotal;
    totalTax += taxAmount;

    return {
      productId: item.productId || null,
      itemType: item.itemType || 'product',
      description: item.description || '',
      sku: item.sku || null,
      quantity: qty,
      unit: item.unit || null,
      unitPrice: price,
      discountRate,
      taxRate: itemTaxRate,
      taxAmount,
      subtotal: itemSubtotal,
      order: index,
    };
  });

  return { subtotal, totalTax, total: subtotal + totalTax, items };
}
