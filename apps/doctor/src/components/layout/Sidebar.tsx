"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  User,
  FileText,
  Calendar,
  ExternalLink,
  LogOut,
  Users,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  Package,
  Video,
  CheckSquare,
  UserCog,
  BarChart3,
  HelpCircle,
} from "lucide-react";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

function NavItem({ icon: Icon, label, href, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
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
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo/Brand + User Info */}
      <div className="px-4 py-3 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">
              {session?.user?.name || "Portal Médico"}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {doctorProfile ? doctorProfile.primarySpecialty : session?.user?.email}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {doctorProfile && (
            <>
              <NavItem
                icon={UserCog}
                label="Editar Perfil"
                href="/dashboard/mi-perfil"
                active={pathname?.startsWith("/dashboard/mi-perfil")}
              />
              <a
                href={`${process.env.NEXT_PUBLIC_PUBLIC_URL || "http://localhost:3000"}/doctores/${doctorProfile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="text-sm font-medium">Perfil Público</span>
              </a>
            </>
          )}
          <NavItem
            icon={Video}
            label="Contenido Audiovisual"
            href="/dashboard/contenido-audiovisual"
            active={pathname?.startsWith("/dashboard/contenido-audiovisual")}
          />
          <NavItem
            icon={FileText}
            label="Mi Blog"
            href="/dashboard/blog"
            active={pathname?.startsWith("/dashboard/blog")}
          />
        </div>

        <hr className="my-3 border-gray-200" />

        <div className="space-y-1">
          <NavItem
            icon={Calendar}
            label="Mis Citas"
            href="/appointments"
            active={pathname === "/appointments"}
          />
          <NavItem
            icon={Users}
            label="Expedientes Médicos"
            href="/dashboard/medical-records"
            active={pathname?.startsWith("/dashboard/medical-records")}
          />
          <NavItem
            icon={CheckSquare}
            label="Pendientes"
            href="/dashboard/pendientes"
            active={pathname?.startsWith("/dashboard/pendientes")}
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
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100 w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
