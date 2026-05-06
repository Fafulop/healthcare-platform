/"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { redirect } from "next/navigation";
import {
  CreditCard,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Copy,
  XCircle,
  Link as LinkIcon,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface StripeStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
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

export default function PagosPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const searchParams = useSearchParams();
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment links state
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newLink, setNewLink] = useState({ amount: "", description: "" });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/api/stripe/connect/status`);
      if (!res.ok) throw new Error("Error al obtener estado");
      const data = await res.json();
      setStripeStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (sessionStatus === "authenticated") {
      fetchStatus();
    }
  }, [sessionStatus, fetchStatus]);

  // Fetch payment links when Stripe is fully connected
  useEffect(() => {
    if (stripeStatus?.connected && stripeStatus.chargesEnabled) {
      fetchPaymentLinks();
    }
  }, [stripeStatus, fetchPaymentLinks]);

  // Re-fetch on return from Stripe onboarding
  useEffect(() => {
    if (searchParams.get("success") === "true" || searchParams.get("refresh") === "true") {
      fetchStatus();
    }
  }, [searchParams, fetchStatus]);

  const handleCreateAccount = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/api/stripe/connect/create-account`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear cuenta");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setActionLoading(false);
    }
  };

  const handleResumeOnboarding = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/api/stripe/connect/account-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar enlace");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setActionLoading(false);
    }
  };

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newLink.amount);
    if (!amount || amount <= 0) return;

    try {
      setCreateLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/api/stripe/payment-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description: newLink.description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear link");

      setNewLink({ amount: "", description: "" });
      setShowCreateForm(false);
      fetchPaymentLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("¿Desactivar este link de pago?")) return;
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
      setError(err instanceof Error ? err.message : "Error desconocido");
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

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura tu cuenta de Stripe para recibir pagos de tus pacientes
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          title="Actualizar estado"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {searchParams.get("success") === "true" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700">
            Proceso de Stripe completado. Tu estado se ha actualizado.
          </p>
        </div>
      )}

      {/* Not connected */}
      {stripeStatus && !stripeStatus.connected && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Activar cobros</h2>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {actionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5" />
            )}
            {actionLoading ? "Conectando..." : "Conectar con Stripe"}
          </button>
        </div>
      )}

      {/* Onboarding incomplete */}
      {stripeStatus && stripeStatus.connected && !stripeStatus.onboardingComplete && (
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
      )}

      {/* Fully connected */}
      {stripeStatus && stripeStatus.connected && stripeStatus.onboardingComplete && (
        <>
          {/* Status card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Stripe conectado</h2>
                <p className="text-sm text-gray-500">Tu cuenta esta lista para recibir pagos</p>
              </div>
            </div>

            <div className="space-y-3">
              <StatusRow label="Cargos habilitados" enabled={stripeStatus.chargesEnabled} />
              <StatusRow label="Pagos habilitados" enabled={stripeStatus.payoutsEnabled} />
            </div>

            {(!stripeStatus.chargesEnabled || !stripeStatus.payoutsEnabled) && (
              <p className="mt-4 text-xs text-gray-500">
                Si alguna capacidad no esta habilitada, Stripe puede estar revisando tu cuenta.
                Esto suele resolverse en 1-2 dias habiles.
              </p>
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

              {/* Create form */}
              {showCreateForm && (
                <form onSubmit={handleCreatePaymentLink} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto (MXN) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="100000"
                      required
                      value={newLink.amount}
                      onChange={(e) => setNewLink({ ...newLink, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="500.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripcion (opcional)
                    </label>
                    <input
                      type="text"
                      value={newLink.description}
                      onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Consulta general"
                      maxLength={200}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {createLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LinkIcon className="w-4 h-4" />
                      )}
                      {createLoading ? "Creando..." : "Crear link de pago"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Payment links list */}
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
                      link={link}
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
        </>
      )}
    </div>
  );
}

function StatusRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-700">{label}</span>
      {enabled ? (
        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Activo
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-yellow-600 font-medium">
          <AlertCircle className="w-4 h-4" />
          Pendiente
        </span>
      )}
    </div>
  );
}

function PaymentLinkRow({
  link,
  copiedId,
  onCopy,
  onShare,
  onDeactivate,
}: {
  link: PaymentLink;
  copiedId: string | null;
  onCopy: (url: string, id: string) => void;
  onShare: (url: string, description: string | null) => void;
  onDeactivate: (id: string) => void;
}) {
  const amount = parseFloat(link.amount);
  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    EXPIRED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-red-100 text-red-600",
  };
  const statusLabels = {
    PENDING: "Pendiente",
    PAID: "Pagado",
    EXPIRED: "Expirado",
    CANCELLED: "Cancelado",
  };

  return (
    <div className={`p-4 border rounded-lg ${link.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 text-sm truncate">
              {link.description || "Link de pago"}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[link.status]}`}>
              {statusLabels[link.status]}
            </span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            ${amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {link.currency}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(link.createdAt).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {link.paidAt && ` — Pagado ${new Date(link.paidAt).toLocaleDateString("es-MX")}`}
          </p>
        </div>

        {link.isActive && link.status === "PENDING" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCopy(link.stripePaymentLinkUrl, link.id)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Copiar link"
            >
              {copiedId === link.id ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => onShare(link.stripePaymentLinkUrl, link.description)}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Compartir por WhatsApp"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </button>
            <button
              onClick={() => onDeactivate(link.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Desactivar link"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
