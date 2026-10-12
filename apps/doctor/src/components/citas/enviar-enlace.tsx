'use client';

import type { ReactNode } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * N11/N13 (2026-10-12) — «Formulario», «Link de pago» y «Datos fiscales» se mandan como «Confirmación
 * cita»: UN botón por canal. Correo = lo manda el servidor desde el Gmail del doctor (él busca el enlace
 * vivo de la cita; aquí sólo se dice el tipo). WhatsApp = se abre con el mensaje listo.
 */
export type TipoEnlace = 'formulario' | 'pago' | 'fiscal';

/** Lo que la tarjeta ya sabe del contacto (mismo orden que Confirmación: el expediente manda). */
export interface ContactoEnvio {
  email: string;
  wa: string;
  /** «Necesita correo / WhatsApp» — el mismo aviso que pinta Confirmación. */
  falta: (que: string) => ReactNode;
}

export async function enviarEnlacePorCorreo(bookingId: string, tipo: TipoEnlace): Promise<boolean> {
  try {
    const res = await authFetch(`${API_URL}/api/appointments/bookings/${bookingId}/enviar-enlace/${tipo}`, { method: 'POST' });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      toast.success(data.message || 'Correo enviado');
      return true;
    }
    toast.error(data?.error || 'No se pudo enviar el correo');
    return false;
  } catch {
    toast.error('No se pudo enviar el correo');
    return false;
  }
}

/**
 * Abre WhatsApp con un enlace que quizá hay que CREAR primero. El navegador bloquea una ventana que se
 * abre DESPUÉS de esperar al servidor (ya no cuenta como respuesta al clic), así que se abre en blanco
 * en el mismo clic y luego se lleva a WhatsApp — o se cierra si no se pudo crear el enlace.
 */
export async function abrirWhatsAppTrasCrear(
  telefono: string,
  conseguirUrl: () => Promise<string | null>,
  mensaje: (url: string) => string,
): Promise<boolean> {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    // Abrirla DESPUÉS de esperar también lo bloquearía (ya no es respuesta al clic): se dice.
    toast.error('Tu navegador bloqueó la ventana de WhatsApp: permite ventanas emergentes para este sitio e inténtalo otra vez.');
    return false;
  }
  try {
    const url = await conseguirUrl();
    if (!url) { ventana.close(); return false; }
    ventana.opener = null;
    ventana.location.href = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje(url))}`;
    return true;
  } catch {
    ventana.close();
    return false;
  }
}

/** El par de botones, con el mismo aspecto que los de Confirmación. */
export function BotonesDeEnvio({
  contacto, correo, whatsapp, onCorreo, onWhatsApp, ocupado,
}: {
  contacto: ContactoEnvio;
  correo: string;
  whatsapp: string;
  onCorreo: () => void;
  onWhatsApp: () => void;
  ocupado: boolean;
}) {
  return (
    <>
      {!contacto.email ? contacto.falta('correo') : (
        <button
          onClick={onCorreo} disabled={ocupado}
          className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {ocupado ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} {correo}
        </button>
      )}
      {!contacto.wa ? contacto.falta('WhatsApp') : (
        <button
          onClick={onWhatsApp} disabled={ocupado}
          className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <MessageCircle className="w-3 h-3" /> {whatsapp}
        </button>
      )}
    </>
  );
}
