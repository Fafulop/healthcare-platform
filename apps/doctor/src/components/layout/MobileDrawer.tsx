"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  User,
  ExternalLink,
  LogOut,
  Package,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  BarChart3,
  X,
  Users,
  Truck,
  FileText,
} from "lucide-react";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, href, active = false, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavGroup({ title, children }: NavGroupProps) {
  return (
    <div className="py-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-4">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  doctorProfile?: {
    slug: string;
    primarySpecialty: string;
  } | null;
}

export default function MobileDrawer({ isOpen, onClose, doctorProfile }: MobileDrawerProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 lg:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menú</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {session?.user?.name || "Doctor"}
              </p>
              {doctorProfile ? (
                <p className="text-xs text-gray-500 truncate">
                  {doctorProfile.primarySpecialty}
                </p>
              ) : (
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <NavGroup title="Gestión de Consultorio">
            <NavItem
              icon={Users}
              label="Clientes"
              href="/dashboard/practice/clients"
              active={pathname?.startsWith("/dashboard/practice/clients")}
              onClick={onClose}
            />
            <NavItem
              icon={Package}
              label="Productos"
              href="/dashboard/practice/products"
              active={pathname?.startsWith("/dashboard/practice/products")}
              onClick={onClose}
            />
            <NavItem
              icon={ShoppingCart}
              label="Ventas"
              href="/dashboard/practice/ventas"
              active={pathname?.startsWith("/dashboard/practice/ventas")}
              onClick={onClose}
            />
            <NavItem
              icon={FileText}
              label="Cotizaciones"
              href="/dashboard/practice/cotizaciones"
              active={pathname?.startsWith("/dashboard/practice/cotizaciones")}
              onClick={onClose}
            />
            <NavItem
              icon={ShoppingBag}
              label="Compras"
              href="/dashboard/practice/compras"
              active={pathname?.startsWith("/dashboard/practice/compras")}
              onClick={onClose}
            />
            <NavItem
              icon={Truck}
              label="Proveedores"
              href="/dashboard/practice/proveedores"
              active={pathname?.startsWith("/dashboard/practice/proveedores")}
              onClick={onClose}
            />
            <NavItem
              icon={DollarSign}
              label="Flujo de Dinero"
              href="/dashboard/practice/flujo-de-dinero"
              active={pathname?.startsWith("/dashboard/practice/flujo-de-dinero")}
              onClick={onClose}
            />
            <NavItem
              icon={BarChart3}
              label="Reportes"
              href="/dashboard/practice/reports"
              active={pathname?.startsWith("/dashboard/practice/reports")}
              onClick={onClose}
            />
          </NavGroup>

          {doctorProfile && (
            <NavGroup title="Externo">
              <a
                href={`http://localhost:3000/doctors/${doctorProfile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="text-sm font-medium">Perfil Público</span>
              </a>
            </NavGroup>
          )}
        </nav>

        {/* Cerrar Sesión */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {
              onClose();
              signOut({ callbackUrl: "/login" });
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-md text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}
