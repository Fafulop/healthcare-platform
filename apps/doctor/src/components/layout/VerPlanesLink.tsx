"use client";

/**
 * TIERS 04 §12.6 #1 — la ÚNICA salida de todo tope o candado del plan.
 *
 * Regla R2 (usuario, 2026-09-18): todo aviso de tope o de función no incluida
 * lleva a «Mi Cuenta» → pagar. Nunca a un correo. Antes cada aviso tenía su
 * propia salida —un `mailto:` que no se pintaba porque la variable no está
 * puesta, un correo fijo, o ninguna— y el doctor que chocaba con el límite no
 * tenía a dónde ir.
 *
 * Mi Cuenta es OWNER_ONLY: un member que llegara ahí vería «sólo del titular».
 * Por eso a él no se le da el botón sino la frase de a quién pedírselo.
 */

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { usePermissions } from "@/lib/permissions-client";

/** El ancla de la sección «Pago de tu plan» en `/dashboard/cuenta`. */
export const HREF_PAGO_DEL_PLAN = "/dashboard/cuenta#pago";

export function VerPlanesLink({ className = "" }: { className?: string }) {
  const { isOwner, loading } = usePermissions();
  if (loading) return null;

  if (!isOwner) {
    return (
      <p className={`text-sm text-gray-500 ${className}`}>
        Pídele al titular de la cuenta que cambie de plan.
      </p>
    );
  }

  return (
    <Link
      href={HREF_PAGO_DEL_PLAN}
      className={`inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 ${className}`}
    >
      <CreditCard className="h-4 w-4" />
      Ver planes
    </Link>
  );
}

export default VerPlanesLink;
