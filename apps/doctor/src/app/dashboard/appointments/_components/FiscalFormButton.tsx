'use client';

import { useState } from 'react';
import { FileText, Loader2, Copy, Check, MessageCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { Booking } from '../_hooks/useBookings';
import { waNumber } from '@/lib/whatsapp';
import { telefonoWhatsApp } from '@/lib/booking-contact';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
// Mismo origen y mismo fallback que usa PreAppointmentFormModal para armar su enlace.
const PUBLIC_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

interface Props {
  booking: Booking;
}

type ButtonState = 'idle' | 'loading' | 'link-ready' | 'has-fiscal-data';

export function FiscalFormButton({ booking }: Props) {
  const [state, setState] = useState<ButtonState>('idle');
  const [formUrl, setFormUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sin expediente NO se puede pedir datos fiscales (el formulario escribe sobre el paciente).
  // Antes esto devolvía null y el grupo entero desaparecía en silencio: el doctor marcaba
  // "¿Necesita factura?" y no pasaba NADA visible. Ahora lo dice, igual que hace Cobro con su
  // propio requisito — misma etiqueta a propósito, es el mismo bloqueo.
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

  // Los datos fiscales se DERIVAN del expediente que ya viaja en el payload — no se
  // recuerdan en estado local. Antes el chip verde solo aparecía tras hacer clic y recibir
  // un 409, así que al refrescar volvía a decir "Facturación" aunque el paciente SÍ tuviera
  // datos. Misma condición que usa CompleteBookingModal para decidir si puede timbrar, y
  // que el 409 del servidor (rfc + requiereFactura, fiscal-form-link/route.ts).
  const p = booking.patient;
  const hasFiscalData = !!(
    p?.requiereFactura && p?.rfc && p?.razonSocial && p?.regimenFiscal && p?.usoCfdi && p?.codigoPostalFiscal
  );

  // Enlace PENDIENTE que ya existe según el SERVIDOR. Es lo que hace que el estado sobreviva
  // al refresh: antes vivía solo en `state`, así que al recargar el botón volvía a decir
  // "Facturación" como si nunca se hubiera mandado nada.
  const enlacePendiente = p?.formLinks?.[0] ?? null;
  const urlPendiente = enlacePendiente ? `${PUBLIC_URL}/formulario-fiscal/${enlacePendiente.token}` : '';
  // El recién creado gana sobre el del payload solo porque el payload aún no se ha refrescado;
  // los dos apuntan al MISMO token (el servidor ya no lo rota sin que se lo pidan).
  const urlEfectiva = formUrl || urlPendiente;
  const esperandoDatos = state === 'link-ready' || (state === 'idle' && !!enlacePendiente);
  if (hasFiscalData) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
        <Check className="w-3 h-3" /> Datos fiscales
      </span>
    );
  }

  async function handleCreateFiscalForm() {
    setState('loading');
    setErrorMsg('');

    try {
      const res = await authFetch(`${API_URL}/api/appointments/fiscal-form-link`, {
        method: 'POST',
        // Sin `regenerar`: si ya hay un enlace pendiente el servidor DEVUELVE ese mismo. Pedir
        // uno nuevo invalidaría el que el paciente ya tenga, y desde aquí no hay forma de
        // saber si ya se lo mandaron.
        body: JSON.stringify({ patientId: booking.patientId }),
      });
      const json = await res.json();

      if (json.success) {
        setFormUrl(json.data.url);
        setState('link-ready');
        toast.success(
          json.data.reutilizado
            ? 'Este paciente ya tenía un enlace pendiente — es el mismo, sigue sirviendo'
            : 'Enlace de datos fiscales creado'
        );
      } else {
        if (res.status === 409) {
          // Patient already has fiscal data
          setState('has-fiscal-data');
          toast.success(`El paciente ya tiene datos fiscales (RFC: ${json.existingRfc})`);
        } else {
          setErrorMsg(json.error || 'Error al crear enlace');
          setState('idle');
          toast.error(json.error || 'Error al crear enlace');
        }
      }
    } catch {
      setErrorMsg('Error de conexión');
      setState('idle');
      toast.error('Error de conexión');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(urlEfectiva);
    setCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const message = `Hola ${booking.patientName}, te envío este enlace para que registres tus datos de facturación: ${urlEfectiva}`;
    // waNumber en vez de un replace(/\D/g,'') suelto: sin lada de país el enlace wa.me
    // no abre nada, y en prod 46 citas guardan el teléfono a 10 dígitos.
    window.open(
      `https://wa.me/${waNumber(telefonoWhatsApp(booking))}?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  }

  // Patient already has fiscal data
  if (state === 'has-fiscal-data') {
    return (
      <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
        <Check className="w-3 h-3" /> Datos fiscales
      </span>
    );
  }

  // Enlace creado — chip de estado + compartir, igual que el link de pago activo. El chip no
  // estaba y se perdía el hilo: quedaban dos botones sueltos sin decir de qué eran.
  if (esperandoDatos) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
          <FileText className="w-3 h-3" /> Esperando datos
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
          title="Copiar enlace de datos fiscales"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        {/* El gate usa waNumber, no la verdad cruda del campo: con un número basura
            (hay registros de 5 a 8 dígitos) waNumber devuelve "" y el enlace quedaría
            como wa.me/ sin destinatario.
            Sin número NO se esconde el botón en silencio — se DICE qué falta y dónde se
            arregla, igual que hace el modal del formulario pre-consulta. Esconderlo dejaba al
            doctor buscando una opción que nunca iba a aparecer. */}
        {waNumber(telefonoWhatsApp(booking)) ? (
          <button
            onClick={handleWhatsApp}
            className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1"
            title="Enviar por WhatsApp"
          >
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </button>
        ) : (
          <span
            className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-400 border border-gray-200 flex items-center gap-1"
            title="Agrega un WhatsApp o un teléfono con lada en el expediente del paciente para poder enviárselo por ahí"
          >
            <MessageCircle className="w-3 h-3" /> Sin WhatsApp
          </span>
        )}
      </div>
    );
  }

  // Loading
  if (state === 'loading') {
    return (
      <button
        disabled
        className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-400 border border-teal-200 flex items-center gap-1 cursor-not-allowed"
      >
        <Loader2 className="w-3 h-3 animate-spin" /> Creando...
      </button>
    );
  }

  // Idle — show create button
  return (
    <button
      onClick={handleCreateFiscalForm}
      className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 flex items-center gap-1"
      title="Enviar formulario de datos fiscales al paciente"
    >
      <FileText className="w-3 h-3" /> Facturación
    </button>
  );
}
