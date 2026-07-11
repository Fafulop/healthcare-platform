// Shared guard for creating a payment link TIED to a booking (Stripe and Mercado Pago routes).
// Invariant: one relevant link per booking across BOTH providers —
//   · a PAID link (either provider) means the cita is already collected: never issue another
//     link and never free the paid record's bookingId (it anchors the "Pagado" chip in the UI
//     and the webhook→ledger idempotency key).
//   · an ACTIVE link (either provider) blocks a new one.
//   · a stale link (inactive, not paid) merely holds the @unique bookingId slot; the caller
//     frees it IN THE SAME TRANSACTION as the new row's create (never before the external
//     provider call succeeds, so a failed create can't orphan the association).
// Note: `isActive` alone is NOT a paid-check — the MP webhook sets isActive:false when a
// preference is PAID, which is exactly why this guard tests status too.

import { prisma } from '@healthcare/database';

export type BookingLinkSlot =
  | { ok: true; staleStripeLinkId: string | null; staleMpPreferenceId: string | null }
  | { ok: false; error: string };

export async function checkBookingLinkSlot(
  doctorId: string,
  bookingId: string
): Promise<BookingLinkSlot> {
  const [booking, stripeLink, mpPreference] = await Promise.all([
    prisma.booking.findFirst({
      where: { id: bookingId, doctorId },
      select: { id: true },
    }),
    prisma.paymentLink.findUnique({
      where: { bookingId },
      select: { id: true, isActive: true, status: true },
    }),
    prisma.mpPaymentPreference.findUnique({
      where: { bookingId },
      select: { id: true, isActive: true, status: true },
    }),
  ]);

  if (!booking) {
    return { ok: false, error: 'Cita no encontrada' };
  }
  if (stripeLink?.status === 'PAID' || mpPreference?.status === 'PAID') {
    return { ok: false, error: 'Esta cita ya fue pagada con un link de pago' };
  }
  if (stripeLink?.isActive || mpPreference?.isActive) {
    return { ok: false, error: 'Ya existe un link de pago activo para esta cita' };
  }

  return {
    ok: true,
    staleStripeLinkId: stripeLink?.id ?? null,
    staleMpPreferenceId: mpPreference?.id ?? null,
  };
}
