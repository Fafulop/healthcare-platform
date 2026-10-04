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
  /**
   * The provider's id of THIS payment (`mp:<payment id>` · `stripe:<checkout session id>`). It is
   * the idempotency key: one ledger row per provider payment (unique column), whatever the link's
   * state — so a re-delivered notification never records twice, and a failed attempt can be
   * finished by the provider's retry.
   */
  providerPaymentId: string;
  /**
   * Status the link had when this payment arrived. Anything but PENDING means money arrived on a
   * link the doctor no longer expected to be paid (H-010 / H-054).
   */
  linkStatusPrevio: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
  /** When the patient paid (provider's timestamp). The entry is dated with it, not with the moment
   * the webhook got processed — a retry can arrive hours (Stripe: days) later. Default: now. */
  fechaPago?: Date | null;
}

/** Why a webhook payment needs the doctor's eyes. null = an ordinary payment. */
export type MotivoRevisionPago = 'cita_ya_cobrada' | 'link_desactivado' | 'link_ya_pagado';

const PREFIJO_REVISION: Record<MotivoRevisionPago, string> = {
  cita_ya_cobrada: '⚠️ Revisar posible doble cobro (la cita ya tenía su ingreso) — ',
  link_desactivado: '⚠️ Revisar: pago con un link desactivado — ',
  link_ya_pagado: '⚠️ Revisar posible doble cobro (segundo pago del mismo link) — ',
};

/** A P2002 on the given ledger_entries column (Prisma puts the column/index name in meta.target). */
const esChoqueUnico = (err: unknown, columna: 'booking_id' | 'provider_payment_id' | 'internal_id') => {
  if (typeof err !== 'object' || err === null) return false;
  const { code, meta } = err as { code?: unknown; meta?: { target?: unknown } };
  // Same test as createCitaLedgerEntry and POST /ledger.
  return code === 'P2002' && String(meta?.target ?? '').includes(columna);
};

/** The calendar day of an instant in Mexico, 'YYYY-MM-DD'. `toISOString()` would give the UTC day
 * and book anything after 18:00 Mexico time on the NEXT day. */
const diaEnMexico = (instante: Date) =>
  instante.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }); // sv-SE = YYYY-MM-DD, as elsewhere in apps/api

export type PaymentLedgerResult =
  | { yaRegistrado: true; internalId: string; motivoRevision: MotivoRevisionPago | null }
  | { yaRegistrado: false; id: number; internalId: string; motivoRevision: MotivoRevisionPago | null };

/**
 * Creates the LedgerEntry of a payment webhook (Stripe or MercadoPago).
 *
 * A payment that reaches us is MONEY THE PATIENT ALREADY PAID: it is always recorded, never
 * skipped (H-010). Before 2026-10-04 a cita that already had its income (completed in cash, then
 * the patient paid the old link) returned null here and the payment vanished from Flujo. Now:
 *   · the cita has no income yet → the entry anchors the cita (`bookingId`), as always;
 *   · the cita already has its income → written WITHOUT `bookingId` (@unique: one income per
 *     cita) but with the patient and service, and a «⚠️ Revisar posible doble cobro…» concept;
 *   · the link was deactivated / already paid → a «⚠️ Revisar…» concept too.
 * Idempotent on `providerPaymentId` (unique column): `{ yaRegistrado: true, … }` when that payment is
 * already in Flujo. Throws on any other failure — the webhook must answer non-2xx so the provider
 * retries; swallowing it would lose the payment for good.
 */
/** The entry already recorded for this provider payment, with the review reason read back from its
 * concept — so a retry (whose first attempt died before notifying) can still send the alert. */
async function yaRegistrado(providerPaymentId: string): Promise<PaymentLedgerResult | null> {
  const e = await prisma.ledgerEntry.findUnique({
    where: { providerPaymentId },
    select: { internalId: true, concept: true },
  });
  if (!e) return null;
  const motivo = (Object.keys(PREFIJO_REVISION) as MotivoRevisionPago[])
    .find((m) => e.concept.startsWith(PREFIJO_REVISION[m])) ?? null;
  return { yaRegistrado: true, internalId: e.internalId, motivoRevision: motivo };
}

