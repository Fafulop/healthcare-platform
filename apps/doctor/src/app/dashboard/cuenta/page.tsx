"use client";

/**
 * /dashboard/cuenta — TIERS C1. Qué plan tiene esta cuenta, qué incluye y
 * cuánto lleva consumido de sus cupos.
 *
 * Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §4 (C1).
 *
 * TRES decisiones que NO son de estilo:
 *
 * 1. 🔴 La lista de funciones sale de PLAN_CATALOG, NO de TIER_EXCLUDED_KEYS.
 *    Derivarla de las exclusiones produce cuatro afirmaciones falsas; la
 *    cabecera de `plan-catalog.ts` las enumera y `gate:catalogo` las impide.
 *
 * 2. Esta página NO está en PAGE_PERMISSION_MAP, y su ruta es OWNER_ONLY. Las
 *    dos cosas juntas son lo que garantiza que un FREE pueda ABRIRLA: es la
 *    única pantalla que le explica qué le falta, así que no puede quedar
 *    debajo del techo que describe.
 *
 * 3. El medidor de archivos dice DESDE CUÁNDO cuenta. El ledger `stored_files`
 *    empezó el 2026-09-13 sin backfill, así que para las cuentas viejas el
 *    número es bastante menor que su bucket real. Es el mismo número que
 *    rechaza una subida —eso es lo que importa—, pero afirmarlo a secas sería
 *    afirmar algo falso sobre los archivos del doctor.
 *
 * Aquí NO hay dinero: cobros, estado de pago y botón de pagar son C2/C3.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  catalogoAnunciable,
  planIncluye,
  formatearBytes,
  GRUPO_LABELS,
  TIER_LABELS,
  DOCTOR_TIERS,
  type DoctorTier,
  type GrupoCatalogo,
} from "@healthcare/database";
import {
  Check,
  Lock,
  Loader2,
  Mail,
  Users,
  HardDrive,
  AlertCircle,
  Info,
  ShieldOff,
  CreditCard,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

/** Las rutas de cobro viven en el api (es donde está Stripe). */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Mismo fallback que usa el sitio público: un CTA muerto es peor que ninguno,
 * y la variable sigue sin ponerse en Railway (pendiente desde julio). */
const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || "hola@tusalud.pro";

interface ResumenCuenta {
  tier: string;
  pacientes: { usados: number; tope: number | null };
  almacenamiento: { usadoBytes: number; topeBytes: number };
}

