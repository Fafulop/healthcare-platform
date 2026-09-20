"use client";

/**
 * TIERS 04 §12.6 #6.2 — lo que ve una cuenta CONGELADA (dejó de pagar, venció el
 * margen de 15 días y su información no cabe en el plan Gratis).
 *
 * - El DUEÑO sólo ve «Mi Cuenta» con este aviso arriba: ahí paga y el webhook
 *   descongela la cuenta con toda su información. NO promete «como lo dejaste»:
 *   puede comprar un plan MENOR en el que quepa (#4) y quedarse en ese plan.
 * - Un MEMBER no puede abrir «Mi Cuenta» (es OWNER_ONLY): ve sólo el aviso y a
 *   quién pedírselo.
 *
 * «Descargar mi información» (#6.3) vive en Mi Cuenta (`#descargar`); el aviso
 * del dueño lo señala. Un member no lo ve: la descarga es sólo del titular.
 */

import { signOut } from "next-auth/react";
import { Snowflake, LogOut } from "lucide-react";

export function AvisoCuentaCongelada({ esDueno }: { esDueno: boolean }) {
  return (
    <section className="mb-6 p-5 bg-sky-50 border border-sky-200 rounded-lg">
      <div className="flex items-start gap-3">
        <Snowflake className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
        <div className="text-sm text-sky-900">
          <p className="font-semibold">Tu cuenta está congelada</p>
          <p className="mt-1">
            Tu suscripción terminó y tu información no cabe en el plan Gratis. Tus datos están
            intactos: no se borró nada.
          </p>
          <p className="mt-1">
            {esDueno
              ? "Para volver a usar tu cuenta, paga desde esta página. En cuanto se confirme el pago, tu cuenta se descongela con toda tu información. También puedes descargar tu información sin pagar, más abajo."
              : "Pídele al titular de la cuenta que la reactive desde «Mi Cuenta»."}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </section>
  );
}

export default AvisoCuentaCongelada;
