"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Clock,
  ArrowRight,
  Banknote,
  Ban,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { StatusRow } from "./StatusRow";
import { PaymentLinkRow } from "./PaymentLinkRow";
import { CreatePaymentForm } from "./CreatePaymentForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface StripeStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  disabledReason: string | null;
  currentlyDue: string[];
  pastDue: string[];
  errors: { code: string; reason: string; requirement: string }[];
  currentDeadline: string | null;
  lastPayout: {
    amount: number;
    currency: string;
    status: string;
    arrivalDate: string;
    failureCode: string | null;
    failureMessage: string | null;
  } | null;
}

interface PaymentLink {
  id: string;
  stripePaymentLinkUrl: string;
  description: string | null;
  amount: string;
  currency: string;
  isActive: boolean;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  paidAt: string | null;
  createdAt: string;
  service: { serviceName: string } | null;
  booking: { id: string; patientName: string } | null;
}

interface StripeSectionProps {
  onError: (msg: string) => void;
  returnSuccess: boolean;
}

export function StripeSection({ onError, returnSuccess }: StripeSectionProps) {
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/connect/status`);
      if (!res.ok) throw new Error("Error al obtener estado");
      const data = await res.json();
      setStripeStatus(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const fetchPaymentLinks = useCallback(async () => {
    try {
      setLinksLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/payment-links`);
      if (!res.ok) throw new Error("Error al obtener links");
      const data = await res.json();
      setPaymentLinks(data);
    } catch (err) {
      console.error("Error fetching payment links:", err);
    } finally {
      setLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (stripeStatus?.connected && stripeStatus.chargesEnabled) {
      fetchPaymentLinks();
    }
  }, [stripeStatus, fetchPaymentLinks]);

  useEffect(() => {
    if (returnSuccess) fetchStatus();
  }, [returnSuccess, fetchStatus]);

  const handleCreateAccount = async () => {
    try {
      setActionLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/connect/create-account`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear cuenta");
      window.location.href = data.url;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
      setActionLoading(false);
    }
  };

  const handleResumeOnboarding = async () => {
    try {
      setActionLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/connect/account-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar enlace");
      window.location.href = data.url;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
      setActionLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      setActionLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/connect/dashboard-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar enlace");
      window.open(data.url, "_blank");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePaymentLink = async (amount: number, description: string) => {
    try {
      setCreateLoading(true);
      const res = await authFetch(`${API_URL}/api/stripe/payment-links`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear link");
      setShowCreateForm(false);
      fetchPaymentLinks();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Desactivar este link de pago?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/stripe/payment-links/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desactivar");
      }
      fetchPaymentLinks();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (url: string, description: string | null) => {
    const text = `Hola! Aqui esta tu link de pago${description ? ` para: ${description}` : ""}:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Not connected
  if (stripeStatus && !stripeStatus.connected) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <StripeLogo />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Activar cobros con Stripe</h2>
            <p className="text-sm text-gray-500">
              Conecta tu cuenta de Stripe para empezar a cobrar
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Al conectar Stripe, podras generar links de pago para tus pacientes.
          Los pagos se depositan directamente en tu cuenta bancaria.
          Stripe es seguro y cumple con los estandares PCI DSS.
        </p>

        <button
          onClick={handleCreateAccount}
          disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ExternalLink className="w-5 h-5" />
          )}
          {actionLoading ? "Conectando..." : "Conectar con Stripe"}
        </button>
      </div>
    );
  }

  // Onboarding incomplete
  if (stripeStatus && stripeStatus.connected && !stripeStatus.onboardingComplete) {
    return (
      <div className="bg-white border border-yellow-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Onboarding incompleto</h2>
            <p className="text-sm text-gray-500">
              Completa tu registro en Stripe para poder recibir pagos
            </p>
          </div>
        </div>

        <button
          onClick={handleResumeOnboarding}
          disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ExternalLink className="w-5 h-5" />
          )}
          {actionLoading ? "Cargando..." : "Completar registro en Stripe"}
        </button>
      </div>
    );
  }

  // Fully connected
  if (stripeStatus && stripeStatus.connected && stripeStatus.onboardingComplete) {
    return (
      <>
        {/* Account alerts */}
        {stripeStatus.disabledReason && (
          <AccountAlert
            disabledReason={stripeStatus.disabledReason}
            errors={stripeStatus.errors}
            currentDeadline={stripeStatus.currentDeadline}
            onResumeOnboarding={handleResumeOnboarding}
            onOpenDashboard={handleOpenDashboard}
            actionLoading={actionLoading}
          />
        )}

        {/* Status card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled
                  ? "bg-green-100"
                  : "bg-yellow-100"
              }`}>
                {stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Stripe conectado</h2>
                <p className="text-sm text-gray-500">
                  {stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled
                    ? "Tu cuenta esta lista para recibir pagos"
                    : "Tu cuenta esta en proceso de verificacion"}
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenDashboard}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              title="Abrir panel de Stripe"
            >
              <ExternalLink className="w-4 h-4" />
              Mi Stripe
            </button>
          </div>

          <div className="space-y-3">
            <StatusRow label="Cargos habilitados" enabled={stripeStatus.chargesEnabled} />
            <StatusRow label="Pagos habilitados" enabled={stripeStatus.payoutsEnabled} />
          </div>

          {(!stripeStatus.chargesEnabled || !stripeStatus.payoutsEnabled) && !stripeStatus.disabledReason && (
            <p className="mt-4 text-xs text-gray-500">
              Si alguna capacidad no esta habilitada, Stripe puede estar revisando tu cuenta.
              Esto suele resolverse en 1-2 dias habiles.
            </p>
          )}

          {/* Last payout info */}
          {stripeStatus.lastPayout && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <LastPayoutInfo payout={stripeStatus.lastPayout} />
            </div>
          )}
        </div>

        {/* Payment links section */}
        {stripeStatus.chargesEnabled && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Links de pago</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear link
              </button>
            </div>

            {showCreateForm && (
              <CreatePaymentForm
                onSubmit={handleCreatePaymentLink}
                onCancel={() => setShowCreateForm(false)}
                loading={createLoading}
              />
            )}

            {linksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : paymentLinks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No has creado links de pago aun. Crea uno para compartir con tus pacientes.
              </p>
            ) : (
              <div className="space-y-3">
                {paymentLinks.map((link) => (
                  <PaymentLinkRow
                    key={link.id}
                    id={link.id}
                    url={link.stripePaymentLinkUrl}
                    description={link.description}
                    amount={link.amount}
                    currency={link.currency}
                    isActive={link.isActive}
                    status={link.status}
                    paidAt={link.paidAt}
                    createdAt={link.createdAt}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onShare={handleShareWhatsApp}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stripe self-service info */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Desde tu panel de Stripe puedes:</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 shrink-0" /> Ver tu balance y pagos recibidos</li>
            <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 shrink-0" /> Ver el estado de tus depositos bancarios</li>
            <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 shrink-0" /> Emitir reembolsos a pacientes</li>
            <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 shrink-0" /> Responder disputas con evidencia</li>
            <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 shrink-0" /> Actualizar tu cuenta bancaria (CLABE)</li>
          </ul>
          <button
            onClick={handleOpenDashboard}
            disabled={actionLoading}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir mi panel de Stripe
          </button>
        </div>
      </>
    );
  }

  return null;
}

// ── Sub-components ──

function StripeLogo() {
  return (
    <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  );
}

function AccountAlert({
  disabledReason,
  errors,
  currentDeadline,
  onResumeOnboarding,
  onOpenDashboard,
  actionLoading,
}: {
  disabledReason: string;
  errors: { code: string; reason: string; requirement: string }[];
  currentDeadline: string | null;
  onResumeOnboarding: () => void;
  onOpenDashboard: () => void;
  actionLoading: boolean;
}) {
  const isRejected = disabledReason.startsWith("rejected.");
  const isPastDue = disabledReason === "requirements.past_due";
  const isPendingVerification = disabledReason === "requirements.pending_verification";
  const isUnderReview = disabledReason === "under_review";

  const config = isRejected
    ? {
        bg: "bg-red-50 border-red-200",
        icon: <Ban className="w-5 h-5 text-red-500" />,
        title: "Cuenta rechazada",
        message: "Tu cuenta de Stripe fue rechazada permanentemente. Contacta a soporte si crees que es un error.",
        action: null,
      }
    : isPastDue
    ? {
        bg: "bg-red-50 border-red-200",
        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
        title: "Informacion requerida vencida",
        message: "Stripe necesita informacion que no fue proporcionada a tiempo. Tu cuenta esta deshabilitada hasta que actualices tus datos.",
        action: "update",
      }
    : isPendingVerification
    ? {
        bg: "bg-yellow-50 border-yellow-200",
        icon: <Clock className="w-5 h-5 text-yellow-500" />,
        title: "Verificacion en proceso",
        message: "Stripe esta revisando tu documentacion. Esto puede tardar 1-2 dias habiles. No se requiere accion de tu parte.",
        action: null,
      }
    : isUnderReview
    ? {
        bg: "bg-yellow-50 border-yellow-200",
        icon: <Clock className="w-5 h-5 text-yellow-500" />,
        title: "Cuenta en revision",
        message: "Stripe esta revisando tu cuenta. No se requiere accion de tu parte por el momento.",
        action: null,
      }
    : {
        bg: "bg-yellow-50 border-yellow-200",
        icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
        title: "Atencion requerida",
        message: "Tu cuenta de Stripe necesita atencion.",
        action: "update",
      };

  return (
    <div className={`mb-6 p-4 border rounded-xl ${config.bg}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{config.icon}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">{config.title}</h3>
          <p className="text-sm text-gray-700 mt-1">{config.message}</p>

          {currentDeadline && (
            <p className="text-xs text-gray-500 mt-2">
              Fecha limite: {new Date(currentDeadline).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          {errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  {e.reason}
                </p>
              ))}
            </div>
          )}

          {config.action === "update" && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onResumeOnboarding}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Actualizar datos en Stripe
              </button>
              <button
                onClick={onOpenDashboard}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Ver mi panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LastPayoutInfo({ payout }: { payout: NonNullable<StripeStatus["lastPayout"]> }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    paid: { label: "Depositado", color: "text-green-600" },
    pending: { label: "Pendiente", color: "text-yellow-600" },
    in_transit: { label: "En camino", color: "text-blue-600" },
    failed: { label: "Fallido", color: "text-red-600" },
    canceled: { label: "Cancelado", color: "text-gray-500" },
  };

  const config = statusConfig[payout.status] || { label: payout.status, color: "text-gray-600" };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">Ultimo deposito:</span>
        <span className="text-sm font-medium text-gray-900">
          ${payout.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {payout.currency}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        {payout.status === "paid" && (
          <span className="text-xs text-gray-400">
            {new Date(payout.arrivalDate).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          </span>
        )}
        {payout.status === "failed" && payout.failureMessage && (
          <span className="text-xs text-red-500" title={payout.failureMessage}>
            — Actualiza tu cuenta bancaria
          </span>
        )}
      </div>
    </div>
  );
}
