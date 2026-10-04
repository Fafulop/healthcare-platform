// Turning a payment link OFF — at the provider AND in our DB (H-010 / H-054, 2026-10-04).
//
// Before, a cita that ended (completed in cash, cancelled, no-show, deleted) kept its link alive:
// the patient could still pay it, and the payment landed on a cita that was already charged or no
// longer exists. The webhooks now record such a payment instead of dropping it (flagged
// «⚠️ Revisar…», practice-utils.ts), but the better outcome is that the link stops taking payments.
//
//   · Stripe: `paymentLinks.update({ active: false })` on the doctor's connected account.
//   · Mercado Pago: a preference can't be deleted, but it CAN be expired — `expires: true` +
//     `expiration_date_to` in the past; MP's checkout then answers «ya no se encuentra
//     disponible» (verified on a QA preference, 2026-10-04).
//
// What this does NOT stop: a payment already in motion — an OXXO voucher the patient generated
// before, a checkout already open. That money still arrives, and the webhook records it flagged.
//
// «Live» = isActive AND not PAID/CANCELLED: a Stripe link goes EXPIRED when ONE OXXO voucher
// expires (stripe webhook, async_payment_failed) but may still take payments, so it counts too.
// (Deactivating a link Stripe already closed is harmless.)
//
// Our row changes ONLY when the provider confirmed. Otherwise it stays as it is — that is the truth
// (the link may still take money): the cita keeps showing it, and «Desactivar» in «Pagos» can retry.

import { prisma } from '@healthcare/database';
import { stripe } from '@/lib/stripe';
import { decrypt, mpFetch } from '@/lib/mercadopago';

export type ProveedorLink = 'stripe' | 'mercadopago';

/**
 * 'ok' = the provider confirmed.
 * 'error' = transient failure (timeout, 5xx): retrying may work.
 * 'imposible' = we CAN'T switch it off from here — no credentials left, or the provider refuses
 *   for good (403 / unknown link): only the doctor, in their provider account.
 */
export type ResultadoProveedor = 'ok' | 'error' | 'imposible';

/** A provider call must not hang a doctor's click (or a patient's self-cancel). */
const TIMEOUT_MS = 8_000;

/** Status at which a link may still take money. */
export const STATUS_VIVOS = ['PENDING', 'EXPIRED'] as const;

/** Expire one MP preference on MP's side. */
export async function expirarPreferenciaMp(doctorId: string, mpPreferenceId: string): Promise<ResultadoProveedor> {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { mpAccessToken: true } });
    if (!doctor?.mpAccessToken) {
      console.warn(`[desactivar-link] doctor ${doctorId} has no MP token — preference ${mpPreferenceId} can't be expired`);
      return 'imposible';
    }
    const res = await mpFetch(`/checkout/preferences/${mpPreferenceId}`, {
      method: 'PUT',
      accessToken: decrypt(doctor.mpAccessToken),
      body: { expires: true, expiration_date_to: new Date(Date.now() - 60_000).toISOString() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[desactivar-link] MP expire ${mpPreferenceId} failed:`, res.status, await res.text().catch(() => ''));
      // 401 is NOT permanent: an expired MP token is refreshed by the token cron.
      return res.status === 403 || res.status === 404 ? 'imposible' : 'error';
    }
    return 'ok';
  } catch (err) {
    console.error(`[desactivar-link] MP expire ${mpPreferenceId} failed:`, err);
    return 'error';
  }
}

/** Deactivate one Stripe payment link on the doctor's connected account. */
export async function desactivarLinkStripe(doctorId: string, stripePaymentLinkId: string): Promise<ResultadoProveedor> {
  try {
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { stripeAccountId: true } });
    if (!doctor?.stripeAccountId) {
      console.warn(`[desactivar-link] doctor ${doctorId} has no Stripe account — link ${stripePaymentLinkId} can't be deactivated`);
      return 'imposible';
    }
    await stripe.paymentLinks.update(
      stripePaymentLinkId,
      { active: false },
      { stripeAccount: doctor.stripeAccountId, timeout: TIMEOUT_MS, maxNetworkRetries: 0 },
    );
    return 'ok';
  } catch (err) {
    console.error(`[desactivar-link] Stripe deactivate ${stripePaymentLinkId} failed:`, err);
    const code = (err as { statusCode?: unknown })?.statusCode;
    // 401 = OUR platform key, fixable; 403/404 = the connected account refuses / link unknown.
    return code === 403 || code === 404 ? 'imposible' : 'error';
  }
}

