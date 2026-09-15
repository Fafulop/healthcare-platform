"use client";

/**
 * /billing — la pantalla de control del COBRO de suscripciones.
 *
 * TIERS C2. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.1
 *
 * Dos secciones:
 *   1. El mapa tier ↔ precio de Stripe. El MONTO se lee de Stripe en cada
 *      carga, no de nuestra base: el precio no vive en el código ni en la BD.
 *   2. El estado de cobro de cada doctor.
 *
 * 🔴 En C2 la sección 2 está VACÍA para todos, y eso tiene que decirse con
 * palabras. Una tabla en blanco se lee como "ningún doctor paga" cuando lo
 * cierto es "el cobro todavía no está conectado" (lo conecta C3). Es la regla
 * de la casa: un [] no es una respuesta, y aquí las dos lecturas posibles
 * llevan a decisiones opuestas.
 */

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { authFetch } from "@/lib/auth-fetch";
import { CreditCard, AlertTriangle, Check, Loader2, Info } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

interface PrecioResuelto {
  stripePriceId: string;
  montoCentavos: number | null;
  moneda: string | null;
  intervalo: string | null;
  activoEnStripe: boolean | null;
  problema: string | null;
}

interface FilaTier {
  tier: string;
  label: string;
  configurado: boolean;
  notaInterna: string | null;
  precio: PrecioResuelto | null;
}

interface FilaDoctor {
  doctorId: string;
  slug: string;
  nombre: string;
  tier: string;
  suscripcion: {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lastPaymentAt: string | null;
  } | null;
}

interface Payload {
  tiers: FilaTier[];
  doctores: FilaDoctor[];
  cobroConectado: boolean;
}

/** Los status son los de STRIPE, tal cual. Aquí sólo se traducen para leerlos. */
const STATUS_LABEL: Record<string, string> = {
  none: "Sin suscripción",
  trialing: "En periodo de prueba",
  active: "Al corriente",
  past_due: "Pago vencido",
  unpaid: "Sin pagar",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Incompleta (expiró)",
};

function dinero(p: PrecioResuelto): string {
  if (p.montoCentavos === null || !p.moneda) return "—";
  const monto = (p.montoCentavos / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
  });
  return `$${monto} ${p.moneda}${p.intervalo ? ` / ${p.intervalo === "month" ? "mes" : p.intervalo}` : ""}`;
}

export default function BillingPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [priceId, setPriceId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/billing`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Error");
      setData(json.data as Payload);
    } catch (e) {
      // No se pinta una tabla vacía: no saber es distinto de estar vacío.
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setCargando(false);
    }
  }

  async function guardarPrecio(tier: string) {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/billing`, {
        method: "PATCH",
        body: JSON.stringify({ tier, stripePriceId: priceId }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorGuardar(json.message || "No se pudo guardar");
        return;
      }
      setEditando(null);
      setPriceId("");
      await cargar();
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CreditCard className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cobro de suscripciones</h1>
            <p className="text-sm text-gray-500">
              Lo que los doctores nos pagan a nosotros. No confundir con Pagos, que es lo
              que ellos le cobran a sus pacientes.
            </p>
          </div>
        </div>

        {cargando && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {error && !cargando && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">
              <p className="font-medium">No se pudo leer el estado del cobro.</p>
              <p className="mt-1 text-red-600">{error}</p>
              <p className="mt-1 text-red-600">
                Esto NO quiere decir que nadie esté pagando: quiere decir que no sabemos.
              </p>
            </div>
          </div>
        )}

        {data && !cargando && (
          <>
            {/* ── 1. Precios ─────────────────────────────────────────────── */}
            <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Precio de cada plan</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  El monto vive en Stripe, no aquí. Para cambiar un precio se crea uno nuevo
                  en Stripe y se pega su id — no hace falta desplegar nada.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Plan</th>
                    <th className="text-left font-medium px-5 py-2">Precio en Stripe</th>
                    <th className="text-left font-medium px-5 py-2">Price ID</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.tiers.map((t) => (
                    <tr key={t.tier} className="border-t border-gray-100 align-top">
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900">{t.label}</span>
                        <span className="ml-2 text-xs text-gray-400">{t.tier}</span>
                      </td>
                      <td className="px-5 py-3">
                        {!t.configurado ? (
                          <span className="text-gray-400">sin precio configurado</span>
                        ) : t.precio?.problema ? (
                          <span className="inline-flex items-start gap-1.5 text-amber-700">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {t.precio.problema}
                          </span>
                        ) : (
                          <span className="text-gray-900 font-medium">
                            {t.precio ? dinero(t.precio) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs text-gray-500">
                          {t.precio?.stripePriceId ?? "—"}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {editando === t.tier ? (
                          <div className="flex flex-col items-end gap-2">
                            <input
                              autoFocus
                              value={priceId}
                              onChange={(e) => setPriceId(e.target.value)}
                              placeholder="price_1A2b3C..."
                              className="w-56 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                            />
                            {errorGuardar && (
                              <p className="text-xs text-red-600 max-w-xs text-right">
                                {errorGuardar}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditando(null);
                                  setErrorGuardar(null);
                                }}
                                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
                              >
                                Cancelar
                              </button>
                              <button
                                disabled={guardando || !priceId.trim()}
                                onClick={() => guardarPrecio(t.tier)}
                                className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40"
                              >
                                {guardando ? "Validando…" : "Guardar"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditando(t.tier);
                              setPriceId(t.precio?.stripePriceId ?? "");
                              setErrorGuardar(null);
                            }}
                            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                          >
                            {t.configurado ? "Cambiar" : "Fijar precio"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ── 2. Estado por doctor ───────────────────────────────────── */}
            <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Estado de cada cuenta</h2>
              </div>

              {!data.cobroConectado && (
                <div className="mx-5 my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">El cobro todavía no está conectado.</p>
                    <p className="mt-1 text-blue-800">
                      Ningún doctor tiene suscripción porque aún no existe el checkout ni el
                      webhook que la crean — eso es C3. Los renglones de abajo dicen
                      &ldquo;sin suscripción&rdquo; por esa razón,{" "}
                      <strong>no porque hayan dejado de pagar</strong>.
                    </p>
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Doctor</th>
                    <th className="text-left font-medium px-5 py-2">Plan</th>
                    <th className="text-left font-medium px-5 py-2">Cobro</th>
                    <th className="text-left font-medium px-5 py-2">Próximo corte</th>
                    <th className="text-left font-medium px-5 py-2">Último pago</th>
                  </tr>
                </thead>
                <tbody>
                  {data.doctores.map((d) => (
                    <tr key={d.doctorId} className="border-t border-gray-100">
                      <td className="px-5 py-3">
                        <span className="text-gray-900">{d.nombre}</span>
                        <span className="block text-xs text-gray-400">{d.slug}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{d.tier}</td>
                      <td className="px-5 py-3">
                        {d.suscripcion ? (
                          <span
                            className={
                              d.suscripcion.status === "active"
                                ? "inline-flex items-center gap-1 text-green-700"
                                : "text-amber-700"
                            }
                          >
                            {d.suscripcion.status === "active" && <Check className="w-3.5 h-3.5" />}
                            {STATUS_LABEL[d.suscripcion.status] ?? d.suscripcion.status}
                          </span>
                        ) : (
                          <span className="text-gray-400">sin suscripción</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {d.suscripcion?.currentPeriodEnd
                          ? new Date(d.suscripcion.currentPeriodEnd).toLocaleDateString("es-MX")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {d.suscripcion?.lastPaymentAt
                          ? new Date(d.suscripcion.lastPaymentAt).toLocaleDateString("es-MX")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
