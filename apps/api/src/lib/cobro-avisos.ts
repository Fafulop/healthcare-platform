/**
 * Avisos del COBRO al equipo, por Telegram (TIERS C3).
 *
 * Decisión del usuario (2026-09-14): pago fallido, cancelación, precio fuera
 * del mapa y cualquier cosa que necesite a un humano van a un chat de admin
 * (TELEGRAM_ADMIN_CHAT_ID). El bot ya existe en el api; hasta hoy sólo le
 * escribía a los chats de cada doctor.
 *
 * Nunca lanza: un aviso que no sale no puede tumbar el webhook, porque entonces
 * Stripe reintentaría un evento que YA se procesó bien. Siempre deja rastro en
 * los logs, llegue o no el mensaje.
 */

import { sendTelegramMessage } from '@/lib/telegram';
import { modoCobro } from '@/lib/stripe-cobro';

/** Telegram va con parse_mode HTML: un `<` o `&` suelto rompe el mensaje entero. */
function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function avisarAdmin(texto: string): Promise<void> {
  const prefijo = modoCobro() === 'test' ? '[PRUEBA] ' : '';
  console.log('[COBRO]', prefijo + texto);

  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chat) {
    console.warn('[COBRO] TELEGRAM_ADMIN_CHAT_ID no está configurado: el aviso sólo quedó en logs.');
    return;
  }
  try {
    await sendTelegramMessage(chat, escaparHtml(prefijo + texto));
  } catch (e) {
    console.error('[COBRO] no se pudo mandar el aviso por Telegram', e);
  }
}
