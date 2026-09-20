"use client";

import { useState } from "react";
import { CONCILIACION_BANCARIA_VISIBLE } from "@/lib/ui-visibility";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { pagePermissionKey } from "@healthcare/database";
import { usePermissions } from "@/lib/permissions-client";
import {
  User,
  Calendar,
  LogOut,
  Users,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  Package,
  CheckSquare,
  NotebookPen,
  UserCog,
  BarChart3,
  CreditCard,
  HelpCircle,
  Receipt,
  Download,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Wallet,
} from "lucide-react";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

function NavItem({ icon: Icon, label, href, active = false }: NavItemProps) {
  // Secondary users: hide sections their toggles don't allow (UI courtesy —
  // the API check is the real boundary). Key derives from the href via the
  // shared PAGE_PERMISSION_MAP, so no per-item wiring.
  const { can, lockedByTier } = usePermissions();
  const permKey = pagePermissionKey(href);

  // TIERS T4 — the two ceilings render OPPOSITE ways (01-DISENO §6): a section
  // the PLAN excludes stays visible with a padlock (the account can buy it), a
  // section the OWNER didn't grant disappears. `lockedByTier` is already false
  // when both apply, so a member never gets an upsell they can't act on.
  if (permKey && lockedByTier(permKey)) {
    // Deviation from §6.2 ("item deshabilitado"), deliberate: a dead item makes
    // the upgrade CTA reachable only by typing the URL, which defeats the point
    // of T4. It stays a LINK — muted and padlocked so it reads as unavailable —
    // and the destination renders TierUpgradeNotice via PermissionGate. The
    // server still returns 403 TIER_EXCLUDED for the data, so nothing leaks.
    return (
      <Link
        href={href}
        title={`${label} — no incluido en tu plan`}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-400 hover:bg-gray-50 transition-colors group-data-[collapsed]:justify-center group-data-[collapsed]:px-2"
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="text-sm font-medium group-data-[collapsed]:hidden">{label}</span>
        <Lock className="w-3.5 h-3.5 shrink-0 ml-auto group-data-[collapsed]:hidden" />
      </Link>
    );
  }

  if (permKey && !can(permKey)) return null;

  return (
    <Link
      href={href}
      title={label}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors group-data-[collapsed]:justify-center group-data-[collapsed]:px-2 ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium group-data-[collapsed]:hidden">{label}</span>
    </Link>
  );
}

interface SidebarProps {
  doctorProfile?: {
    slug: string;
    primarySpecialty: string;
  } | null;
}

