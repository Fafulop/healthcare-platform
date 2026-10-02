"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { usePermissions } from "@/lib/permissions-client";
import { VENTAS_COMPRAS_TABS } from "@/lib/ventas-compras-nav";

/**
 * La barra «Ventas · Compras · Productos y Servicios» de arriba de las tres listas (el menú tiene un
 * solo botón, «Ventas/Compras»). Vive en `practice/layout.tsx` y no en cada página porque las tres
 * devuelven un spinner mientras cargan: pintada desde la página, la barra parpadearía en cada cambio.
 *
 * Sólo en las tres LISTAS: el detalle, «Nueva…», Cotizaciones, Proveedores y Datos Maestros tienen su
 * «Volver». Cada pestaña sigue la regla de los renglones del menú: sin el toggle no se pinta; excluida
 * por el PLAN, con candado (y la página destino enseña el aviso de upgrade).
 */
export function VentasComprasTabs() {
  const pathname = usePathname();
  const { can, lockedByTier } = usePermissions();

  if (!VENTAS_COMPRAS_TABS.some((t) => t.href === pathname)) return null;

  const visibles = VENTAS_COMPRAS_TABS.filter((t) => can(t.key) || lockedByTier(t.key));
  // Con una sola pestaña no hay nada que cambiar: la barra sólo ocuparía espacio.
  if (visibles.length < 2) return null;

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6">
      <nav className="flex gap-0 sm:gap-1 overflow-x-auto border-b border-gray-200 scrollbar-hide">
        {visibles.map((t) => {
          const activa = t.href === pathname;
          const bloqueada = !can(t.key);
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={activa ? "page" : undefined}
              title={bloqueada ? `${t.label} — no incluido en tu plan` : undefined}
              className={`-mb-px px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 inline-flex items-center gap-1.5 ${
                activa
                  ? "border-blue-600 text-blue-600"
                  : bloqueada
                    ? "border-transparent text-gray-400 hover:border-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="sm:hidden">{t.corto}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {bloqueada && <Lock className="w-3.5 h-3.5" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
