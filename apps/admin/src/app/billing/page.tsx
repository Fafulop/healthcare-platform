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

/** TIERS #7 (versión corta): un doctor pidió bajarse de plan y espera a un humano. */
interface SolicitudDePlan {
  id: string;
  slug: string;
  tierActual: string;
  tierSolicitado: string;
  cabe: boolean;
  motivoNoCabe: string | null;
  solicitadoPor: string;
  creadoEn: string;
}

interface Payload {
  tiers: FilaTier[];
  doctores: FilaDoctor[];
  cobroConectado: boolean;
  // Opcionales A PROPÓSITO (review de C3, #3): sólo los manda el api de C3. Si
  // admin despliega y api no —el fallo documentado de Railway—, un api viejo
  // no los trae y leerlos a pelo tumbaba la pantalla que existe justo para ver
  // qué está mal configurado.
  modo?: "test" | "live" | null;
  faltantes?: string[];
  /** Opcional por lo mismo: un api viejo no manda la bandeja. */
  solicitudes?: SolicitudDePlan[];
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
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  /** Error propio: `errorGuardar` sólo se pinta dentro de la fila de precios
   *  que se está editando, así que un fallo aquí era INVISIBLE — se clicaba
   *  «Marcar como hecha», no pasaba nada, y no había forma de distinguir un
   *  409 (la solicitud ya no estaba) de una sesión vencida. */
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);
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

  /**
   * Marca una solicitud como atendida. NO cambia el plan de nadie: el cambio lo
   * hace el admin a mano, en Stripe Y en el modal del doctor, y esto sólo
   * registra que ya lo hizo. Por eso el botón dice «hecha» y no «aplicar».
   */
  async function resolver(id: string, estado: "HECHA" | "RECHAZADA") {
    setResolviendo(id);
    setErrorSolicitud(null);
    try {
      const res = await authFetch(`${API_URL}/api/admin/cambios-de-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "No se pudo actualizar");
      await cargar();
    } catch (e) {
      setErrorSolicitud(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setResolviendo(null);
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
            {/* ── 0. Solicitudes de bajar de plan (TIERS #7, versión corta) ── */}
            {(data.solicitudes?.length ?? 0) > 0 && (
              <section className="bg-white border border-amber-300 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200 bg-amber-50">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Piden bajar de plan ({data.solicitudes!.length})
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Bajar de plan todavía no es automático. Son DOS pasos, y hacer sólo el
                    segundo le cobra de más al doctor:
                  </p>
                  <ol className="text-xs text-gray-700 mt-1.5 ml-4 list-decimal space-y-0.5">
                    <li>Cambiar la <strong>suscripción en Stripe</strong> al precio del plan nuevo.</li>
                    <li>Cambiar el plan del doctor en <strong>Doctores</strong>.</li>
                  </ol>
                  <p className="text-xs text-gray-600 mt-1.5">
                    «Marcar como hecha» sólo cierra la solicitud: no cambia nada por su cuenta.
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.solicitudes!.map((s) => (
                    <li key={s.id} className="px-5 py-3 flex items-start justify-between gap-4 flex-wrap">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {s.slug}: {s.tierActual} → {s.tierSolicitado}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {/* timeZone FIJA: es un timestamp, no un @db.Date. Sin
                              esto, el doctor y un admin con el navegador en UTC
                              leen fechas distintas del MISMO dato. */}
                          {s.solicitadoPor} · {new Date(s.creadoEn).toLocaleDateString("es-MX", {
                            day: "numeric", month: "long", year: "numeric",
                            timeZone: "America/Mexico_City",
                          })}
                        </p>
                        {!s.cabe && (
                          <p className="text-xs text-amber-700 mt-1">
                            ⚠️ No cabe: {s.motivoNoCabe}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resolver(s.id, "HECHA")}
                          disabled={resolviendo === s.id}
                          className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-60"
                        >
                          Marcar como hecha
                        </button>
                        <button
                          onClick={() => resolver(s.id, "RECHAZADA")}
                          disabled={resolviendo === s.id}
                          className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-60"
                        >
                          Descartar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {errorSolicitud && (
                  <p className="px-5 py-3 text-sm text-red-600 border-t border-gray-100">
                    {errorSolicitud}
                  </p>
                )}
              </section>
            )}

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

              {data.modo === "test" && (
                <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-900">
                    <span className="font-medium">Modo de prueba.</span> No se cobra dinero real, y
                    sólo los doctores de <code>STRIPE_BILLING_TEST_DOCTORS</code> ven el cobro.
                  </p>
                </div>
              )}

              {!data.cobroConectado && (
                <div className="mx-5 my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">El cobro todavía no está conectado.</p>
                    <p className="mt-1 text-blue-800">
                      Los renglones de abajo dicen &ldquo;sin suscripción&rdquo; porque ningún
                      doctor puede pagar todavía,{" "}
                      <strong>no porque hayan dejado de pagar</strong>.
                    </p>
                  </div>
                </div>
              )}

              {(data.faltantes ?? []).length > 0 && (
                <div className="mx-5 my-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  <p className="font-medium">Variables pendientes en el api:</p>
                  <ul className="mt-1 list-disc list-inside text-gray-600">
                    {(data.faltantes ?? []).map((f) => (
                      <li key={f}>
                        <code className="text-xs">{f}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Doctor</th>
                    <th className="text-left font-medium px-5 py-2">Plan</th>
                    <th className="text-left font-medium px-5 py-2">Cobro</th>
                    <th className="text-left font-medium px-5 py-2">Próximo corte / fin</th>
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
                          // 🔴 `cancelAtPeriodEnd` MANDA sobre el status. Stripe
                          // deja una suscripción cancelada en `active` hasta que
                          // se acaba el periodo pagado: pintarla verde y «Al
                          // corriente» afirmaría que ese doctor sigue con
                          // nosotros el día que ya se dio de baja.
                          d.suscripcion.cancelAtPeriodEnd ? (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Cancela
                            </span>
                          ) : (
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
                          )
                        ) : (
                          <span className="text-gray-400">sin suscripción</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {d.suscripcion?.currentPeriodEnd ? (
                          d.suscripcion.cancelAtPeriodEnd ? (
                            <span className="text-amber-700">
                              termina{" "}
                              {new Date(d.suscripcion.currentPeriodEnd).toLocaleDateString("es-MX")}
                            </span>
                          ) : (
                            new Date(d.suscripcion.currentPeriodEnd).toLocaleDateString("es-MX")
                          )
                        ) : (
                          "—"
                        )}
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
