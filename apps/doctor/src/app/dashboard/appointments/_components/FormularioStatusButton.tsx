'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Eye } from 'lucide-react';
import type { Booking } from '../_hooks/useBookings';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import {
  BotonesDeEnvio, abrirWhatsAppTrasCrear, enviarEnlacePorCorreo, type ContactoEnvio,
} from '@/components/citas/enviar-enlace';
import { BotonCita, COLUMNA, FilaCita } from '@/components/citas/fila-cita';

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
 * Formulario pre-consulta de la cita — la fila «Formulario» (2026-10-12: Correo · WhatsApp · Ver/Copiar ·
 * «⋯»). N11: en un clic, con la plantilla pre-consulta del doctor (5 de 6 doctores tienen
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

  // 2026-10-12 — UNA fila: Correo · WhatsApp · Ver/Copiar · «⋯», el estado en palabras. Lo que no aplica,
  // gris en su lugar con el porqué.
  const recibido = booking.formLink?.status === 'SUBMITTED';
  const sinExpediente = !booking.patientId;
  // Crear uno: sólo una cita Agendada (el servidor rechaza las demás) que no haya pasado (nacería vencido).
  const noSePuedeCrear = booking.status !== 'CONFIRMED' ? 'Confírmala primero' : expired ? 'La cita ya pasó: el enlace nacería vencido' : null;
  // Las MISMAS reglas de antes, cuando el grupo se escondía (code review): todo en una cita Agendada; en
  // una Completada sólo «Ver» el que ya contestó; en las demás, nada (ni «⋯»: el servidor sólo acepta
  // formularios de citas Agendadas).
  const fueraDeEstado = booking.status === 'CONFIRMED' || (booking.status === 'COMPLETED' && recibido) ? null
    : booking.status === 'PENDING' ? 'Confírmala primero'
    : booking.status === 'CANCELLED' ? 'La cita está cancelada'
    : booking.status === 'NO_SHOW' ? 'El paciente no asistió'
    : 'La cita ya pasó';
  const noSePuede = fueraDeEstado ? fueraDeEstado
    : recibido ? 'Ya lo contestó'
    : sinExpediente ? 'Para mandar el formulario, primero crea o vincula el expediente del paciente'
    : urlPendiente ? (expired ? 'El enlace ya venció (la cita pasó)' : null)
    : noSePuedeCrear;
  const estado = recibido ? 'Recibido ✓'
    : sinExpediente ? 'Requiere expediente'
    : fueraDeEstado ? (booking.status === 'COMPLETED' ? 'La cita ya pasó' : 'No aplica')
    : urlPendiente ? (expired ? 'Enlace vencido' : 'Esperando respuesta')
    : noSePuedeCrear ? (booking.status === 'CONFIRMED' ? 'La cita ya pasó' : 'No aplica')
    : 'Sin enviar';
  // Quitarlo / cambiarle la plantilla: con un enlace pendiente en una cita Agendada (como antes).
  const hayMenu = !fueraDeEstado && !recibido && !sinExpediente && !!urlPendiente;

  return (
    <FilaCita
      nombre="Formulario" estado={estado}
      tono={recibido ? 'bien' : urlPendiente && !expired ? 'espera' : urlPendiente ? 'mal' : noSePuede ? 'apagado' : 'neutro'}
    >
      <BotonesDeEnvio contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp} motivo={noSePuede} />
      {recibido ? (
        <BotonCita etiqueta="Ver" icono={<Eye className="w-3 h-3" />} href={`/dashboard/medical-records/formularios/${booking.formLink!.id}`} misma ancho={COLUMNA.ver} motivo={fueraDeEstado} />
      ) : (
        <BotonCita
          etiqueta="Copiar" icono={<Copy className="w-3 h-3" />} ancho={COLUMNA.ver}
          onClick={() => { navigator.clipboard.writeText(urlPendiente); toast.success('Enlace copiado'); }}
          motivo={urlPendiente && !expired && !fueraDeEstado ? null : noSePuede ?? 'Todavía no hay enlace: se crea al mandarlo'}
        />
      )}
      {/* «⋯»: cambiar la plantilla (regenera el enlace: el que tenía el paciente deja de servir) o quitarlo. */}
      <div className={`relative ${COLUMNA.extra} shrink-0`} ref={containerRef}>
        <BotonCita
          etiqueta="⋯" ancho="w-full" onClick={() => setDropdownOpen((o) => !o)}
          motivo={hayMenu ? null : fueraDeEstado ?? (recibido ? 'Ya lo contestó: no se cambia ni se quita' : sinExpediente ? 'Requiere expediente' : 'Sin formulario que cambiar o quitar')} titulo="Más opciones del formulario"
        />
        {dropdownOpen && hayMenu && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-md min-w-[160px]">
            {!expired && (
              <button
                onClick={() => { setDropdownOpen(false); onCreateForm(); }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50"
              >
                Usar otra plantilla
              </button>
            )}
            <button
              onClick={() => { setDropdownOpen(false); setUrlNueva(''); onDeleteForm(); }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-600"
            >
              Quitar formulario
            </button>
          </div>
        )}
      </div>
    </FilaCita>
  );
}