export async function createPaymentLedgerEntry(input: PaymentLedgerInput): Promise<PaymentLedgerResult> {
  const { doctorId, amount, concept, bookingId, formaDePago, paymentProvider, providerPaymentId, linkStatusPrevio } = input;
  // T12:00 like every other entry (@db.Date).
  const transactionDate = new Date(diaEnMexico(input.fechaPago ?? new Date()) + 'T12:00:00');

  const previo = await yaRegistrado(providerPaymentId);
  if (previo) return previo;

  // Anchor the cita only if it has no income yet. «Already charged» wins over the link's state:
  // it is the case where the patient may need a refund.
  let anclarCita = !!bookingId;
  let motivoRevision: MotivoRevisionPago | null =
    linkStatusPrevio === 'PAID' ? 'link_ya_pagado'
    : linkStatusPrevio === 'CANCELLED' || linkStatusPrevio === 'EXPIRED' ? 'link_desactivado'
    : null;
  if (bookingId) {
    const existing = await prisma.ledgerEntry.findUnique({ where: { bookingId }, select: { id: true } });
    if (existing) {
      anclarCita = false;
      motivoRevision = 'cita_ya_cobrada';
    }
  }

  // Resolve service + patient identity from linked booking if available — also when the entry
  // does NOT anchor the cita, so the duplicate still shows up in the patient's history.
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

  const crear = async (conCita: boolean, motivo: MotivoRevisionPago | null) =>
    prisma.ledgerEntry.create({
      data: {
        doctorId,
        amount,
        concept: ((motivo ? PREFIJO_REVISION[motivo] : '') + concept).substring(0, 500),
        entryType: 'ingreso',
        transactionDate,
        internalId: await generateLedgerInternalId(doctorId, 'ingreso'),
        formaDePago,
        area: defaultArea.area,
        subarea: serviceName || defaultArea.subarea,
        origin: 'webhook_pago',
        transactionType: 'N/A',
        amountPaid: amount,
        paymentStatus: 'PAID',
        hasComprobante: true,
        providerPaymentId,
        ...(conCita && bookingId ? { bookingId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(serviceName ? { serviceName } : {}),
        ...(patientId ? { patientId } : {}),
        ...(counterpartyRfc ? { counterpartyRfc } : {}),
        ...(counterpartyName ? { counterpartyName } : {}),
      },
      select: { id: true, internalId: true },
    });

  // generateLedgerInternalId isn't atomic: a manual ingreso or a completed cita can take the same
  // ING-YYYY-NNN at the same moment. One retry with a fresh number (a 500 would also recover, via
  // the provider's retry, but slower).
  const crearConFolio = async (conCita: boolean, motivo: MotivoRevisionPago | null) => {
    try {
      return await crear(conCita, motivo);
    } catch (err) {
      if (!esChoqueUnico(err, 'internal_id')) throw err;
      return crear(conCita, motivo);
    }
  };

  let entry: { id: number; internalId: string };
  try {
    entry = await crearConFolio(anclarCita, motivoRevision);
  } catch (err) {
    // A concurrent delivery of the SAME payment won the race: it is recorded.
    if (esChoqueUnico(err, 'provider_payment_id')) return (await yaRegistrado(providerPaymentId))!;
    // The cita got its income between the check and the create (the doctor completed it, or the
    // other provider's link was paid at the same moment): record it unanchored, flagged.
    if (!anclarCita || !esChoqueUnico(err, 'booking_id')) throw err;
    anclarCita = false;
    motivoRevision = 'cita_ya_cobrada';
    try {
      entry = await crearConFolio(false, motivoRevision);
    } catch (err2) {
      if (esChoqueUnico(err2, 'provider_payment_id')) return (await yaRegistrado(providerPaymentId))!;
      throw err2;
    }
  }

  console.log(
    `[${paymentProvider}] LedgerEntry ${entry.internalId} created for payment ${providerPaymentId} of $${amount}` +
    `${bookingId ? ` (booking ${bookingId}${anclarCita ? '' : ', NOT anchored'})` : ''}` +
    `${motivoRevision ? ` — REVISAR: ${motivoRevision}` : ''}`
  );
  return { yaRegistrado: false, ...entry, motivoRevision };
}

const TEXTO_REVISION: Record<MotivoRevisionPago, string> = {
  cita_ya_cobrada: 'La cita ya tenía su cobro registrado, así que puede ser un DOBLE COBRO.',
  link_desactivado: 'El link estaba desactivado (la cita se canceló, se completó o lo desactivaste).',
  link_ya_pagado: 'Ese link YA se había pagado antes: es un SEGUNDO pago del mismo link.',
};

/** Telegram text for a payment that needs review (sent in addition to «Pago recibido»). */
export function textoAvisoRevisionPago(motivo: MotivoRevisionPago, amount: number, internalId: string): string {
  return (
    `⚠️ <b>Revisa este pago</b>\n\n` +
    `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n` +
    `${TEXTO_REVISION[motivo]}\n` +
    `Quedó registrado en Flujo de Dinero (${internalId}). Si el paciente pagó de más, devuélvele el dinero desde tu cuenta del proveedor.`
  );
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

  // Idempotency pre-check (mirrors the POST route). NOT symmetric with createPaymentLedgerEntry,
  // which records a link payment even when the cita already has its income (H-010): here, if a
  // paid link already anchored the cita, completing records nothing more — the «Completar cita»
  // dialog shows «Pago ya registrado» in that case, so the doctor doesn't charge again.
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
  const concept = serviceName ? `${serviceName} - ${patientName}` : `Consulta - ${patientName}`;

  // transactionDate = appointment day (slot date, else freeform booking date, else today),
  // stored at T12:00:00 like every other ledger entry.
  const apptDate = booking?.slot?.date ?? booking?.date ?? null;
  // (`apptDate` is @db.Date → its UTC day IS the calendar day; "today" must be Mexico's.)
  const dateKey = apptDate
    ? apptDate.toISOString().split('T')[0]
    : diaEnMexico(new Date());

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
        ...(counterpartyRfc ? { counterpartyRfc } : {}),
        ...(counterpartyName ? { counterpartyName } : {}),
      },
      select: { id: true, internalId: true },
    });
    return { ...entry, alreadyExisted: false };
  } catch (error: any) {
    // Race: a payment webhook created the entry between our pre-check and this create.
    if (esChoqueUnico(error, 'booking_id')) {
      const raced = await prisma.ledgerEntry.findUnique({
        where: { bookingId },
        select: { id: true, internalId: true },
      });
      if (raced) return { ...raced, alreadyExisted: true };
    }
    throw error;
  }
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

