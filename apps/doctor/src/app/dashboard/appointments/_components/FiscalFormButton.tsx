'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { Booking } from '../_hooks/useBookings';
import {
  BotonesDeEnvio, abrirWhatsAppTrasCrear, enviarEnlacePorCorreo, type ContactoEnvio,
} from '@/components/citas/enviar-enlace';
import { BotonCita, COLUMNA, FilaCita, Hueco } from '@/components/citas/fila-cita';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
// Mismo origen y mismo fallback que usa PreAppointmentFormModal para armar su enlace.
const PUBLIC_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

/**
 * «Datos fiscales» de la cita (con «¿Necesita factura?» marcada). N13 (2026-10-12): como Confirmación —
 * la fila «Datos fiscales» con «Correo» / «WhatsApp» en un clic y «Copiar» (antes: «Facturación» →
 * enlace → «Copiar» / «WhatsApp»). Si ya hay un enlace pendiente, se REUSA (el servidor lo devuelve; pedir otro
 * invalidaría el que el paciente pueda tener) y se ofrece reenviarlo.
 */
export function FiscalFormButton({ booking, contacto, motivo }: {
  booking: Booking;
  contacto: ContactoEnvio;
  /** No aplica (sin permiso de Facturación, cita cancelada…): la fila gris con este porqué. */
  motivo?: string | null;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [soloRfc, setSoloRfc] = useState(false);

  // Los datos fiscales se DERIVAN del expediente que ya viaja en el payload (misma condición que usa
  // CompleteBookingModal para decidir si puede timbrar).
  const p = booking.patient;
  const hasFiscalData = !!(
    p?.requiereFactura && p?.rfc && p?.razonSocial && p?.regimenFiscal && p?.usoCfdi && p?.codigoPostalFiscal
  );

  // Enlace PENDIENTE que ya existe según el SERVIDOR (sobrevive al refrescar) o el recién creado.
  const enlacePendiente = p?.formLinks?.[0] ?? null;
  const urlEfectiva = formUrl || (enlacePendiente ? `${PUBLIC_URL}/formulario-fiscal/${enlacePendiente.token}` : '');

  /** El enlace: el que ya hay, o lo crea (el servidor devuelve el pendiente si existe). */
  async function conseguirUrl(): Promise<string | null> {
    if (urlEfectiva) return urlEfectiva;
    try {
      const res = await authFetch(`${API_URL}/api/appointments/fiscal-form-link`, {
        method: 'POST',
        body: JSON.stringify({ patientId: booking.patientId }),
      });
      const json = await res.json();
      if (json.success) { setFormUrl(json.data.url); return json.data.url as string; }
      if (res.status === 409) { setSoloRfc(true); return null; }
      toast.error(json.error || 'Error al crear el enlace');
      return null;
    } catch {
      toast.error('Error de conexión');
      return null;
    }
  }

  async function porCorreo() {
    setOcupado(true);
    if (await conseguirUrl()) await enviarEnlacePorCorreo(booking.id, 'fiscal');
    setOcupado(false);
  }

  async function porWhatsApp() {
    setOcupado(true);
    await abrirWhatsAppTrasCrear(
      contacto.wa, conseguirUrl,
      (url) => `Hola ${booking.patientName}, te envío este enlace para que registres tus datos de facturación: ${url}`,
    );
    setOcupado(false);
  }

  function copiar() {
    navigator.clipboard.writeText(urlEfectiva);
    setCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setCopied(false), 2000);
  }

  // 2026-10-12 — UNA fila: Correo · WhatsApp · Copiar, con el estado en palabras. Sin expediente, con los
  // datos ya completos o sin que aplique: gris en su lugar con el porqué.
  const esperando = !!urlEfectiva;
  // El 409 del servidor sólo mira RFC + requiereFactura (no los 6 campos): «ya los tenemos» sería afirmar de
  // más — se dice lo que se sabe y dónde revisarlo.
  const noSePuede = motivo
    ?? (!booking.patientId ? 'Para pedir los datos fiscales, primero crea o vincula el expediente del paciente'
      : hasFiscalData ? 'Ya contamos con sus datos fiscales: no hay nada que pedirle'
      : soloRfc ? 'El paciente ya tiene RFC registrado: revisa sus datos fiscales en su expediente'
      : null);
  const estado = motivo ? 'No aplica'
    : !booking.patientId ? 'Requiere expediente'
    : hasFiscalData ? 'Recibidos ✓'
    : soloRfc ? 'Ya tiene RFC: revisa su expediente'
    : esperando ? 'Esperando sus datos'
    : 'Sin pedir';
  return (
    <FilaCita nombre="Datos fiscales" estado={estado} tono={hasFiscalData ? 'bien' : esperando ? 'espera' : noSePuede ? 'apagado' : 'neutro'}>
      <BotonesDeEnvio contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp} motivo={noSePuede} />
      <BotonCita
        etiqueta={copied ? 'Copiado' : 'Copiar'} icono={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        onClick={copiar} ancho={COLUMNA.ver}
        motivo={noSePuede ?? (esperando ? null : 'Todavía no hay enlace: se crea al mandarlo')}
      />
      <Hueco ancho={COLUMNA.extra} />
    </FilaCita>
  );
}
