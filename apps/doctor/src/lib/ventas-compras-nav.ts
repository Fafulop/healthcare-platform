"use client";

import { pagePermissionKey, type PermissionKey } from "@healthcare/database";
import { usePermissions } from "@/lib/permissions-client";

/**
 * «Ventas/Compras» (2026-10-02): Ventas, Compras y Productos y Servicios eran tres renglones del
 * menú; ahora son UNO, y las tres páginas comparten una barra de pestañas (`practice/layout.tsx`).
 * Las rutas, los permisos y los datos NO cambiaron: cada pestaña sigue siendo su página de siempre,
 * con su propio toggle (`ventas` · `compras` · `productos`). Este archivo es lo único que comparten
 * el Sidebar, el MobileDrawer y la barra, para que no se separen.
 */
export const VENTAS_COMPRAS_TABS: { key: PermissionKey; href: string; label: string; corto: string }[] = [
  { key: "ventas", href: "/dashboard/practice/ventas", label: "Ventas", corto: "Ventas" },
  { key: "compras", href: "/dashboard/practice/compras", label: "Compras", corto: "Compras" },
  { key: "productos", href: "/dashboard/practice/products", label: "Productos y Servicios", corto: "Productos" },
];

/**
 * La pestaña a la que pertenece una ruta, o null si no es de «Ventas/Compras». Sale de
 * `PAGE_PERMISSION_MAP` (vía `pagePermissionKey`), NO de una lista propia: así Cotizaciones,
 * Proveedores, Datos Maestros, Áreas, Atributos —y cualquier subpágina que se agregue al mapa con
 * una de las tres keys— encienden el botón sin tocar este archivo.
 */
function pestanaDe(pathname: string | null | undefined) {
  const key = pathname ? pagePermissionKey(pathname) : null;
  return VENTAS_COMPRAS_TABS.find((t) => t.key === key) ?? null;
}

export function esVentasCompras(pathname: string | null | undefined): boolean {
  return pestanaDe(pathname) !== null;
}

/**
 * Lo que necesita el botón del menú. Un renglón por permiso ya no sirve: el botón aparece si el
 * usuario tiene CUALQUIERA de las tres y abre la primera que sí puede ver (un ayudante con sólo
 * `productos` va directo a Productos, no a una Ventas que le daría «sin acceso»). Si ninguna está
 * concedida, no hay botón; si el PLAN las excluye todas, se pinta con candado (misma regla T4 que
 * los demás renglones). Hoy ningún tier excluye las tres keys, así que el candado no se ve.
 *
 * Estando YA en una de las tres, el botón lleva a la lista de ESA sección: re-picar el renglón
 * encendido desde Productos no debe aventarte a Ventas.
 */
export function useVentasComprasDestino(pathname: string | null | undefined): { href: string; bloqueado: boolean } | null {
  const { can, lockedByTier } = usePermissions();
  const actual = pestanaDe(pathname);
  if (actual && can(actual.key)) return { href: actual.href, bloqueado: false };
  const abierta = VENTAS_COMPRAS_TABS.find((t) => can(t.key));
  if (abierta) return { href: abierta.href, bloqueado: false };
  const conCandado = VENTAS_COMPRAS_TABS.find((t) => lockedByTier(t.key));
  if (conCandado) return { href: conCandado.href, bloqueado: true };
  return null;
}
