import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/[id]/evidence
// Bank reconciliation evidence for one ledger entry, fetched lazily when the evidence modal opens
// (kept off the list query). Returns the direct 1:1 bank movement and/or the settlement's movement,
// each with its statement (bank / cuenta / periodo), plus — for origin webhook_pago — the online
// payment (Stripe / Mercado Pago) that created the entry.

const PAYMENT_SELECT = {
  description: true, amount: true, currency: true, status: true, paidAt: true,
} as const;

/** How far apart paidAt and the entry's creation may be for the orphan-link
 * heuristic (both are stamped by the same webhook call). Keyed on the entry's
 * immutable createdAt — transactionDate gets rewritten to noon by ledger edits. */
const ORPHAN_MATCH_WINDOW_MS = 15 * 60 * 1000;

interface OnlinePayment {
  proveedor: 'Stripe' | 'Mercado Pago';
  monto: number;
  moneda: string;
  descripcion: string | null;
  pagadoEl: string | null;
  metodo: string | null;
  referencia: string;
  /** Link status at read time — a refunded/cancelled link still IS the evidence
   * of what created the entry, so non-PAID rows are returned, not hidden. */
  estado: string;
  /** true when the entry has no bookingId and the payment was identified by
   * amount + timestamp proximity instead of a hard link. */
  matchHeuristico: boolean;
}

type PaymentRow = {
  description: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  paidAt: Date | null;
};

/** Resolve the Stripe/MP payment behind a webhook_pago entry. Hard link via
 * bookingId when present; otherwise a conservative amount+time heuristic that
 * only answers when exactly ONE payment matches. */
async function resolveOnlinePayment(
  doctorId: string,
  entry: {
    origin: string | null;
    bookingId: string | null;
    amount: Prisma.Decimal;
    createdAt: Date;
  },
): Promise<OnlinePayment | null> {
  if (entry.origin !== 'webhook_pago') return null;

  const toPayment = (
    row: PaymentRow,
    proveedor: 'Stripe' | 'Mercado Pago',
    referencia: string,
    metodo: string | null,
    matchHeuristico: boolean,
  ): OnlinePayment => ({
    proveedor,
    monto: Number(row.amount),
    moneda: row.currency,
    descripcion: row.description,
    pagadoEl: row.paidAt ? row.paidAt.toISOString() : null,
    metodo,
    referencia,
    estado: row.status,
    matchHeuristico,
  });

  if (entry.bookingId) {
    // doctorId in the where = defense-in-depth: the ledger POST accepts a
    // caller-supplied bookingId, so entry.bookingId is not guaranteed to be
    // the doctor's own booking — never resolve another tenant's link data.
    const [stripe, mp] = await Promise.all([
      prisma.paymentLink.findFirst({
        where: { bookingId: entry.bookingId, doctorId },
        select: { ...PAYMENT_SELECT, stripePaymentLinkId: true },
      }),
      prisma.mpPaymentPreference.findFirst({
        where: { bookingId: entry.bookingId, doctorId },
        select: { ...PAYMENT_SELECT, mpPaymentId: true, mpPreferenceId: true, paymentMethod: true },
      }),
    ]);
    // Prefer the PAID row (guard invariant: at most one PAID link per cita),
    // but a non-PAID survivor (refund/chargeback rewrote the status) is still
    // THE payment that created this entry — return it with its real status.
    const stripePayment = stripe
      ? toPayment(stripe, 'Stripe', stripe.stripePaymentLinkId, null, false)
      : null;
    const mpPayment = mp
      ? toPayment(mp, 'Mercado Pago', mp.mpPaymentId || mp.mpPreferenceId, mp.paymentMethod, false)
      : null;
    if (stripePayment?.estado === 'PAID') return stripePayment;
    if (mpPayment?.estado === 'PAID') return mpPayment;
    return stripePayment ?? mpPayment;
  }

  // Orphan entry (link suelto): paidAt and the entry's createdAt are stamped by
  // the same webhook call, so match by amount + proximity — but only if
  // unambiguous, and only among links that are THEMSELVES orphans (a linked
  // link's payment created a DIFFERENT entry, keyed to its booking).
  const from = new Date(entry.createdAt.getTime() - ORPHAN_MATCH_WINDOW_MS);
  const to = new Date(entry.createdAt.getTime() + ORPHAN_MATCH_WINDOW_MS);
  const orphanWhere = {
    doctorId,
    bookingId: null,
    status: 'PAID' as const,
    amount: entry.amount,
    paidAt: { gte: from, lte: to },
  };
  const [stripeMatches, mpMatches] = await Promise.all([
    prisma.paymentLink.findMany({
      where: orphanWhere,
      select: { ...PAYMENT_SELECT, stripePaymentLinkId: true },
      take: 2,
    }),
    prisma.mpPaymentPreference.findMany({
      where: orphanWhere,
      select: { ...PAYMENT_SELECT, mpPaymentId: true, mpPreferenceId: true, paymentMethod: true },
      take: 2,
    }),
  ]);
  const total = stripeMatches.length + mpMatches.length;
  if (total !== 1) return null; // none, or ambiguous — better silent than wrong
  if (stripeMatches.length === 1) {
    return toPayment(stripeMatches[0], 'Stripe', stripeMatches[0].stripePaymentLinkId, null, true);
  }
  const mp = mpMatches[0];
  return toPayment(mp, 'Mercado Pago', mp.mpPaymentId || mp.mpPreferenceId, mp.paymentMethod, true);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const movementSelect = {
      id: true, transactionDate: true, description: true, reference: true,
      amount: true, movementType: true,
      bankStatement: { select: { bankName: true, accountNumber: true, periodMonth: true, periodYear: true } },
    };

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, doctorId: doctor.id },
      select: {
        id: true,
        bankAccount: true,
        origin: true,
        bookingId: true,
        amount: true,
        createdAt: true,
        bankMovement: { select: movementSelect },
        settlementItem: { select: { id: true, bankMovement: { select: movementSelect } } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    const onlinePayment = await resolveOnlinePayment(doctor.id, entry);

    return NextResponse.json({
      data: {
        bankAccount: entry.bankAccount,
        bankMovement: entry.bankMovement,
        settlementItem: entry.settlementItem,
        onlinePayment,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching ledger evidence:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
