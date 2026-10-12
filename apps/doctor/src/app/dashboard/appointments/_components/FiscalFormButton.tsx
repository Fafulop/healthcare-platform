'use client';

import { useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { Booking } from '../_hooks/useBookings';
import {
  BotonesDeEnvio, abrirWhatsAppTrasCrear, enviarEnlacePorCorreo, type ContactoEnvio,
} from '@/components/citas/enviar-enlace';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
// Mismo origen y mismo fallback que usa PreAppointmentFormModal para armar su enlace.
const PUBLIC_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

/**
 * «Datos fiscales» de la cita (con «¿Necesita factura?» marcada). N13 (2026-10-12): como Confirmación —
 * «Pedir datos fiscales por correo» / «por WhatsApp» en un clic (antes: «Facturación» → enlace →
 * «Copiar» / «WhatsApp»). Si ya hay un enlace pendiente, se REUSA (el servidor lo devuelve; pedir otro
 * invalidaría el que el paciente pueda tener) y se ofrece reenviarlo.
 */
export function FiscalFormButton({ booking, contacto }: { booking: Booking; contacto: ContactoEnvio }) {
  const [ocupado, setOcupado] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [soloRfc, setSoloRfc] = useState(false);

  // Sin expediente NO se puede pedir datos fiscales (el formulario escribe sobre el paciente). Se DICE,
  // igual que Cobro con su propio requisito.
  if (!booking.patientId) {
    return (
      <span
        className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-400 border border-gray-200 flex items-center gap-1"
        title="Para pedir los datos fiscales, primero crea o vincula el expediente del paciente"
      >
        <FileText className="w-3 h-3" /> Requiere expediente
      </span>
    );
  }

  // Los datos fiscales se DERIVAN del expediente que ya viaja en el payload (misma condición que usa
  // CompleteBookingModal para decidir si puede timbrar).
  const p = booking.patient;
  const hasFiscalData = !!(
    p?.requiereFactura && p?.rfc && p?.razonSocial && p?.regimenFiscal && p?.usoCfdi && p?.codigoPostalFiscal
  );
  if (hasFiscalData) return <YaTieneDatosFiscales />;
  // El 409 del servidor sólo mira RFC + requiereFactura (no los 6 campos): decir «ya contamos con sus
  // datos» sería afirmar de más. Se dice lo que se sabe y dónde revisarlo.
  if (soloRfc) {
    return (
      <span className="text-xs text-gray-600 flex items-center gap-1">
        <FileText className="w-3.5 h-3.5 shrink-0" /> El paciente ya tiene RFC registrado: revisa sus datos fiscales en su expediente.
      </span>
    );
  }

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

  const esperando = !!urlEfectiva;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {esperando && (
        <span className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
          <FileText className="w-3 h-3" /> Esperando datos
        </span>
      )}
      <BotonesDeEnvio
        contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp}
        correo={esperando ? 'Reenviar datos fiscales por correo' : 'Pedir datos fiscales por correo'}
        whatsapp={esperando ? 'Reenviar por WhatsApp' : 'Pedir datos fiscales por WhatsApp'}
      />
      {esperando && (
        <button
          onClick={copiar}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
          title="Copiar enlace de datos fiscales"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </div>
  );
}

/**
 * El paciente YA tiene datos fiscales completos: no hay nada que pedirle, así que no es un botón — es un
 * TEXTO que lo dice (decisión del usuario 2026-10-12: el chip «✓ Datos fiscales» parecía un botón que no
 * hacía nada).
 */
function YaTieneDatosFiscales() {
  return (
    <span className="text-xs text-green-700 flex items-center gap-1">
      <Check className="w-3.5 h-3.5 shrink-0" /> Ya contamos con sus datos fiscales para facturarle.
    </span>
  );
}
