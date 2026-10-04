// POST /api/mercadopago/webhook
// Handles Mercado Pago webhook notifications.
// Verifies signature, fetches payment details, updates preference status.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { decrypt, mpFetch, verifyWebhookSignature } from '@/lib/mercadopago';
import { sendTelegramMessage } from '@/lib/telegram';
import { createPaymentLedgerEntry, textoAvisoRevisionPago } from '@/lib/practice-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');

    // Verify webhook signature
    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('[MP Webhook] MP_WEBHOOK_SECRET not configured — skipping signature verification');
    }
    if (webhookSecret && xSignature && xRequestId && body.data?.id) {
      const valid = verifyWebhookSignature(
        xSignature,
        xRequestId,
        String(body.data.id),
        webhookSecret
      );
      if (!valid) {
        console.error('[MP Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Handle OAuth revocation — doctor disconnected from MP side
    if (body.type === 'mp-connect' && body.data?.id) {
      const mpUserId = String(body.data.id);
      const doctor = await prisma.doctor.findUnique({
        where: { mpUserId },
        select: { id: true, telegramChatId: true, doctorFullName: true },
      });

      if (doctor) {
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            mpUserId: null,
            mpAccessToken: null,
            mpRefreshToken: null,
            mpPublicKey: null,
            mpTokenExpiresAt: null,
            mpConnected: false,
          },
        });
        console.log(`[MP Webhook] OAuth revoked by doctor ${doctor.id} from MP side`);

        if (doctor.telegramChatId) {
          await sendTelegramMessage(
            doctor.telegramChatId,
            `⚠️ Tu cuenta de Mercado Pago se ha desconectado.\n` +
            `Si no reconoces esta accion, reconecta tu cuenta desde la seccion de Pagos.`
          ).catch(err => console.error('[MP Webhook] Telegram error:', err));
        }
      }

      return NextResponse.json({ received: true });
    }

    // Handle fraud/delivery stop alert
    if (body.topic === 'stop_delivery_op_wh') {
      console.error(`[MP Webhook] FRAUD ALERT — stop_delivery_op_wh received. Resource: ${body.resource || 'none'}, user_id: ${body.user_id || 'none'}`);

      if (body.user_id) {
        const doctor = await prisma.doctor.findUnique({
          where: { mpUserId: String(body.user_id) },
          select: { id: true, telegramChatId: true },
        });

        if (doctor?.telegramChatId) {
          await sendTelegramMessage(
            doctor.telegramChatId,
            `🚨 Alerta de fraude de Mercado Pago\n` +
            `Se ha detenido una operacion por sospecha de fraude.\n` +
            `Revisa tu cuenta de Mercado Pago para mas detalles.`
          ).catch(err => console.error('[MP Webhook] Telegram error:', err));
        }
      } else {
        console.warn('[MP Webhook] stop_delivery_op_wh received without user_id — cannot notify doctor');
      }

      return NextResponse.json({ received: true });
    }

    // Only handle payment notifications from here
    if (body.type !== 'payment') {
      console.log(`[MP Webhook] Unhandled type: ${body.type || body.topic || 'unknown'}`);
      return NextResponse.json({ received: true });
    }

    const paymentId = String(body.data.id);
    const sellerId = String(body.user_id);

    // Find doctor by MP user ID — select token separately to minimize exposure
    const doctor = await prisma.doctor.findUnique({
      where: { mpUserId: sellerId },
      select: {
        id: true,
        telegramChatId: true,
        doctorFullName: true,
      },
    });

    if (!doctor) {
      console.error(`[MP Webhook] Doctor not found for MP user_id: ${sellerId}`);
      return NextResponse.json({ received: true });
    }

    // Decrypt token in isolated scope
    const tokenRecord = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { mpAccessToken: true },
    });

    if (!tokenRecord?.mpAccessToken) {
      console.error(`[MP Webhook] No access token for doctor ${doctor.id}`);
      return NextResponse.json({ received: true });
    }

    // Fetch full payment details from MP
    const accessToken = decrypt(tokenRecord.mpAccessToken);
    const paymentResponse = await mpFetch(`/v1/payments/${paymentId}`, {
      accessToken,
    });

    if (!paymentResponse.ok) {
      console.error(`[MP Webhook] Failed to fetch payment ${paymentId}:`, paymentResponse.status);
      return NextResponse.json({ received: true });
    }

    const payment = await paymentResponse.json();
    const externalReference = payment.external_reference;

    if (!externalReference) {
      console.log(`[MP Webhook] Payment ${paymentId} has no external_reference, skipping`);
      return NextResponse.json({ received: true });
    }

    // Find our preference record
    const preference = await prisma.mpPaymentPreference.findFirst({
      where: { externalReference },
      select: { id: true, status: true, mpPaymentId: true, description: true, amount: true, doctorId: true, bookingId: true },
    });

    if (!preference) {
      console.log(`[MP Webhook] No preference found for external_reference: ${externalReference}`);
      return NextResponse.json({ received: true });
    }

    switch (payment.status) {
      case 'approved': {
        // Already processed by the code before 2026-10-04 (its ledger rows carry no provider id,
        // so the dedupe below can't see them). Harmless afterwards: the dedupe catches it too.
        if (preference.mpPaymentId === paymentId) break;

        const amount = Number(payment.transaction_amount || preference.amount);

        // Record the money FIRST — idempotent on the payment id, whatever the preference's state
        // (H-010 / H-054, 2026-10-04): an MP link can't be killed on MP's side, so a patient can
        // still pay one we marked CANCELLED, or pay a PAID one a second time. That is real money:
        // it reaches Flujo flagged «⚠️ Revisar…», never dropped. If recording fails, answer 500 so
        // MP retries (the rest of this route answers 200 on purpose; this one must not).
        let entry: Awaited<ReturnType<typeof createPaymentLedgerEntry>>;
        try {
          entry = await createPaymentLedgerEntry({
            doctorId: preference.doctorId,
            amount,
            concept: preference.description || 'Pago recibido via Mercado Pago',
            bookingId: preference.bookingId,
            formaDePago: mapMpPaymentMethod(payment.payment_method_id || payment.payment_type_id),
            paymentProvider: 'mercadopago',
            providerPaymentId: `mp:${paymentId}`,
            linkStatusPrevio: preference.status,
            fechaPago: payment.date_approved ? new Date(payment.date_approved) : null,
          });
        } catch (err) {
          console.error(`[MP Webhook] payment ${paymentId} ($${amount}) NOT recorded in Flujo — asking MP to retry:`, err);
          return NextResponse.json({ error: 'ledger write failed' }, { status: 500 });
        }

        // Then the link — also when `yaRegistrado`: a retry after this update failed must still
        // bring the link to PAID. mpPaymentId = the payment that made it PAID, set only by the
        // update that flips it (conditional, so two payments processed at once can't overwrite each
        // other); a second payment on an already-PAID link leaves it alone, so refunding the
        // duplicate (what the review alert suggests) doesn't cancel a link that is still paid.
        const fechaPago = payment.date_approved ? new Date(payment.date_approved) : new Date();
        try {
          const flipped = await prisma.mpPaymentPreference.updateMany({
            where: { id: preference.id, status: { not: 'PAID' } },
            data: {
              status: 'PAID',
              isActive: false,
              mpPaymentId: paymentId,
              paymentMethod: payment.payment_method_id || payment.payment_type_id || null,
              paidAt: fechaPago,
            },
          });
          if (flipped.count === 0) {
            await prisma.mpPaymentPreference.update({ where: { id: preference.id }, data: { isActive: false } });
          }
        } catch (err) {
          console.error(`[MP Webhook] payment ${paymentId} recorded but preference ${preference.id} not marked PAID — asking MP to retry:`, err);
          return NextResponse.json({ error: 'preference update failed' }, { status: 500 });
        }
        // A retry of a recorded payment notifies only if the first attempt died before marking the
        // link (so it never notified either); otherwise it was already told.
        if (entry.yaRegistrado && preference.status === 'PAID') break;

        if (doctor.telegramChatId) {
          const method = payment.payment_method_id || 'desconocido';
          await sendTelegramMessage(
            doctor.telegramChatId,
            `💰 Pago recibido via Mercado Pago\n` +
            `Monto: $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n` +
            `Metodo: ${method}\n` +
            `${preference.description ? `Descripcion: ${preference.description}` : ''}`
          ).catch(err => console.error('[MP Webhook] Telegram error:', err));
          if (entry.motivoRevision) {
            await sendTelegramMessage(
              doctor.telegramChatId,
              textoAvisoRevisionPago(entry.motivoRevision, amount, entry.internalId)
            ).catch(err => console.error('[MP Webhook] Telegram error:', err));
          }
        }
        break;
      }

      case 'refunded':
      case 'charged_back': {
        // Only the payment that paid this preference cancels it. A refund of some OTHER attempt
        // (e.g. a second payment on the same link) leaves a still-paid link alone.
        if (preference.mpPaymentId === paymentId) {
          await prisma.mpPaymentPreference.updateMany({
            where: { id: preference.id },
            data: { status: 'CANCELLED', isActive: false },
          });
        }

        if (payment.status === 'charged_back' && doctor.telegramChatId) {
          await sendTelegramMessage(
            doctor.telegramChatId,
            `⚠️ Contracargo en Mercado Pago\n` +
            `Monto: $${Number(payment.transaction_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n` +
            `${preference.description ? `Descripcion: ${preference.description}` : ''}\n` +
            `Revisa tu cuenta de Mercado Pago para mas detalles.`
          ).catch(err => console.error('[MP Webhook] Telegram error:', err));
        }
        break;
      }

      // `cancelled` = ONE payment attempt died (e.g. an OXXO ticket never paid), not the link:
      // the patient can still pay it another way. Marking the preference CANCELLED here made the
      // next legitimate payment look like «pago con un link desactivado».
      case 'cancelled':
      case 'rejected':
      case 'in_process':
      case 'pending': {
        // Patient can retry — don't change status
        break;
      }

      default:
        console.log(`[MP Webhook] Unhandled payment status: ${payment.status}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[MP Webhook] Error:', error);
    // Return 200 to prevent MP from retrying on our errors
    return NextResponse.json({ received: true });
  }
}

function mapMpPaymentMethod(method: string | null): string {
  if (!method) return 'transferencia';
  const map: Record<string, string> = {
    credit_card: 'tarjeta',
    debit_card: 'tarjeta',
    account_money: 'transferencia',
    ticket: 'efectivo',
    bank_transfer: 'transferencia',
    atm: 'efectivo',
    digital_currency: 'transferencia',
    digital_wallet: 'transferencia',
  };
  return map[method] || 'transferencia';
}
