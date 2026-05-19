"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { redirect } from "next/navigation";
import {
  CreditCard,
  AlertCircle,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PagosGuide } from "@/app/dashboard/ayuda/_components/PagosGuide";
import { StripeSection } from "@/components/payments/StripeSection";
import { MercadoPagoSection } from "@/components/payments/MercadoPagoSection";

type Provider = "stripe" | "mercadopago" | null;

export default function PagosPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"pagos" | "guia">("pagos");
  const [expandedProvider, setExpandedProvider] = useState<Provider>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect return from OAuth flows
  const stripeReturnSuccess = searchParams.get("success") === "true" || searchParams.get("refresh") === "true";
  const mpReturnConnected = searchParams.get("mp") === "connected";

  const handleError = (msg: string) => setError(msg);

  const toggleProvider = (provider: Provider) => {
    setExpandedProvider((prev) => (prev === provider ? null : provider));
    setError(null);
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configura un proveedor de pagos para recibir pagos de tus pacientes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("pagos")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pagos"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Mis pagos
        </button>
        <button
          onClick={() => setActiveTab("guia")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "guia"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Guia
        </button>
      </div>

      {/* Guia tab */}
      {activeTab === "guia" && <PagosGuide />}

      {/* Pagos tab */}
      {activeTab === "pagos" && (
        <>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {stripeReturnSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700">
                Proceso de Stripe completado. Tu estado se ha actualizado.
              </p>
            </div>
          )}

          {mpReturnConnected && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700">
                Mercado Pago conectado exitosamente.
              </p>
            </div>
          )}

          {/* Provider cards */}
          <div className="space-y-4">
            {/* Stripe card */}
            <ProviderCard
              name="Stripe"
              description="Tarjetas internacionales, Apple Pay, Google Pay"
              color="purple"
              logo={<StripeLogo />}
              expanded={expandedProvider === "stripe"}
              onToggle={() => toggleProvider("stripe")}
            />
            {expandedProvider === "stripe" && (
              <div className="ml-1 border-l-2 border-purple-200 pl-5">
                <StripeSection
                  onError={handleError}
                  returnSuccess={stripeReturnSuccess}
                />
              </div>
            )}

            {/* Mercado Pago card */}
            <ProviderCard
              name="Mercado Pago"
              description="Tarjetas, OXXO, SPEI, transferencias, Mercado Credito"
              color="sky"
              logo={<MpLogo />}
              expanded={expandedProvider === "mercadopago"}
              onToggle={() => toggleProvider("mercadopago")}
            />
            {expandedProvider === "mercadopago" && (
              <div className="ml-1 border-l-2 border-sky-200 pl-5">
                <MercadoPagoSection
                  onError={handleError}
                  returnConnected={mpReturnConnected}
                />
              </div>
            )}
          </div>

          {/* Hint when nothing is expanded */}
          {!expandedProvider && (
            <p className="mt-6 text-sm text-gray-400 text-center">
              Selecciona un proveedor para ver opciones de configuracion y links de pago.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Provider Card ──

function ProviderCard({
  name,
  description,
  color,
  logo,
  expanded,
  onToggle,
}: {
  name: string;
  description: string;
  color: "purple" | "sky";
  logo: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const bgColor = color === "purple" ? "bg-purple-50" : "bg-sky-50";
  const borderColor = expanded
    ? color === "purple"
      ? "border-purple-300"
      : "border-sky-300"
    : "border-gray-200";
  const hoverBg = color === "purple" ? "hover:bg-purple-50" : "hover:bg-sky-50";

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-4 p-4 bg-white border ${borderColor} rounded-xl ${hoverBg} transition-all text-left`}
    >
      <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center shrink-0`}>
        {logo}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      {expanded ? (
        <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
      )}
    </button>
  );
}

// ── Logos ──

function StripeLogo() {
  return (
    <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
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
