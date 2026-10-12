'use client';

// Link de pago LIGADO a una cita (tarjeta de la cita: agenda, visita, «Cobros»). Estados:
//   · link pagado   → chip verde "Pagado"
//   · link activo   → chip "Link enviado" + Reenviar por correo / WhatsApp + Copiar
//   · sin link      → «Link de pago por correo» / «por WhatsApp»: UN clic crea el link y lo manda
//
// N11 (2026-10-12, decisión del usuario): funciona como «Confirmación cita». Antes era una ventana
// (proveedor + monto) → crear → copiar / compartir. Ahora, sin preguntar:
//   · monto = el PRECIO de la cita (si hace falta otro, se cambia el precio, que está al lado);
//   · proveedor = el conectado; con los dos, Mercado Pago (acepta OXXO y SPEI — decisión del usuario).

import { useState } from 'react';
import { Link2, Copy, Check, CreditCard } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import {
  BotonesDeEnvio, abrirWhatsAppTrasCrear, enviarEnlacePorCorreo, type ContactoEnvio,
} from '@/components/citas/enviar-enlace';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
// Los límites que ya pedía la ventana (y el proveedor).
const MONTO_MIN = 10;
const MONTO_MAX = 100000;

export interface BookingPaymentLinkInfo {
  status: string; // PENDING | PAID | ...
  isActive: boolean;
  url: string;
  paidAt?: string | null;
  amount?: string | number | null;
}

interface Props {
  bookingId: string;
  /** Linked expediente id — creating a link REQUIRES one (server enforces it too) */
  patientId?: string | null;
  patientName: string;
  patientEmail?: string | null;
  contacto: ContactoEnvio;
  defaultAmount?: number | string | null;
  defaultDescription?: string | null;
  stripeLink?: BookingPaymentLinkInfo | null;
  mpLink?: BookingPaymentLinkInfo | null;
  onCreated?: () => void;
}

type Provider = 'stripe' | 'mercadopago';

/**
 * El proveedor por omisión: Mercado Pago si está conectado, si no Stripe; 'ninguno' = ninguno conectado.
 * Si NO se pudo revisar alguno → 'no-se-sabe': decir «no tienes» sería afirmar algo falso, y caer a
 * Stripe porque falló Mercado Pago rompería la regla del usuario (MP si está).
 */
async function proveedorConectado(): Promise<Provider | 'ninguno' | 'no-se-sabe'> {
  const leer = (u: string) => authFetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [s, m] = await Promise.all([
    leer(`${API_URL}/api/stripe/connect/status`),
    leer(`${API_URL}/api/mercadopago/connect/status`),
  ]);
  // Mismos campos que leía la ventana de antes (nivel raíz, no `data`). Decide la lectura que CONTESTA:
  // con Mercado Pago conectado no importa si Stripe falló; sin saber de Mercado Pago no se cae a Stripe.
  if (m?.connected === true) return 'mercadopago';
  if (!m) return 'no-se-sabe';
  if (s?.chargesEnabled === true) return 'stripe';
  if (!s) return 'no-se-sabe';
  return 'ninguno';
}

