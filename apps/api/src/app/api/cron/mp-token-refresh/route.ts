// POST /api/cron/mp-token-refresh
// Refreshes Mercado Pago access tokens expiring within 30 days.
// Called by Railway cron service daily.
// Protected by CRON_SECRET env var.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { encrypt, decrypt, mpFetch } from '@/lib/mercadopago';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'MP not configured' }, { status: 500 });
  }

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const doctorsToRefresh = await prisma.doctor.findMany({
    where: {
      mpConnected: true,
      mpRefreshToken: { not: null },
      mpTokenExpiresAt: { lte: thirtyDaysFromNow },
    },
    select: {
      id: true,
      mpRefreshToken: true,
      mpTokenExpiresAt: true,
      telegramChatId: true,
      doctorFullName: true,
    },
  });

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let refreshed = 0;
  let failed = 0;
  let warned = 0;

  for (const doctor of doctorsToRefresh) {
    try {
      const refreshToken = decrypt(doctor.mpRefreshToken!);
      const wasUrgent = doctor.mpTokenExpiresAt && doctor.mpTokenExpiresAt <= sevenDaysFromNow;

      const response = await mpFetch('/oauth/token', {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            mpAccessToken: encrypt(data.access_token),
            mpRefreshToken: encrypt(data.refresh_token),
            mpTokenExpiresAt: new Date(Date.now() + (data.expires_in || 15552000) * 1000),
          },
        });
        refreshed++;

        // Notify doctor if token was about to expire (within 7 days)
        if (wasUrgent && doctor.telegramChatId) {
          await sendTelegramMessage(
            doctor.telegramChatId,
            `🔄 Tu conexion con Mercado Pago ha sido renovada automaticamente.\n` +
            `No se requiere accion de tu parte.`
          ).catch(err => console.error('[MP Token Refresh] Telegram error:', err));
          warned++;
        }
      } else {
        // Token refresh failed — doctor likely revoked access
        console.error(`[MP Token Refresh] Failed for doctor ${doctor.id}:`, response.status);

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

        if (doctor.telegramChatId) {
          await sendTelegramMessage(
            doctor.telegramChatId,
            `⚠️ Tu cuenta de Mercado Pago se ha desconectado.\n` +
            `No pudimos renovar el acceso. Por favor, reconecta tu cuenta desde la seccion de Pagos.`
          ).catch(err => console.error('[MP Token Refresh] Telegram error:', err));
        }
        failed++;
      }
    } catch (error) {
      console.error(`[MP Token Refresh] Error for doctor ${doctor.id}:`, error);
      failed++;
    }
  }

  return NextResponse.json({
    total: doctorsToRefresh.length,
    refreshed,
    failed,
    warned,
  });
}