export default function Sidebar({ doctorProfile }: SidebarProps) {
  const { data: session } = useSession();
  const { isOwner } = usePermissions();
  const pathname = usePathname();
  // Icons-only mode so the content gets the width back (e.g. with the
  // assistant panel docked). Same persistence pattern as widgetsCollapsed.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <aside
      // data-collapsed drives the group-data-[collapsed] variants below —
      // labels hide and items center without threading a prop through them
      data-collapsed={collapsed || undefined}
      className={`group h-screen bg-white border-r border-gray-200 flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo/Brand + User Info */}
      <div className="px-4 py-3 border-b border-gray-200 group-data-[collapsed]:px-2">
        <Link href="/dashboard" className="flex items-center gap-2.5 group-data-[collapsed]:justify-center">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
          )}
          <div className="flex-1 min-w-0 group-data-[collapsed]:hidden">
            <h1 className="text-sm font-bold text-gray-900 truncate">
              {session?.user?.name || "Portal Médico"}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {doctorProfile ? doctorProfile.primarySpecialty : session?.user?.email}
            </p>
          </div>
        </Link>
      </div>

      {/* Collapse/expand toggle */}
      <div className={`px-3 pt-2 flex ${collapsed ? "justify-center" : "justify-end"}`}>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Mostrar etiquetas" : "Ocultar etiquetas (solo iconos)"}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {/* TIERS C1 — el plan de la cuenta. Sólo el DUEÑO: es información
              comercial suya (y con C3, dinero que debe), igual que la ruta
              /api/account, que es OWNER_ONLY. No pasa por NavItem+permKey a
              propósito: esta página NO está en PAGE_PERMISSION_MAP —así ningún
              tier puede bloquear la pantalla que explica los tiers—, y sin key
              NavItem la mostraría también a los usuarios secundarios.

              Va ARRIBA DEL TODO, encima de «Perfil Público»: es por donde se
              paga, se ve el consumo y se descarga la información, y desde
              abajo del menú no se encontraba. */}
          {isOwner && (
            <NavItem
              icon={Wallet}
              label="Mi Cuenta"
              href="/dashboard/cuenta"
              active={pathname?.startsWith("/dashboard/cuenta")}
            />
          )}
          {/* Una sola entrada: la de EDITAR. El enlace «ver mi perfil público»
              vivía aquí al lado, suelto, y pertenece al flujo de edición —es el
              resultado de lo que se edita—, así que ahora vive DENTRO de
              /dashboard/mi-perfil.

              ⚠️ OJO: eso deja el toggle `perfil_publico` SIN EFECTO. La página
              que ahora lo contiene exige `perfil`, así que a un member con
              `perfil_publico` pero sin `perfil` no le queda ningún camino para
              ver el perfil público. Está anotado en NUEVOS USUARIOS para
              decidirlo; NO es «el mismo permiso que antes». */}
          {doctorProfile && (
            <NavItem
              icon={UserCog}
              label="Perfil Público"
              href="/dashboard/mi-perfil"
              active={pathname?.startsWith("/dashboard/mi-perfil")}
            />
          )}
          {/* Contenido Audiovisual y Mi Blog se fueron a «Perfil Publico»
              como pestanas (2026-09-20): los dos SON perfil publico. Sus rutas
              `/dashboard/blog` y `/dashboard/contenido-audiovisual` siguen
              vivas —la pestana esta detras del toggle `perfil`, y un member con
              `blog` pero sin `perfil` necesita llegar por URL—, pero ya no
              ocupan un renglon del menu. */}
        </div>

        <hr className="my-3 border-gray-200" />

        <div className="space-y-1">
          <NavItem
            icon={Calendar}
            label="Mis Citas"
            href="/dashboard/appointments"
            active={pathname?.startsWith("/dashboard/appointments")}
          />
          <NavItem
            icon={Users}
            label="Expedientes Médicos"
            href="/dashboard/medical-records"
            active={pathname?.startsWith("/dashboard/medical-records")}
          />
          <NavItem
            icon={CheckSquare}
            label="Tareas"
            href="/dashboard/pendientes"
            active={pathname?.startsWith("/dashboard/pendientes")}
          />
          <NavItem
            icon={NotebookPen}
            label="Notas"
            href="/dashboard/notas"
            active={pathname?.startsWith("/dashboard/notas")}
          />
          <NavItem
            icon={BarChart3}
            label="Reportes"
            href="/dashboard/reportes"
            active={pathname?.startsWith("/dashboard/reportes")}
          />
        </div>

        <hr className="my-3 border-gray-200" />

        <div className="space-y-1">
          <NavItem
            icon={DollarSign}
            label="Flujo de Dinero"
            href="/dashboard/practice/flujo-de-dinero"
            active={pathname?.startsWith("/dashboard/practice/flujo-de-dinero")}
          />
          <NavItem
            icon={CreditCard}
            label="Pagos"
            href="/dashboard/pagos"
            active={pathname?.startsWith("/dashboard/pagos")}
          />
          <NavItem
            icon={Receipt}
            label="Facturación"
            href="/dashboard/facturacion"
            active={pathname?.startsWith("/dashboard/facturacion")}
          />
          <NavItem
            icon={Download}
            label="Descarga SAT"
            href="/dashboard/sat-descarga"
            active={pathname?.startsWith("/dashboard/sat-descarga")}
          />
          {CONCILIACION_BANCARIA_VISIBLE && (
            <NavItem
              icon={Landmark}
              label="Conciliación Bancaria"
              href="/dashboard/practice/conciliacion-bancaria"
              active={pathname?.startsWith("/dashboard/practice/conciliacion-bancaria")}
            />
          )}
          <NavItem
            icon={ShoppingCart}
            label="Ventas"
            href="/dashboard/practice/ventas"
            active={pathname?.startsWith("/dashboard/practice/ventas")}
          />
          <NavItem
            icon={ShoppingBag}
            label="Compras"
            href="/dashboard/practice/compras"
            active={pathname?.startsWith("/dashboard/practice/compras")}
          />
          <NavItem
            icon={Package}
            label="Productos y Servicios"
            href="/dashboard/practice/products"
            active={pathname?.startsWith("/dashboard/practice/products")}
          />
          <NavItem
            icon={HelpCircle}
            label="Ayuda"
            href="/dashboard/ayuda"
            active={pathname?.startsWith("/dashboard/ayuda")}
          />
        </div>
      </nav>

      {/* Cerrar Sesión */}
      <div className="p-4 border-t border-gray-200 group-data-[collapsed]:p-2">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar Sesión"
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100 w-full group-data-[collapsed]:justify-center group-data-[collapsed]:px-2"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium group-data-[collapsed]:hidden">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
