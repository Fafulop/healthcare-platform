"use client";

/**
 * TIERS Q2b — el candado de las FUNCIONES DE IA (key de tier `ia`).
 *
 * Por qué no se reusa `TierUpgradeNotice`: ese componente reemplaza la PÁGINA
 * entera, y funciona porque cada función excluida hasta ahora era una SECCIÓN
 * (Facturación, Descarga SAT) con su propia ruta — `PermissionGate` la caza por
 * el pathname. La IA no es una sección: son ~26 controles sueltos DENTRO de
 * páginas que el plan sí incluye. Un micrófono no tiene destino al que navegar,
 * así que necesita su propio tratamiento: el control se queda, apagado y con
 * candado, y explica en un diálogo por qué.
 *
 * Decisión de producto (usuario, 2026-09-13, plan §9.2): candado + CTA solo en
 * las DOS puertas más visibles (el hub de voz y el micrófono de notas); el resto
 * de las puertas de IA se OCULTAN. La política de ocultar es la de T4 para
 * botones sueltos; el candado es el mejor upsell del producto porque el dictado
 * es la función de IA más usada.
 */

import { useState } from "react";
import { Lock, Mail, X } from "lucide-react";
import { usePermissions } from "@/lib/permissions-client";

/**
 * Contacto de ventas. Con FALLBACK fijo a propósito (mismo patrón y misma
 * dirección que `apps/public/src/lib/product-content.ts`): es
 * `NEXT_PUBLIC_*`, se hornea en el BUILD, y al 2026-09-13 **no está puesta en
 * Railway**. Sin fallback, el diálogo diría "Escríbenos y las activamos" sin
 * ningún modo de escribir — un callejón sin salida, peor que ocultar la
 * puerta. Hallazgo del review de Q2b.
 */
const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || "hola@tusalud.pro";

const SUBJECT = "Activar las funciones de IA en mi cuenta";
const BODY =
  "Hola, me interesa activar las funciones de IA (dictado por voz y los chats que llenan formularios) en mi cuenta.";

function mailtoLink(): string | null {
  if (!SALES_EMAIL) return null;
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
}

/**
 * El estado del candado de IA para UNA puerta.
 *
 * - `locked`: el PLAN no incluye IA y este usuario sí podría usarla si el plan
 *   cambiara ⇒ candado + CTA. Para un MEMBER siempre es false (su set de
 *   permisos nunca trae `ia`), así que ve las puertas ocultas, nunca con
 *   candado: no puede comprar el upgrade y nombrárselo solo confundiría.
 * - `allowed`: puede usarla ⇒ render normal.
 * - Ninguna de las dos ⇒ no renderizar nada.
 */
export function useAiLock() {
  const { can, lockedByTier, loading } = usePermissions();
  const [upsellOpen, setUpsellOpen] = useState(false);

  // 🔴 Mientras la sesión CARGA no se afirma nada. `permissions-client` hace
  // fail-open por diseño (`isOwner ?? true`, `tier ?? FALLBACK_TIER`, y PRO no
  // excluye nada), así que sin este `!loading` el micrófono se pintaría
  // ENCENDIDO en esa ventana: el doctor aprieta, el navegador abre el micrófono
  // DE VERDAD y graba audio del consultorio… para recibir un 403 al soltar.
  // Ni permitido ni bloqueado ⇒ la puerta no se pinta hasta saber cuál es.
  // Hallazgo del review de Q2b.
  return {
    loading,
    locked: !loading && lockedByTier("ia"),
    allowed: !loading && can("ia"),
    upsellOpen,
    openUpsell: () => setUpsellOpen(true),
    closeUpsell: () => setUpsellOpen(false),
  };
}

/** Diálogo compartido por todas las puertas con candado. */
export function AiUpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const href = mailtoLink();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Lock className="h-7 w-7 text-amber-500" />
        </div>

        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          Las funciones de IA no están en tu plan
        </h2>
        <p className="mx-auto mb-1 max-w-xs text-sm text-gray-500">
          El dictado por voz y los chats que llenan formularios no están incluidos. Todo lo demás de
          tu cuenta sigue igual.
        </p>
        <p className="mx-auto mb-6 max-w-xs text-sm text-gray-500">
          Escríbenos y las activamos.
        </p>

        {href && (
          <a
            href={href}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Mail className="h-4 w-4" />
            Escribir un correo
          </a>
        )}
      </div>
    </div>
  );
}

export default AiUpgradeDialog;