export default function CuentaPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [resumen, setResumen] = useState<ResumenCuenta | null>(null);
  const [cargando, setCargando] = useState(true);
  /**
   * DOS errores distintos, y se pintan distinto a propósito.
   *
   * 'permiso' ⇒ un usuario secundario llegó aquí escribiendo la URL. La entrada
   * del menú no existe para él, pero esta página NO está en PAGE_PERMISSION_MAP
   * —eso es lo que impide que un tier la bloquee— y por eso `PermissionGate` la
   * deja pasar. La ruta responde 403 PERMISSION_BLOCKED, correctamente, y eso
   * es una respuesta DEFINITIVA: decirle "vuelve a cargar la página" lo manda a
   * reintentar para siempre algo que nunca va a cambiar. Misma lección que el
   * 403 de plan que salía como "No se pudo transcribir el audio" (Q2b, #6).
   */
  const [error, setError] = useState<"permiso" | "lectura" | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelado = false;

    (async () => {
      try {
        const res = await fetch("/api/account/summary");
        if (res.status === 403) {
          if (!cancelado) setError("permiso");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ResumenCuenta;
        if (!cancelado) setResumen(data);
      } catch {
        // Un fallo de lectura NO se pinta como "0 de 50": un cupo vacío y un
        // cupo que no se pudo leer se ven igual y significan lo contrario.
        if (!cancelado) setError("lectura");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [sessionStatus]);

  if (sessionStatus === "loading" || cargando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const tier = resumen?.tier ?? null;
  const tierCanonico =
    tier && (DOCTOR_TIERS as readonly string[]).includes(tier) ? (tier as DoctorTier) : null;
  const nombrePlan = tierCanonico ? TIER_LABELS[tierCanonico] : null;

  const entradas = catalogoAnunciable();
  const grupos = [...new Set(entradas.map((e) => e.grupo))] as GrupoCatalogo[];
  const faltantes = entradas.filter((e) => !planIncluye(tier, e));

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi cuenta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tu plan, lo que incluye y cuánto llevas usado.
        </p>
      </div>

      {error === "permiso" && (
        <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
          <ShieldOff className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              Esta sección es sólo del titular de la cuenta
            </p>
            <p className="text-gray-500 mt-1">
              El plan y el consumo los administra quien es dueño del consultorio.
            </p>
          </div>
        </div>
      )}

      {error === "lectura" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-700">
            <p>No pudimos leer el estado de tu cuenta.</p>
            <p className="mt-1 text-red-600">
              Vuelve a cargar la página. Si sigue igual, escríbenos.
            </p>
          </div>
        </div>
      )}

      {resumen && (
        <>
          {/* ── El plan ───────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Tu plan
                </p>
                {nombrePlan ? (
                  <p className="text-xl font-semibold text-gray-900 mt-1">{nombrePlan}</p>
                ) : (
                  // Un tier no canónico se comporta como PRO (fail-open) mientras
                  // la pantalla diría otra cosa. Se dice que no se pudo leer, en
                  // vez de inventarle un nombre bonito a un dato malo.
                  <p className="text-xl font-semibold text-amber-700 mt-1">
                    No pudimos identificar tu plan
                  </p>
                )}
              </div>
              {faltantes.length === 0 && nombrePlan && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Todo incluido
                </span>
              )}
            </div>
            {!nombrePlan && (
              <p className="text-sm text-amber-700 mt-2">
                Escríbenos y lo revisamos: mientras tanto tu cuenta sigue funcionando
                con normalidad.
              </p>
            )}
          </section>

          {/* ── Pago (TIERS C3) ───────────────────────────────────────── */}
          <SeccionPago />

          {/* ── Consumo ───────────────────────────────────────────────── */}
          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            <Medidor
              icono={Users}
              titulo="Pacientes activos"
              usado={resumen.pacientes.usados}
              tope={resumen.pacientes.tope}
              formato={(n) => String(n)}
              nota="Archivar un expediente libera un lugar; no borra nada."
            />
            <Medidor
              icono={HardDrive}
              titulo="Archivos"
              usado={resumen.almacenamiento.usadoBytes}
              tope={resumen.almacenamiento.topeBytes}
              formato={formatearBytes}
              nota="Cuenta los archivos subidos desde el 13 de septiembre de 2026."
            />
          </section>

          {/* ── Qué incluye ───────────────────────────────────────────── */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Qué incluye tu plan
            </h2>
            <div className="space-y-5">
              {grupos.map((grupo) => (
                <div key={grupo}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {GRUPO_LABELS[grupo]}
                  </p>
                  <ul className="space-y-1.5">
                    {entradas
                      .filter((e) => e.grupo === grupo)
                      .map((entrada) => {
                        const incluido = planIncluye(tier, entrada);
                        return (
                          <li
                            key={entrada.id}
                            className={`flex items-start gap-3 p-3 rounded-md border ${
                              incluido
                                ? "bg-white border-gray-200"
                                : "bg-amber-50/50 border-amber-200"
                            }`}
                          >
                            {incluido ? (
                              <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium ${
                                  incluido ? "text-gray-900" : "text-gray-600"
                                }`}
                              >
                                {entrada.titulo}
                                {!incluido && (
                                  <span className="ml-2 text-xs font-normal text-amber-700">
                                    no incluido
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {entrada.descripcion}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── Contacto ──────────────────────────────────────────────── */}
          <section className="p-5 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-sm font-semibold text-gray-900">
              {faltantes.length > 0
                ? "¿Quieres activar algo de lo que no incluye tu plan?"
                : "¿Necesitas algo más?"}
            </h2>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Escríbenos y lo vemos contigo. Tu información no se toca: si activas una
              función, todo aparece tal como estaba.
            </p>
            <a
              href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
                "Mi plan en TuSalud",
              )}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Escribir un correo
            </a>
          </section>
        </>
      )}
    </div>
  );
}

interface EstadoCobro {
  disponible: boolean;
  modo?: "test" | "live" | null;
  /** El plan VIGENTE de la cuenta. El servidor ya lo mandaba; sin declararlo no
   *  se podía nombrar el plan en la frase de la baja agendada. */
  tier?: string;
  suscripcion?: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lastPaymentAt: string | null;
  } | null;
  planes?: {
    tier: string;
    label: string;
    montoCentavos: number;
    moneda: string;
    intervalo: string;
  }[];
  puedeSuscribirse?: boolean;
  tienePortal?: boolean;
}

const ETIQUETA_STATUS: Record<string, string> = {
  active: "Al corriente",
  trialing: "En periodo de prueba",
  past_due: "Pago pendiente",
  unpaid: "Sin pagar",
  incomplete: "Pago incompleto",
  incomplete_expired: "Pago no completado",
  canceled: "Cancelada",
  none: "Sin suscripción",
};

function fecha(iso: string | null | undefined): string | null {
  // 🔴 `timeZone` FIJA. Estos ISO son timestamps (no `@db.Date`), así que sin
  // fijarla los formatea la zona del NAVEGADOR: un fin de periodo a las 03:00Z
  // se pinta el día anterior para quien esté en México, y la fecha que ve el
  // doctor deja de coincidir con la que ve el admin sobre el mismo dato.
  // Producto de México: una sola zona para las dos pantallas.
  return iso
    ? new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Mexico_City",
      })
    : null;
}

function precio(centavos: number, moneda: string, intervalo: string): string {
  const monto = (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: moneda });
  return `${monto} ${intervalo === "month" ? "al mes" : intervalo === "year" ? "al año" : `/ ${intervalo}`}`;
}

/**
 * TIERS C3 — el pago del plan.
 *
 * Tres reglas que no son de estilo:
 *
 * 1. `disponible: false` ⇒ NO se pinta nada. El cobro puede no estar
 *    configurado, o estar en modo prueba y esta cuenta no estar en la lista.
 *    Para esa cuenta el cobro todavía no existe; no hay nada que explicar.
 *
 * 2. 🔴 Al volver de Stripe con `?pago=ok` NO se afirma que el plan ya subió.
 *    El plan lo sube el webhook cuando Stripe confirma el cobro, y eso puede
 *    tardar unos segundos después de que el navegador regresa. Decir "¡listo,
 *    ya eres PRO!" y que la pantalla de arriba siga diciendo Gratis es
 *    exactamente el tipo de afirmación falsa que esta app ya pagó.
 *
 * 3. Un fallo al leer el estado se DICE, no se oculta: "no pudimos leer tu pago"
 *    y "no tienes pago" llevan a decisiones opuestas.
 */
function SeccionPago() {
  const [estado, setEstado] = useState<EstadoCobro | null>(null);
  const [error, setError] = useState(false);
  const [retorno, setRetorno] = useState<"ok" | "cancelado" | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // La sección se pinta DESPUÉS de leer el estado, así que el salto nativo al
  // `#pago` de la URL ya pasó cuando existe: se hace a mano en cuanto aparece.
  useEffect(() => {
    if (estado?.disponible && window.location.hash === "#pago") {
      document.getElementById("pago")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [estado]);

  useEffect(() => {
    // Se lee de `window` y no con `useSearchParams`: evita exigir un límite de
    // Suspense sólo para esto.
    const p = new URLSearchParams(window.location.search).get("pago");
    if (p === "ok" || p === "cancelado") setRetorno(p);

    let cancelado = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/billing/status`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as EstadoCobro;
        if (!cancelado) setEstado(data);
      } catch {
        if (!cancelado) setError(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function ir(ruta: "checkout" | "portal", tier?: string) {
    setOcupado(tier ?? ruta);
    setErrorAccion(null);
    try {
      const res = await authFetch(`${API_URL}/api/billing/${ruta}`, {
        method: "POST",
        body: JSON.stringify(tier ? { tier } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setErrorAccion(data.error || "No se pudo abrir el pago. Intenta de nuevo.");
        setOcupado(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErrorAccion("No se pudo abrir el pago. Intenta de nuevo.");
      setOcupado(null);
    }
  }

  if (error) {
    return (
      <section className="mb-6 p-4 bg-white border border-gray-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-600">
          No pudimos leer el estado de tu pago. Vuelve a cargar la página en un momento.
        </p>
      </section>
    );
  }
  if (!estado || !estado.disponible) return null;

  const sub = estado.suscripcion;
  const viva = sub && ["active", "trialing", "past_due", "incomplete", "unpaid"].includes(sub.status);

  // Baja AGENDADA: canceló, pero el periodo que ya pagó sigue corriendo. Es el
  // hueco de hasta 30 días de 04-PLAN §4, y es el único estado en el que decir
  // el plan a secas —«BÁSICO» o «GRATIS»— afirma algo falso.
  //
  // Sin `status !== 'canceled'` a propósito: `viva` (arriba) ya excluye
  // `canceled`, así que aquí sería código muerto. Quien impide que una
  // suscripción YA terminada diga «sigue activa hasta el <fecha pasada>» es
  // `extraerDatos()` en `cobro-webhook.ts`, que apaga `cancelAtPeriodEnd`
  // cuando el status es `canceled` — no esta línea. Si algún día se amplía
  // `viva`, hay que volver a mirar ESO, no agregar una guarda aquí creyendo que
  // ya estaba.
  const bajaAgendada = !!sub && sub.cancelAtPeriodEnd;
  const tierVigente =
    estado.tier && (DOCTOR_TIERS as readonly string[]).includes(estado.tier)
      ? (estado.tier as DoctorTier)
      : null;
  // Sin plan reconocible se dice «tu plan actual», no un nombre inventado.
  const nombreDelPlan = tierVigente ? TIER_LABELS[tierVigente] : "actual";

  return (
    // `id="pago"`: el ancla a la que llevan TODOS los avisos de tope y candado
    // (`VerPlanesLink`, TIERS 04 §12.6 #1). `scroll-mt` deja aire bajo el header.
    <section id="pago" className="mb-6 p-5 bg-white border border-gray-200 rounded-lg scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Pago de tu plan</h2>
        {estado.modo === "test" && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            Modo de prueba · sin cargos reales
          </span>
        )}
      </div>

      {retorno === "ok" && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
          <p className="font-medium">Stripe recibió tu pago.</p>
          <p className="mt-1 text-blue-800">
            Tu plan se actualiza en cuanto Stripe nos confirma el cobro, normalmente en unos
            segundos. Si arriba todavía no ves el cambio, actualiza la página.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard/cuenta")}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      )}
      {retorno === "cancelado" && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
          No se completó el pago y no se hizo ningún cargo.
        </div>
      )}

      {viva && sub && (
        <div className="text-sm">
          <p className="text-gray-900">
            Suscripción:{" "}
            {/* 🔴 `cancelAtPeriodEnd` MANDA sobre el status, igual que en el
                admin: Stripe deja en `active` una suscripción ya cancelada
                hasta que se acaba lo pagado, y pintar «Al corriente» en verde
                le afirmaría al doctor que sigue suscrito el día que ya se dio
                de baja. */}
            {bajaAgendada ? (
              <span className="text-amber-700 font-medium">Cancelada</span>
            ) : (
              <span className={sub.status === "active" ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                {ETIQUETA_STATUS[sub.status] ?? sub.status}
              </span>
            )}
          </p>
          {bajaAgendada ? (
            /* 04-PLAN §4. Decir sólo «Cancelada: termina el 17 de octubre» deja
               fuera las dos cosas por las que el doctor pregunta: qué conserva
               mientras tanto y a dónde cae ese día. Y «no hay reembolsos» se
               dice AQUÍ, donde todavía se puede reaccionar, no cuando reclame. */
            <div className="mt-1 text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
              {/* 🔴 NO dice «ese día tu cuenta pasa a GRATIS». Esa baja
                  automática está DECIDIDA pero NO construida (04-PLAN §6 D1, y
                  el hueco G1: la guarda de cupo hoy la rechazaría para quien
                  tenga más de 50 pacientes). Hoy el tier sólo lo mueve una
                  persona en el admin. Prometerle al doctor una fecha en la que
                  «su cuenta pasa a Gratis» sería afirmarle un hecho falso sobre
                  su propia cuenta — justo lo que esta pantalla existe para no
                  hacer. Lo que SÍ es cierto y automático es que la suscripción
                  termina y deja de cobrar: eso es lo que se dice.
                  Cuando D1 exista, aquí se agrega la frase del cambio de plan. */}
              <p>
                <strong>
                  Tu plan {nombreDelPlan} sigue activo hasta el{" "}
                  {fecha(sub.currentPeriodEnd) ?? "final del periodo pagado"}.
                </strong>
              </p>
              <p className="mt-1">
                Es el último día que pagaste: ese día termina tu suscripción y no se te hará ningún
                cargo más. Conservas toda tu información. No hay reembolsos por el tiempo restante.
              </p>
            </div>
          ) : (
            fecha(sub.currentPeriodEnd) && (
              <p className="text-gray-500 mt-1">Próximo cargo: {fecha(sub.currentPeriodEnd)}</p>
            )
          )}
          {sub.status === "past_due" && (
            <p className="text-amber-700 mt-1">
              No pudimos cobrar el último pago. Revisa tu tarjeta para no perder el servicio.
            </p>
          )}
        </div>
      )}

      {estado.puedeSuscribirse && estado.planes && (
        <div className="space-y-2">
          {sub?.status === "canceled" && (
            <p className="text-sm text-gray-500 mb-2">Tu suscripción anterior está cancelada.</p>
          )}
          {sub?.status === "incomplete" && (
            <p className="text-sm text-gray-500 mb-2">
              Tu intento de pago anterior no se completó y no se hizo ningún cargo. Puedes
              intentarlo de nuevo.
            </p>
          )}
          {estado.planes.map((plan) => (
            <div
              key={plan.tier}
              className="flex items-center justify-between gap-3 flex-wrap p-3 border border-gray-200 rounded-md"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">Plan {plan.label}</p>
                <p className="text-xs text-gray-500">{precio(plan.montoCentavos, plan.moneda, plan.intervalo)}</p>
              </div>
              <button
                disabled={ocupado !== null}
                onClick={() => ir("checkout", plan.tier)}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {ocupado === plan.tier ? "Abriendo…" : "Suscribirme"}
              </button>
            </div>
          ))}
        </div>
      )}

      {estado.tienePortal && (
        <button
          disabled={ocupado !== null}
          onClick={() => ir("portal")}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4" />
          {ocupado === "portal" ? "Abriendo…" : "Tarjeta, recibos y cancelación"}
        </button>
      )}

      {errorAccion && <p className="mt-3 text-sm text-red-600">{errorAccion}</p>}
    </section>
  );
}

/**
 * Un cupo. `tope === null` ⇒ sin límite, y se dice con palabras en vez de
 * pintar una barra llena al 0% que no significa nada.
 */
function Medidor({
  icono: Icono,
  titulo,
  usado,
  tope,
  formato,
  nota,
}: {
  icono: React.ElementType;
  titulo: string;
  usado: number;
  tope: number | null;
  formato: (n: number) => string;
  nota: string;
}) {
  const sinTope = tope === null;
  // `tope` puede ser 0 en teoría; dividir entre él daría Infinity y una barra rota.
  const porcentaje = sinTope || tope <= 0 ? 0 : Math.min(100, Math.round((usado / tope) * 100));
  const lleno = !sinTope && usado >= (tope ?? 0);
  const casiLleno = !sinTope && !lleno && porcentaje >= 80;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icono className="w-4 h-4 text-gray-400 shrink-0" />
        <p className="text-sm font-medium text-gray-900">{titulo}</p>
      </div>

      {sinTope ? (
        <p className="text-lg font-semibold text-gray-900">
          {formato(usado)}{" "}
          <span className="text-sm font-normal text-gray-500">· sin límite en tu plan</span>
        </p>
      ) : (
        <>
          <p
            className={`text-lg font-semibold ${
              lleno ? "text-amber-700" : "text-gray-900"
            }`}
          >
            {formato(usado)}{" "}
            <span className="text-sm font-normal text-gray-500">de {formato(tope)}</span>
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                lleno ? "bg-amber-500" : casiLleno ? "bg-amber-400" : "bg-blue-500"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          {lleno && (
            <p className="text-xs text-amber-700 mt-2">
              Llegaste al límite de tu plan.
            </p>
          )}
        </>
      )}

      <p className="flex items-start gap-1.5 text-xs text-gray-400 mt-2">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>{nota}</span>
      </p>
    </div>
  );
}
