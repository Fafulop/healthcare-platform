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

  // Resolve service + patient identity from linked booking if available.
  // Patient fiscal identity is denormalized (same as completeBooking) so SAT matching can
  // link the eventual CFDI by RFC and patient-scoped income queries see this entry.
  let serviceId: string | null = null;
  let serviceName: string | null = null;
  let patientId: string | null = null;
  let counterpartyRfc: string | null = null;
  let counterpartyName: string | null = null;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        serviceId: true,
        serviceName: true,
        patientId: true,
        patientName: true,
        patient: { select: { rfc: true, razonSocial: true } },
      },
    });
    if (booking) {
      serviceId = booking.serviceId;
      serviceName = booking.serviceName;
      patientId = booking.patientId;
      counterpartyRfc = booking.patient?.rfc?.trim().toUpperCase().slice(0, 13) || null;
      counterpartyName = booking.patient?.razonSocial || booking.patientName || null;
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
      ...(patientId ? { patientId } : {}),
      ...(counterpartyRfc ? { counterpartyRfc } : {}),
      ...(counterpartyName ? { counterpartyName } : {}),
    },
    select: { id: true, internalId: true },
  });

  console.log(`[${paymentProvider}] LedgerEntry ${entry.internalId} created for payment of $${amount}${bookingId ? ` (booking ${bookingId})` : ''}`);
  return entry;
}

// ─── Appointment completion → LedgerEntry (server-side internal effect) ──────

/**
 * Area name for appointment income. MUST stay in sync with the client constant
 * `AREA_INGRESOS_CONSULTA` in
 * apps/doctor/.../flujo-de-dinero/_components/ledger-types.ts ('Ingresos Consulta').
 * Duplicated here because the API app can't import from the doctor app.
 */
const AREA_INGRESOS_CONSULTA = 'Ingresos Consulta';

const VALID_FORMAS_DE_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'deposito'];

interface CitaLedgerInput {
  doctorId: string;
  bookingId: string;
  amount: number;
  formaDePago: string;
  /**
   * TRATAMIENTOS T6 — la cita es una sesión CUBIERTA por el paquete de su tratamiento
   * (`paqueteDeCita`). Entonces `amount` es 0 («cubierta por el paquete») o el EXTRA, y el
   * movimiento se liga también al tratamiento. Sin esto, se comporta como siempre.
   */
  paquete?: { tratamientoId: string; nombre: string };
}

/**
 * Creates the income LedgerEntry for a COMPLETED appointment, server-side, as an
 * internal effect of the completion (which is a `citas`-permitted action). This is
 * why it lives on the server and NOT as a client POST to /practice-management/ledger:
 * a secondary user with `citas` but not `flujo` must still get the income recorded
 * (00-REQUISITOS §3.6 "los efectos internos de una acción permitida siempre proceden").
 *
 * Field parity with the two former client payloads (useBookings.completeBooking and
 * the agent's complete_booking executor) is deliberate — concept, area, subarea,
 * patient fiscal identity and transactionDate are rebuilt here from the booking so the
 * written row is byte-for-byte what those clients produced.
 *
 * Idempotent on the bookingId @unique: if income already exists (e.g. a paid payment
 * link created it via webhook), returns it with alreadyExisted:true instead of throwing.
 */
