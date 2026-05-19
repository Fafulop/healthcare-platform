"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Clock,
  Unlink,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { StatusRow } from "./StatusRow";
import { PaymentLinkRow } from "./PaymentLinkRow";
import { CreatePaymentForm } from "./CreatePaymentForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface MpStatus {
  connected: boolean;
  mpUserId: string | null;
  tokenExpiresAt: string | null;
  tokenExpiresSoon: boolean;
}

interface MpPreference {
  id: string;
  mpInitPoint: string;
  description: string | null;
  amount: string;
  currency: string;
  isActive: boolean;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  paidAt: string | null;
  createdAt: string;
}

interface MercadoPagoSectionProps {
  onError: (msg: string) => void;
  returnConnected: boolean;
}

export function MercadoPagoSection({ onError, returnConnected }: MercadoPagoSectionProps) {
  const [mpStatus, setMpStatus] = useState<MpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [preferences, setPreferences] = useState<MpPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/api/mercadopago/connect/status`);
      if (!res.ok) throw new Error("Error al obtener estado de Mercado Pago");
      const data = await res.json();
      setMpStatus(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const fetchPreferences = useCallback(async () => {
    try {
      setPrefsLoading(true);
      const res = await authFetch(`${API_URL}/api/mercadopago/preferences`);
      if (!res.ok) throw new Error("Error al obtener preferencias");
      const data = await res.json();
      setPreferences(data);
    } catch (err) {
      console.error("Error fetching MP preferences:", err);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (mpStatus?.connected) {
      fetchPreferences();
    }
  }, [mpStatus, fetchPreferences]);

  useEffect(() => {
    if (returnConnected) fetchStatus();
  }, [returnConnected, fetchStatus]);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const res = await authFetch(`${API_URL}/api/mercadopago/connect/authorize`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al conectar");
      window.location.href = data.url;
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar Mercado Pago? Tus links de pago existentes dejaran de funcionar.")) return;
    try {
      setActionLoading(true);
      const res = await authFetch(`${API_URL}/api/mercadopago/connect/disconnect`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desconectar");
      }
      setMpStatus({ connected: false, mpUserId: null, tokenExpiresAt: null, tokenExpiresSoon: false });
      setPreferences([]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePreference = async (amount: number, description: string, patientEmail?: string) => {
    try {
      setCreateLoading(true);
      const res = await authFetch(`${API_URL}/api/mercadopago/preferences`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          description: description || undefined,
          patientEmail: patientEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear link");
      setShowCreateForm(false);
      fetchPreferences();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Desactivar este link de pago?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/mercadopago/preferences/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desactivar");
      }
      fetchPreferences();
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
  if (!mpStatus?.connected) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
            <MpLogo />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Activar cobros con Mercado Pago</h2>
            <p className="text-sm text-gray-500">
              Conecta tu cuenta de Mercado Pago para empezar a cobrar
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Al conectar Mercado Pago, podras generar links de pago para tus pacientes.
          Acepta tarjetas, transferencias, OXXO y mas metodos de pago populares en Mexico.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {["Tarjetas", "Transferencia", "OXXO", "SPEI"].map((m) => (
            <span key={m} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">{m}</span>
          ))}
        </div>

        <button
          onClick={handleConnect}
          disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ExternalLink className="w-5 h-5" />
          )}
          {actionLoading ? "Conectando..." : "Conectar con Mercado Pago"}
        </button>
      </div>
    );
  }

  // Connected
  return (
    <>
      {/* Token expiry warning */}
      {mpStatus.tokenExpiresSoon && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Tu conexion con Mercado Pago expira pronto</p>
            <p className="text-xs text-yellow-700 mt-1">
              Reconecta tu cuenta para evitar interrupciones en tus cobros.
            </p>
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Reconectar
            </button>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mercado Pago conectado</h2>
              <p className="text-sm text-gray-500">Tu cuenta esta lista para recibir pagos</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            title="Desconectar Mercado Pago"
          >
            <Unlink className="w-4 h-4" />
            Desconectar
          </button>
        </div>

        <div className="space-y-3">
          <StatusRow label="Cobros habilitados" enabled={true} />
          {mpStatus.tokenExpiresAt && (
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Token expira</span>
              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {new Date(mpStatus.tokenExpiresAt).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment preferences section */}
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
            onSubmit={handleCreatePreference}
            onCancel={() => setShowCreateForm(false)}
            loading={createLoading}
            submitLabel="Crear link de pago"
            showEmailField
          />
        )}

        {prefsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : preferences.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No has creado links de pago aun. Crea uno para compartir con tus pacientes.
          </p>
        ) : (
          <div className="space-y-3">
            {preferences.map((pref) => (
              <PaymentLinkRow
                key={pref.id}
                id={pref.id}
                url={pref.mpInitPoint}
                description={pref.description}
                amount={pref.amount}
                currency={pref.currency}
                isActive={pref.isActive}
                status={pref.status}
                paidAt={pref.paidAt}
                createdAt={pref.createdAt}
                copiedId={copiedId}
                onCopy={handleCopy}
                onShare={handleShareWhatsApp}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}
      </div>

      {/* MP info */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Metodos de pago disponibles:</h3>
        <div className="flex flex-wrap gap-2">
          {[
            "Visa / Mastercard",
            "American Express",
            "Transferencia bancaria",
            "OXXO",
            "SPEI",
            "Mercado Credito",
          ].map((m) => (
            <span key={m} className="px-2 py-1 text-xs bg-white text-gray-600 rounded-full border border-gray-200">{m}</span>
          ))}
        </div>
      </div>
    </>
  );
}

function MpLogo() {
  return (
    <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.3 2.6c-4.7.7-8.2 4.7-8.5 9.4-.1 1.1.1 2.1.3 3.1.2.7.8 1 1.5.7.7-.2 1-.8.7-1.5-.2-.7-.3-1.5-.2-2.3.3-3.7 3-6.9 6.7-7.4 4.4-.6 8.3 2.7 8.7 7 .3 3.2-1.4 6.1-4.2 7.5-.5.3-.8.8-.6 1.4.2.6.8.9 1.4.7 3.5-1.7 5.7-5.3 5.5-9.3-.4-5.5-5.3-9.8-11.3-9.3z"/>
      <path d="M11.7 6.6c-2.8.5-4.9 3-4.9 5.8 0 .7.1 1.3.3 2 .2.6.8.9 1.4.7.6-.2.9-.8.7-1.4-.1-.4-.2-.9-.2-1.3 0-1.8 1.3-3.4 3.1-3.7 2.1-.3 4 1.1 4.3 3.2.2 1.5-.5 2.9-1.7 3.7-.5.3-.7.9-.4 1.4.3.5.9.7 1.4.4 1.8-1.2 2.9-3.3 2.6-5.6-.4-3.1-3.4-5.5-6.6-5.2z"/>
      <circle cx="12" cy="12.5" r="2"/>
    </svg>
  );
}
