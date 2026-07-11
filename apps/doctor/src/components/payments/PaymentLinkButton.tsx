'use client';

// Botón de link de pago LIGADO a una cita — reusable en /appointments (celda de acciones)
// y en el expediente (sección "Citas e Ingresos"). Estados:
//   · link pagado   → chip verde "Pagado"
//   · link activo   → chip "Link enviado" + Copiar + WhatsApp
//   · sin link      → botón "Link de pago" → modal (proveedor + monto) → crea con bookingId

import { useState, useEffect, useCallback } from 'react';
import { Link2, Loader2, Copy, Check, MessageCircle, CreditCard, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface BookingPaymentLinkInfo {
  status: string; // PENDING | PAID | ...
  isActive: boolean;
  url: string;
  paidAt?: string | null;
  amount?: string | number | null;
}

interface Props {
  bookingId: string;
  patientName: string;
  patientPhone?: string | null;
  patientWhatsapp?: string | null;
  patientEmail?: string | null;
  defaultAmount?: number | null;
  defaultDescription?: string | null;
  stripeLink?: BookingPaymentLinkInfo | null;
  mpLink?: BookingPaymentLinkInfo | null;
  onCreated?: () => void;
}

type Provider = 'stripe' | 'mercadopago';

export function PaymentLinkButton({
  bookingId,
  patientName,
  patientPhone,
  patientWhatsapp,
  patientEmail,
  defaultAmount,
  defaultDescription,
  stripeLink,
  mpLink,
  onCreated,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  // Link created in this session (server data won't have it until refetch)
  const [freshLink, setFreshLink] = useState<{ url: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const paidLink =
    stripeLink?.status === 'PAID' ? stripeLink
    : mpLink?.status === 'PAID' ? mpLink
    : null;
  const activeLink =
    freshLink ? { url: freshLink.url, amount: freshLink.amount, status: 'PENDING', isActive: true }
    : stripeLink?.isActive && stripeLink.status !== 'PAID' ? stripeLink
    : mpLink?.isActive && mpLink.status !== 'PAID' ? mpLink
    : null;

  const shareUrl = activeLink?.url ?? '';
  const shareAmount = activeLink?.amount != null ? Number(activeLink.amount) : null;

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link de pago copiado');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const montoTxt = shareAmount ? ` por $${shareAmount.toLocaleString('es-MX')} MXN` : '';
    const message = `Hola ${patientName}, te envío tu link de pago${montoTxt}: ${shareUrl}`;
    const phone = patientWhatsapp || patientPhone;
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
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

  // Active pending link — share actions
  if (activeLink) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Link enviado
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
          title="Copiar link de pago"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        {(patientWhatsapp || patientPhone) && (
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

  // No link yet
  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 flex items-center gap-1"
        title="Crear link de pago para esta cita (Stripe o Mercado Pago)"
      >
        <CreditCard className="w-3 h-3" /> Link de pago
      </button>
      {modalOpen && (
        <PaymentLinkModal
          bookingId={bookingId}
          patientName={patientName}
          patientEmail={patientEmail}
          defaultAmount={defaultAmount}
          defaultDescription={defaultDescription}
          onClose={() => setModalOpen(false)}
          onCreated={(url, amount) => {
            setFreshLink({ url, amount });
            setModalOpen(false);
            onCreated?.();
          }}
        />
      )}
    </>
  );
}

// ── Modal ──

function PaymentLinkModal({
  bookingId,
  patientName,
  patientEmail,
  defaultAmount,
  defaultDescription,
  onClose,
  onCreated,
}: {
  bookingId: string;
  patientName: string;
  patientEmail?: string | null;
  defaultAmount?: number | null;
  defaultDescription?: string | null;
  onClose: () => void;
  onCreated: (url: string, amount: number) => void;
}) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [mpAvailable, setMpAvailable] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [amount, setAmount] = useState<string>(
    defaultAmount && defaultAmount > 0 ? String(defaultAmount) : ''
  );
  const [creating, setCreating] = useState(false);

  const fetchStatuses = useCallback(async () => {
    setLoadingStatus(true);
    const [stripeRes, mpRes] = await Promise.allSettled([
      authFetch(`${API_URL}/api/stripe/connect/status`).then((r) => r.json()),
      authFetch(`${API_URL}/api/mercadopago/connect/status`).then((r) => r.json()),
    ]);
    const stripeOk = stripeRes.status === 'fulfilled' && stripeRes.value?.chargesEnabled === true;
    const mpOk = mpRes.status === 'fulfilled' && mpRes.value?.connected === true;
    setStripeAvailable(stripeOk);
    setMpAvailable(mpOk);
    setProvider(mpOk ? 'mercadopago' : stripeOk ? 'stripe' : null);
    setLoadingStatus(false);
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  async function handleCreate() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10 || parsedAmount > 100000) {
      toast.error('El monto debe ser entre $10 y $100,000 MXN');
      return;
    }
    if (!provider) return;

    setCreating(true);
    try {
      const description = defaultDescription || `Consulta - ${patientName}`;
      const endpoint =
        provider === 'stripe'
          ? `${API_URL}/api/stripe/payment-links`
          : `${API_URL}/api/mercadopago/preferences`;
      const body =
        provider === 'stripe'
          ? { amount: parsedAmount, description, bookingId }
          : { amount: parsedAmount, description, bookingId, ...(patientEmail ? { patientEmail } : {}) };

      const res = await authFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.url) {
        toast.success('Link de pago creado');
        onCreated(json.url, parsedAmount);
      } else {
        toast.error(json.error || 'Error al crear el link de pago');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-sky-600" />
            Link de pago · {patientName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : !stripeAvailable && !mpAvailable ? (
          <div className="text-sm text-gray-600 space-y-3">
            <p>No tienes ningún proveedor de pagos configurado.</p>
            <a
              href="/dashboard/pagos"
              className="inline-block text-xs px-3 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700"
            >
              Configurar en Pagos
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Proveedor</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setProvider('mercadopago')}
                  disabled={!mpAvailable}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    provider === 'mercadopago'
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={mpAvailable ? undefined : 'Mercado Pago no está conectado'}
                >
                  Mercado Pago
                </button>
                <button
                  onClick={() => setProvider('stripe')}
                  disabled={!stripeAvailable}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                    provider === 'stripe'
                      ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={stripeAvailable ? undefined : 'Stripe no está configurado'}
                >
                  Stripe
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Monto (MXN)</label>
              <input
                type="number"
                min={10}
                max={100000}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !provider || !amount}
              className="w-full text-sm px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creando...
                </>
              ) : (
                'Crear link de pago'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
