// POST /api/mercadopago/webhook
// Handles Mercado Pago webhook notifications.
// Verifies signature, fetches payment details, updates preference status.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { decrypt, mpFetch, verifyWebhookSignature } from '@/lib/mercadopago';
import { sendTelegramMessage } from '@/lib/telegram';
import { createPaymentLedgerEntry } from '@/lib/practice-utils';

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
      select: { id: true, status: true, description: true, amount: true, doctorId: true, bookingId: true },
    });

    if (!preference) {
      console.log(`[MP Webhook] No preference found for external_reference: ${externalReference}`);
      return NextResponse.json({ received: true });
    }

    switch (payment.status) {
      case 'approved': {
        // Only update if still PENDING (idempotent)
        if (preference.status === 'PENDING') {
          await prisma.mpPaymentPreference.update({
            where: { id: preference.id },
            data: {
              status: 'PAID',
              mpPaymentId: paymentId,
              paymentMethod: payment.payment_method_id || payment.payment_type_id || null,
              paidAt: new Date(),
              isActive: false,
            },
          });

          // Notify doctor via Telegram
          if (doctor.telegramChatId) {
            const amount = payment.transaction_amount || preference.amount;
            const method = payment.payment_method_id || 'desconocido';
            await sendTelegramMessage(
              doctor.telegramChatId,
              `💰 Pago recibido via Mercado Pago\n` +
              `Monto: $${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n` +
              `Metodo: ${method}\n` +
              `${preference.description ? `Descripcion: ${preference.description}` : ''}`
            ).catch(err => console.error('[MP Webhook] Telegram error:', err));
          }

          // Create LedgerEntry for the payment
          const mpFormaDePago = mapMpPaymentMethod(payment.payment_method_id || payment.payment_type_id);
          await createPaymentLedgerEntry({
            doctorId: preference.doctorId,
            amount: Number(payment.transaction_amount || preference.amount),
            concept: preference.description || 'Pago recibido via Mercado Pago',
            bookingId: preference.bookingId,
            formaDePago: mpFormaDePago,
            paymentProvider: 'mercadopago',
          }).catch(err => console.error('[MP Webhook] Error creating LedgerEntry:', err));
        }
        break;
      }

      case 'refunded':
      case 'cancelled':
      case 'charged_back': {
        await prisma.mpPaymentPreference.updateMany({
          where: { id: preference.id },
          data: { status: 'CANCELLED', isActive: false },
        });

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