// ─── Sales ↔ patients (VENTAS PACIENTE paso 3) ──────────────────────────────

/**
 * What a sale carries about its patient (sales.patient_id is a plain link, no Prisma relation).
 * Name + internal id ONLY: these routes are behind the `ventas` toggle, and a helper with Ventas but
 * without Expedientes must not read the patient's contact or fiscal data through them.
 */
export const SALE_PATIENT_SELECT = {
  id: true, firstName: true, lastName: true, internalId: true,
} as const;
export type SalePatient = { id: string; firstName: string; lastName: string; internalId: string };

/** The ONE way a sale names its patient (ledger concept + counterpartyName), capped to the column. */
export function salePatientName(p: Pick<SalePatient, 'firstName' | 'lastName'>): string {
  return `${p.firstName} ${p.lastName}`.trim().slice(0, 300);
}

/**
 * Attach `patient` to each sale with ONE query for the whole page. `sales.patient_id` lives in
 * practice_management and `patients` in medical_records, with no FK on purpose, so Prisma cannot
 * `include` it. A patient that no longer exists (or belongs to another doctor) comes back as null.
 */
export async function withSalePatients<T extends { patientId: string | null }>(
  doctorId: string,
  sales: T[],
): Promise<(T & { patient: SalePatient | null })[]> {
  const ids = [...new Set(sales.map((s) => s.patientId).filter((x): x is string => !!x))];
  const patients = ids.length
    ? await prisma.patient.findMany({ where: { id: { in: ids }, doctorId }, select: SALE_PATIENT_SELECT })
    : [];
  const byId = new Map(patients.map((p) => [p.id, p]));
  return sales.map((s) => ({ ...s, patient: s.patientId ? byId.get(s.patientId) ?? null : null }));
}

/**
 * Validate the buyer of a NEW/edited sale: the patient must be the doctor's, and the visita (if any)
 * must be the doctor's AND that patient's. Returns the patient, or an error message for a 4xx.
 */
export async function resolveSalePatient(
  doctorId: string,
  patientId: unknown,
  visitaId: unknown,
): Promise<{ patient: SalePatient; visitaId: string | null } | { error: string; status: number }> {
  if (typeof patientId !== 'string' || !patientId) return { error: 'El paciente es requerido', status: 400 };
  const patient = await prisma.patient.findFirst({ where: { id: patientId, doctorId }, select: SALE_PATIENT_SELECT });
  if (!patient) return { error: 'Paciente no encontrado', status: 404 };
  if (visitaId === undefined || visitaId === null || visitaId === '') return { patient, visitaId: null };
  if (typeof visitaId !== 'string') return { error: 'Visita inválida', status: 400 };
  const visita = await prisma.visita.findFirst({ where: { id: visitaId, doctorId, patientId }, select: { id: true } });
  if (!visita) return { error: 'La visita no es de este paciente', status: 404 };
  return { patient, visitaId: visita.id };
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
