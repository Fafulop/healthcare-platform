"use client";

/**
 * TIERS T4 — the screen a doctor sees INSTEAD of a feature their plan excludes.
 *
 * Why a screen and not a redirect/404 (01-DISENO §6.3): the server already
 * blocks the data with 403 TIER_EXCLUDED, so this is courtesy + conversion. The
 * doctor must learn WHY the section is inert; before T4 they saw the section,
 * clicked, and got an error with no explanation.
 *
 * TIERS 04 §12.6 #1: the CTA used to be a `mailto:` built from
 * NEXT_PUBLIC_SALES_EMAIL — which is not set in Railway, so the button never
 * rendered and the doctor hit a dead end. Self-serve billing exists now (C3):
 * the way out is «Mi Cuenta» → pagar (rule R2), never an email.
 */

import { Lock } from "lucide-react";
import { TIER_KEY_LABELS, type TierKey } from "@healthcare/database";
import { VerPlanesLink } from "./VerPlanesLink";

// TierKey (no PermissionKey): un tier puede excluir `ia`/`whatsapp`, que no son
// toggles de member pero sí tienen pantalla de plan.
export function TierUpgradeNotice({ permissionKey }: { permissionKey: TierKey }) {
  const label = TIER_KEY_LABELS[permissionKey] ?? "Esta función";

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {label} no está incluido en tu plan
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-1">
        Tu plan actual no incluye esta sección. Tus datos siguen intactos: si
        activas esta función, todo reaparece tal como estaba.
      </p>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Para activarla, cambia de plan.
      </p>
      <VerPlanesLink />
    </div>
  );
}

export default TierUpgradeNotice;
