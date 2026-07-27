"use client";

/**
 * TIERS T4 — the screen a doctor sees INSTEAD of a feature their plan excludes.
 *
 * Why a screen and not a redirect/404 (01-DISENO §6.3): the server already
 * blocks the data with 403 TIER_EXCLUDED, so this is courtesy + conversion. The
 * doctor must learn WHY the section is inert; before T4 they saw the section,
 * clicked, and got an error with no explanation.
 *
 * Contact-based on purpose: there is no self-serve billing (§10 no-meta v1), so
 * "Upgrade" opens an email instead of a checkout.
 */

import { Lock, Mail } from "lucide-react";
import { PERMISSION_LABELS, type PermissionKey } from "@healthcare/database";

/**
 * Sales contact, from env so it is not hardcoded in a component. Absent ⇒ the
 * CTA is omitted rather than rendered broken: a dead "contact us" button is
 * worse than none, and the explanation above it is the part that matters.
 */
const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL ?? "";

function mailtoLink(featureLabel: string): string | null {
  if (!SALES_EMAIL) return null;
  const subject = `Activar ${featureLabel} en mi cuenta`;
  const body = `Hola, me interesa activar "${featureLabel}" en mi cuenta de TuSalud.`;
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function TierUpgradeNotice({ permissionKey }: { permissionKey: PermissionKey }) {
  const label = PERMISSION_LABELS[permissionKey] ?? "Esta función";
  const href = mailtoLink(label);

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
        Escríbenos y la activamos en tu cuenta.
      </p>
      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Escribir un correo
        </a>
      )}
    </div>
  );
}

export default TierUpgradeNotice;
