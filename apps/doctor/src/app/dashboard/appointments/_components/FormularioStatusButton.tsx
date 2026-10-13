'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle, ChevronDown, Clock, Copy } from 'lucide-react';
import type { Booking } from '../_hooks/useBookings';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import {
  BotonesDeEnvio, abrirWhatsAppTrasCrear, enviarEnlacePorCorreo, type ContactoEnvio,
} from '@/components/citas/enviar-enlace';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const PUBLIC_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

interface Props {
  booking: Booking;
  contacto: ContactoEnvio;
  /** La ventana de siempre (elegir plantilla): sólo cuando hay que ELEGIR (2+ plantillas) o rehacer uno vencido. */
  onCreateForm: () => void;
  onDeleteForm: () => void;
}

/** La MISMA regla que la página pública del formulario (y que enviar-enlace): vence cuando la fecha de la
 *  cita ya pasó. (Antes las de rango usaban «7 días desde que se creó»: el botón ofrecía reenviar un enlace
 *  que al paciente le decía «Este enlace ha expirado».) */
function isFormLinkExpired(booking: Booking): boolean {
  const dia = (booking.slot?.date ?? booking.date ?? '').split('T')[0];
  if (!dia) return false;
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).split(' ')[0];
  return dia < today;
}

/**
 * Formulario pre-consulta de la cita. N11 (2026-10-12): como «Confirmación cita» — «Formulario por
 * correo» / «por WhatsApp» en un clic, con la plantilla pre-consulta del doctor (5 de 6 doctores tienen
 * exactamente una; con 2+ se abre la ventana para elegir; con ninguna se dice dónde crearla). Antes:
 * «Crear formulario» → ventana → plantilla → «Generar» → «Copiar» / «WhatsApp».
 */
export function FormularioStatusButton({ booking, contacto, onCreateForm, onDeleteForm }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // El recién creado aquí (los datos del servidor no lo traen hasta releer).
  const [urlNueva, setUrlNueva] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // SUBMITTED
  if (booking.formLink?.status === 'SUBMITTED') {
    return (
      <Link
        href={`/dashboard/medical-records/formularios/${booking.formLink.id}`}
        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 hover:bg-green-200"
      >
        <CheckCircle className="w-3 h-3" /> Formulario recibido
      </Link>
    );
  }

  // Sin expediente
  if (!booking.patientId) {
    return (
      <span
        title="Vincular expediente primero"
        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-400 border border-gray-200"
      >
        Formulario: requiere expediente
      </span>
    );
  }

  // El del SERVIDOR gana en cuanto llega: si el token se regeneró (otra plantilla), el local ya no sirve.
  const urlPendiente = booking.formLink ? `${PUBLIC_URL}/formulario-cita/${booking.formLink.token}` : urlNueva;
  const expired = isFormLinkExpired(booking);

  /** El enlace: el pendiente, o lo crea con la única plantilla pre-consulta. */
  async function conseguirUrl(): Promise<string | null> {
    if (urlPendiente) return urlPendiente;
    try {
      const t = await authFetch('/api/custom-templates?isPreAppointment=true').then((r) => r.json());
      const plantillas: { id: string }[] = t?.success ? t.data ?? [] : [];
      if (!t?.success) { toast.error('No se pudieron cargar tus plantillas'); return null; }
      if (plantillas.length === 0) {
        toast.error('No tienes una plantilla pre-consulta: créala en «Plantillas» (marcada como pre-consulta).');
        return null;
      }
      if (plantillas.length > 1) {
        // Hay que ELEGIR: la ventana de siempre (ahí se copia o se manda por WhatsApp).
        onCreateForm();
        return null;
      }
      const res = await authFetch(`${API_URL}/api/appointments/bookings/${booking.id}/form-link`, {
        method: 'POST',
        body: JSON.stringify({ templateId: plantillas[0].id }),
      });
      const d = await res.json();
      if (d.success) { setUrlNueva(d.data.url); return d.data.url as string; }
      toast.error(d.error || 'Error al crear el formulario');
      return null;
    } catch {
      toast.error('Error de conexión');
      return null;
    }
  }

  async function porCorreo() {
    setOcupado(true);
    if (await conseguirUrl()) await enviarEnlacePorCorreo(booking.id, 'formulario');
    setOcupado(false);
  }

  async function porWhatsApp() {
    setOcupado(true);
    await abrirWhatsAppTrasCrear(
      contacto.wa, conseguirUrl,
      (url) => `Hola ${booking.patientName}, antes de tu consulta por favor llena este formulario: ${url}`,
    );
    setOcupado(false);
  }

  // Sin formulario todavía. Sólo para una cita Agendada (el servidor rechaza las demás) y que no haya pasado
  // (el enlace nacería vencido: la página del paciente diría «Este enlace ha expirado»).
  if (!urlPendiente) {
    // Ya no se puede: su lugar en gris con el porqué, no un hueco (2026-10-12 — que nada desaparezca).
    if (booking.status !== 'CONFIRMED' || expired) {
      return (
        <span
          title={booking.status !== 'CONFIRMED' ? 'Confírmala primero' : 'La cita ya pasó: el enlace nacería vencido'}
          aria-disabled="true"
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-400 cursor-not-allowed select-none"
        >
          Formulario
        </span>
      );
    }
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <BotonesDeEnvio
          contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp}
          correo="Formulario por correo" whatsapp="Formulario por WhatsApp"
        />
      </div>
    );
  }

  // Pendiente (o vencido)
  return (
    <div className="flex items-center gap-1 flex-wrap" ref={containerRef}>
      <div className="relative">
        <div className="flex items-center">
          <span
            className={`text-xs px-2 py-1 rounded-l flex items-center gap-1 ${
              expired ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            {expired ? 'Enlace expirado' : 'Esperando respuesta'}
          </span>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`text-xs px-1 py-1 rounded-r border-l-0 ${
              expired
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
            aria-label="Más opciones del formulario"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-md min-w-[140px]">
            {!expired && (
              <button
                onClick={() => { setDropdownOpen(false); navigator.clipboard.writeText(urlPendiente); toast.success('Enlace copiado'); }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" /> Copiar enlace
              </button>
            )}
            {/* Cambiar la plantilla de uno ya mandado (la ventana de siempre). Regenera el enlace: el que tenía
                el paciente deja de servir. Vencido no: la fecha de la cita ya pasó, uno nuevo nacería vencido. */}
            {!expired && (
              <button
                onClick={() => { setDropdownOpen(false); onCreateForm(); }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 flex items-center gap-1.5"
              >
                Usar otra plantilla
              </button>
            )}
            <button
              onClick={() => { setDropdownOpen(false); setUrlNueva(''); onDeleteForm(); }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
            >
              Quitar formulario
            </button>
          </div>
        )}
      </div>
      {!expired && (
        <BotonesDeEnvio
          contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp}
          correo="Reenviar formulario por correo" whatsapp="Reenviar por WhatsApp"
        />
      )}
    </div>
  );
}
