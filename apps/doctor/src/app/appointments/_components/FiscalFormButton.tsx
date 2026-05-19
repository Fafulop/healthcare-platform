'use client';

import { useState } from 'react';
import { FileText, Loader2, Copy, Check, MessageCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { Booking } from '../_hooks/useBookings';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Props {
  booking: Booking;
}

type ButtonState = 'idle' | 'loading' | 'link-ready' | 'has-fiscal-data';

export function FiscalFormButton({ booking }: Props) {
  const [state, setState] = useState<ButtonState>('idle');
  const [formUrl, setFormUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Don't show if no patient linked
  if (!booking.patientId) return null;

  async function handleCreateFiscalForm() {
    setState('loading');
    setErrorMsg('');

    try {
      const res = await authFetch(`${API_URL}/api/appointments/fiscal-form-link`, {
        method: 'POST',
        body: JSON.stringify({ patientId: booking.patientId }),
      });
      const json = await res.json();

      if (json.success) {
        setFormUrl(json.data.url);
        setState('link-ready');
        toast.success(json.data.regenerated ? 'Enlace regenerado' : 'Enlace de facturación creado');
      } else {
        if (res.status === 409) {
          // Patient already has fiscal data
          setState('has-fiscal-data');
          toast.info(`El paciente ya tiene datos fiscales (RFC: ${json.existingRfc})`);
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
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const message = `Hola ${booking.patientName}, te envío este enlace para que registres tus datos de facturación: ${formUrl}`;
    const phone = booking.patientWhatsapp || booking.patientPhone;
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
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

  // Link ready — show copy + WhatsApp
  if (state === 'link-ready') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-1"
          title="Copiar enlace de facturación"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        {(booking.patientWhatsapp || booking.patientPhone) && (
          <button
            onClick={handleWhatsApp}
            className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 flex items-center gap-1"
            title="Enviar por WhatsApp"
          >
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </button>
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