export function PaymentLinkButton({
  bookingId, patientId, patientName, patientEmail, contacto, defaultAmount, defaultDescription,
  stripeLink, mpLink, onCreated,
}: Props) {
  // Link creado aquí (los datos del servidor no lo traen hasta releer)
  const [freshLink, setFreshLink] = useState<{ url: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const paidLink =
    stripeLink?.status === 'PAID' ? stripeLink
    : mpLink?.status === 'PAID' ? mpLink
    : null;
  const activeLink =
    freshLink ? { url: freshLink.url, amount: freshLink.amount, status: 'PENDING', isActive: true }
    : stripeLink?.isActive && stripeLink.status !== 'PAID' ? stripeLink
    : mpLink?.isActive && mpLink.status !== 'PAID' ? mpLink
    : null;
  const monto = defaultAmount != null ? Number(defaultAmount) : 0;
  const montoValido = monto >= MONTO_MIN && monto <= MONTO_MAX;

  /** El link: el activo, o lo crea con el precio de la cita y el proveedor conectado. */
  async function conseguirUrl(): Promise<string | null> {
    if (activeLink) return activeLink.url;
    const provider = await proveedorConectado();
    if (provider === 'no-se-sabe') {
      toast.error('No se pudo revisar tu cuenta de Mercado Pago / Stripe. Intenta de nuevo.');
      return null;
    }
    if (provider === 'ninguno') {
      toast.error('No tienes Mercado Pago ni Stripe conectado: conéctalo en «Pagos» para crear links de pago.');
      return null;
    }
    try {
      const description = defaultDescription || `Consulta - ${patientName}`;
      const res = await authFetch(
        provider === 'stripe' ? `${API_URL}/api/stripe/payment-links` : `${API_URL}/api/mercadopago/preferences`,
        {
          method: 'POST',
          body: JSON.stringify(provider === 'stripe'
            ? { amount: monto, description, bookingId }
            : { amount: monto, description, bookingId, ...(patientEmail ? { patientEmail } : {}) }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        setFreshLink({ url: json.url, amount: monto });
        onCreated?.();
        return json.url as string;
      }
      toast.error(json.error || 'Error al crear el link de pago');
      return null;
    } catch {
      toast.error('Error de conexión');
      return null;
    }
  }

  async function porCorreo() {
    setOcupado(true);
    if (await conseguirUrl()) await enviarEnlacePorCorreo(bookingId, 'pago');
    setOcupado(false);
  }

  async function porWhatsApp() {
    setOcupado(true);
    const cuanto = activeLink?.amount != null ? Number(activeLink.amount) : monto;
    await abrirWhatsAppTrasCrear(
      contacto.wa, conseguirUrl,
      (url) => `Hola ${patientName}, te envío tu link de pago${cuanto ? ` por $${cuanto.toLocaleString('es-MX')} MXN` : ''}: ${url}`,
    );
    setOcupado(false);
  }

  function copiar() {
    if (!activeLink) return;
    navigator.clipboard.writeText(activeLink.url);
    setCopied(true);
    toast.success('Link de pago copiado');
    setTimeout(() => setCopied(false), 2000);
  }

  // Paid
  if (paidLink) {
    return (
      <span
        className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 flex items-center gap-1"
        title={paidLink.paidAt ? `Pagado el ${new Date(paidLink.paidAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Pagado'}
      >
        <Check className="w-3 h-3" /> Pagado
      </span>
    );
  }

  // Active pending link — reenviar
  if (activeLink) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
          {/* «activo», no «enviado»: existe aunque el correo haya fallado (eso lo dice el aviso). */}
          <Link2 className="w-3 h-3" /> Link activo
        </span>
        <BotonesDeEnvio
          contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp}
          correo="Reenviar link por correo" whatsapp="Reenviar por WhatsApp"
        />
        <button
          onClick={copiar}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
          title="Copiar link de pago"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    );
  }

  // No link yet — creating one requires a linked expediente (the income must be traceable
  // to a patient record; the server guard enforces the same rule)
  if (!patientId) {
    return (
      <span
        className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-400 border border-gray-200 flex items-center gap-1"
        title="Para generar un link de pago, primero crea o vincula el expediente del paciente (columna Paciente)"
      >
        <CreditCard className="w-3 h-3" /> Requiere expediente
      </span>
    );
  }
  // El monto es el precio de la cita: sin uno válido no hay link (se DICE qué hacer).
  if (!montoValido) {
    return (
      <span
        className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-500 border border-gray-200 flex items-center gap-1"
        title={`El link de pago se crea por el precio de la cita (entre $${MONTO_MIN} y $${MONTO_MAX.toLocaleString('es-MX')} MXN)`}
      >
        <CreditCard className="w-3 h-3" /> Ponle precio a la cita para mandar el link de pago
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <BotonesDeEnvio
        contacto={contacto} ocupado={ocupado} onCorreo={porCorreo} onWhatsApp={porWhatsApp}
        correo="Link de pago por correo" whatsapp="Link de pago por WhatsApp"
      />
    </div>
  );
}