export interface LinksVivos {
  stripe: { id: string; stripePaymentLinkId: string } | null;
  mp: { id: string; mpPreferenceId: string } | null;
}

/** The cita's LIVE links. Read BEFORE deleting a cita: deleting it nulls their booking_id. */
export async function linksVivosDeCita(bookingId: string, doctorId: string): Promise<LinksVivos> {
  const where = { bookingId, doctorId, status: { in: [...STATUS_VIVOS] }, isActive: true };
  const [stripeLink, mp] = await Promise.all([
    prisma.paymentLink.findFirst({ where, select: { id: true, stripePaymentLinkId: true } }),
    prisma.mpPaymentPreference.findFirst({ where, select: { id: true, mpPreferenceId: true } }),
  ]);
  return { stripe: stripeLink, mp };
}

export interface ResultadoDesactivar {
  /** Off at the provider and CANCELLED in our DB. */
  desactivados: ProveedorLink[];
  /** NOT switched off, transient failure — the link may still take payments; «Pagos» can retry. */
  fallidos: ProveedorLink[];
  /** NOT switched off and we can't from here (no account connected / provider refuses): only from
   * the doctor's Stripe / Mercado Pago account. */
  imposibles: ProveedorLink[];
  /** We couldn't even READ whether the cita had a live link — not the same as «it had none». */
  errorLectura?: true;
}

/** Turn off the given links. Never throws: ending a cita must not depend on a payment provider. */
export async function desactivarLinks(doctorId: string, links: LinksVivos): Promise<ResultadoDesactivar> {
  const resultado: ResultadoDesactivar = { desactivados: [], fallidos: [], imposibles: [] };
  // Each provider on its own: one failing never hides the other.
  const uno = async (
    proveedor: ProveedorLink,
    llamar: () => Promise<ResultadoProveedor>,
    marcar: () => Promise<{ count: number }>,
  ) => {
    try {
      const r = await llamar();
      if (r === 'error') { resultado.fallidos.push(proveedor); return; }
      if (r === 'imposible') { resultado.imposibles.push(proveedor); return; }
      // Conditional on still being live: if the webhook marked it PAID meanwhile, that stays — and
      // it isn't reported as «desactivado».
      if ((await marcar()).count > 0) resultado.desactivados.push(proveedor);
    } catch (err) {
      // Off at the provider but our row didn't change: it still SHOWS live — report it, so the
      // doctor retries from «Pagos» (idempotent at the provider) and the row catches up.
      console.error(`[desactivar-link] doctor ${doctorId}: ${proveedor} off at the provider, row not updated:`, err);
      resultado.fallidos.push(proveedor);
    }
  };
  const vivos = { status: { in: [...STATUS_VIVOS] } };
  const { stripe: s, mp } = links;
  await Promise.all([
    s && uno(
      'stripe',
      () => desactivarLinkStripe(doctorId, s.stripePaymentLinkId),
      () => prisma.paymentLink.updateMany({ where: { id: s.id, ...vivos }, data: { status: 'CANCELLED', isActive: false } }),
    ),
    mp && uno(
      'mercadopago',
      () => expirarPreferenciaMp(doctorId, mp.mpPreferenceId),
      () => prisma.mpPaymentPreference.updateMany({ where: { id: mp.id, ...vivos }, data: { status: 'CANCELLED', isActive: false } }),
    ),
  ]);
  return resultado;
}

/** A cita's live links, turned off. Never throws (wraps the read too). */
export async function desactivarLinksDeCita(bookingId: string, doctorId: string): Promise<ResultadoDesactivar> {
  try {
    return await desactivarLinks(doctorId, await linksVivosDeCita(bookingId, doctorId));
  } catch (err) {
    console.error(`[desactivar-link] booking ${bookingId}: could not read its links (the cita changed anyway):`, err);
    return { desactivados: [], fallidos: [], imposibles: [], errorLectura: true };
  }
}

/** Anything the doctor should hear about (a link switched off, one that couldn't be, or a failed read). */
export const hayQueDecirlo = (r: ResultadoDesactivar) =>
  r.desactivados.length > 0 || r.fallidos.length > 0 || r.imposibles.length > 0 || !!r.errorLectura;
