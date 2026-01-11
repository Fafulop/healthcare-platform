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
  ClipboardList,
  BarChart3,
  Package,
  DollarSign,
  ShoppingCart,
  ShoppingBag,
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

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavGroup({ title, children }: NavGroupProps) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/dashboard">
          <h1 className="text-xl font-bold text-gray-900">Doctor Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Medical Platform</p>
        </Link>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
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
      <nav className="flex-1 overflow-y-auto p-4">
        <NavGroup title="Profile & Public">
          <NavItem icon={FileText} label="My Blog" href="/dashboard/blog" active={pathname === "/dashboard/blog"} />
          <NavItem icon={Calendar} label="Appointments" href="/appointments" active={pathname === "/appointments"} />
          {doctorProfile && (
            <a
              href={`http://localhost:3000/doctors/${doctorProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="text-sm font-medium">Public Profile</span>
            </a>
          )}
        </NavGroup>

        <NavGroup title="Medical Records">
          <NavItem
            icon={Users}
            label="Patient Records"
            href="/dashboard/medical-records"
            active={pathname?.startsWith("/dashboard/medical-records")}
          />
          <NavItem
            icon={ClipboardList}
            label="New Encounter"
            href="/dashboard/medical-records"
          />
          <NavItem icon={BarChart3} label="Reports" href="/dashboard/medical-records" />
        </NavGroup>

        <NavGroup title="Practice Management">
          <NavItem
            icon={Package}
            label="Products"
            href="/dashboard/practice/products"
            active={pathname?.startsWith("/dashboard/practice/products")}
          />
          <NavItem
            icon={DollarSign}
            label="Cash Flow"
            href="/dashboard/practice/flujo-de-dinero"
            active={pathname?.startsWith("/dashboard/practice/flujo-de-dinero")}
          />
          <NavItem
            icon={ShoppingCart}
            label="Sales"
            href="/dashboard/practice/ventas"
            active={pathname?.startsWith("/dashboard/practice/ventas")}
          />
          <NavItem
            icon={ShoppingBag}
            label="Purchases"
            href="/dashboard/practice/compras"
            active={pathname?.startsWith("/dashboard/practice/compras")}
          />
        </NavGroup>
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100 w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
