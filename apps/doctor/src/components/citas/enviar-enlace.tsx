'use client';

import { MessageCircle, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { BotonCita, COLUMNA } from './fila-cita';

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
  /** El expediente del paciente: sin correo / WhatsApp, su botón gris lleva ahí a capturarlo (como el
   *  «Necesita correo» de antes). */
  expediente?: string | null;
}

/** Por qué no se puede mandar por ese canal (sin dato de contacto): el `title` de su botón gris. Sin
 *  expediente vinculado no hay dónde capturarlo: se dice que primero se vincule (como antes). */
export const faltaCorreo = (expediente?: string | null) => expediente
  ? 'Falta el correo del paciente: agrégalo en su expediente'
  : 'Falta el correo del paciente: vincula o crea su expediente para capturarlo';
export const faltaWhatsapp = (expediente?: string | null) => expediente
  ? 'Falta el WhatsApp o teléfono del paciente: agrégalo en su expediente'
  : 'Falta el WhatsApp o teléfono del paciente: vincula o crea su expediente para capturarlo';

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

/**
 * Las columnas «Correo» y «WhatsApp» de una fila de la tarjeta (2026-10-12: los mismos dos botones en
 * todas las filas). `motivo` = no aplica en este estado (gris con el porqué); sin el dato de contacto,
 * su canal va gris con lo que falta.
 */
export function BotonesDeEnvio({
  contacto, onCorreo, onWhatsApp, ocupado, motivo,
}: {
  contacto: ContactoEnvio;
  onCorreo: () => void;
  onWhatsApp: () => void;
  ocupado: boolean;
  motivo?: string | null;
}) {
  return (
    <>
      {/* `ocupado` en LOS DOS: un segundo clic mientras se crea el enlace crearía otro (code review). */}
      <BotonCita
        etiqueta="Correo" icono={<Send className="w-3 h-3" />} onClick={onCorreo} ocupado={ocupado}
        motivo={motivo || (!contacto.email ? faltaCorreo(contacto.expediente) : null)} ancho={COLUMNA.correo}
        irA={!motivo && !contacto.email ? contacto.expediente : null}
      />
      <BotonCita
        etiqueta="WhatsApp" icono={<MessageCircle className="w-3 h-3" />} onClick={onWhatsApp} ocupado={ocupado}
        motivo={motivo || (!contacto.wa ? faltaWhatsapp(contacto.expediente) : null)} ancho={COLUMNA.whatsapp}
        irA={!motivo && !contacto.wa ? contacto.expediente : null}
      />
    </>
  );
}