export async function createCitaLedgerEntry(
  input: CitaLedgerInput
): Promise<{ id: number; internalId: string; alreadyExisted: boolean }> {
  const { doctorId, bookingId, amount } = input;
  const formaDePago = VALID_FORMAS_DE_PAGO.includes(input.formaDePago) ? input.formaDePago : 'efectivo';

  // Idempotency pre-check (mirrors the POST route + createPaymentLedgerEntry).
  const existing = await prisma.ledgerEntry.findUnique({
    where: { bookingId },
    select: { id: true, internalId: true },
  });
  if (existing) return { ...existing, alreadyExisted: true };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      serviceId: true,
      serviceName: true,
      patientId: true,
      patientName: true,
      date: true,
      patient: { select: { rfc: true, razonSocial: true } },
      slot: { select: { date: true } },
    },
  });

  const patientName = booking?.patientName ?? '';
  const serviceName = booking?.serviceName ?? null;
  const base = serviceName ? `${serviceName} - ${patientName}` : `Consulta - ${patientName}`;
  // T6: que se lea en Flujo de Dinero por qué esta cita cobra $0 (o sólo un extra).
  const concept = input.paquete
    ? `${base} (${amount > 0 ? 'paquete + extra' : 'cubierta por el paquete'} «${input.paquete.nombre}»)`
    : base;

  // transactionDate = appointment day (slot date, else freeform booking date, else today),
  // stored at T12:00:00 like every other ledger entry.
  const apptDate = booking?.slot?.date ?? booking?.date ?? null;
  const dateKey = apptDate
    ? apptDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const internalId = await generateLedgerInternalId(doctorId, 'ingreso');
  // `||` (not `??`) on purpose: an empty-string razonSocial falls through to patientName.
  const counterpartyRfc = booking?.patient?.rfc?.trim().toUpperCase().slice(0, 13) || null;
  const counterpartyName = booking?.patient?.razonSocial || patientName || null;

  try {
    const entry = await prisma.ledgerEntry.create({
      data: {
        doctorId,
        amount,
        concept: concept.slice(0, 500),
        entryType: 'ingreso',
        transactionDate: new Date(dateKey + 'T12:00:00'),
        internalId,
        formaDePago,
        area: AREA_INGRESOS_CONSULTA,
        subarea: serviceName || '',
        origin: 'cita',
        transactionType: 'N/A',
        amountPaid: amount,
        paymentStatus: 'PAID',
        bookingId,
        ...(booking?.serviceId ? { serviceId: booking.serviceId } : {}),
        ...(serviceName ? { serviceName } : {}),
        ...(booking?.patientId ? { patientId: booking.patientId } : {}),
        ...(input.paquete ? { tratamientoId: input.paquete.tratamientoId } : {}),
        ...(counterpartyRfc ? { counterpartyRfc } : {}),
        ...(counterpartyName ? { counterpartyName } : {}),
      },
      select: { id: true, internalId: true },
    });
    return { ...entry, alreadyExisted: false };
  } catch (error: any) {
    // Race: a payment webhook created the entry between our pre-check and this create.
    if (error?.code === 'P2002' && String(error?.meta?.target ?? '').includes('booking_id')) {
      const raced = await prisma.ledgerEntry.findUnique({
        where: { bookingId },
        select: { id: true, internalId: true },
      });
      if (raced) return { ...raced, alreadyExisted: true };
    }
    throw error;
  }
}

/**
 * TRATAMIENTOS T6 (DISEÑO §5) — un PAGO DEL PAQUETE de un tratamiento (adelanto, abono): un ingreso
 * normal de Flujo de Dinero (se factura, se concilia, entra a reportes y a la exportación), ligado
 * al TRATAMIENTO y al paciente, SIN cita. Mismos campos que el cobro de una cita, para que se vea
 * igual en Movimientos. El saldo del paquete se CALCULA de estos movimientos, nunca se guarda.
 */
export async function createTratamientoPagoEntry(input: {
  doctorId: string;
  tratamiento: { id: string; nombre: string; patientId: string };
  amount: number;
  formaDePago: string;
  /** 'YYYY-MM-DD' (hoy si no viene). */
  fecha?: string | null;
}): Promise<{ id: number; internalId: string }> {
  const { doctorId, tratamiento, amount } = input;
  const formaDePago = VALID_FORMAS_DE_PAGO.includes(input.formaDePago) ? input.formaDePago : 'efectivo';
  const patient = await prisma.patient.findFirst({
    where: { id: tratamiento.patientId, doctorId },
    select: { firstName: true, lastName: true, rfc: true, razonSocial: true },
  });
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : '';
  const dateKey = input.fecha && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha)
    ? input.fecha
    // HOY en México (no en UTC: de las 18:00 en adelante UTC ya es mañana).
    : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
  const internalId = await generateLedgerInternalId(doctorId, 'ingreso');
  const counterpartyRfc = patient?.rfc?.trim().toUpperCase().slice(0, 13) || null;
  const counterpartyName = patient?.razonSocial || patientName || null;

  return prisma.ledgerEntry.create({
    data: {
      doctorId,
      amount,
      concept: `Pago del paquete «${tratamiento.nombre}» - ${patientName}`.slice(0, 500),
      entryType: 'ingreso',
      transactionDate: new Date(dateKey + 'T12:00:00'),
      internalId,
      formaDePago,
      area: AREA_INGRESOS_CONSULTA,
      // Igual que los ingresos de citas: la subárea es del catálogo del doctor, no el nombre del tratamiento.
      subarea: '',
      origin: 'manual',
      transactionType: 'N/A',
      amountPaid: amount,
      paymentStatus: 'PAID',
      patientId: tratamiento.patientId,
      tratamientoId: tratamiento.id,
      ...(counterpartyRfc ? { counterpartyRfc } : {}),
      ...(counterpartyName ? { counterpartyName } : {}),
    },
    select: { id: true, internalId: true },
  });
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
  const found = await db.area.findFirst({
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
