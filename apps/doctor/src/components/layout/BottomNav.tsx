"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Users,
  Calendar,
  FileText,
  Menu,
} from "lucide-react";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, href, active = false, onClick }: NavItemProps) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center py-2 px-3 flex-1 transition-colors ${
          active
            ? "text-blue-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">{label}</span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center py-2 px-3 flex-1 transition-colors ${
        active
          ? "text-blue-600"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

interface BottomNavProps {
  onMoreClick: () => void;
  isDrawerOpen: boolean;
}

export default function BottomNav({ onMoreClick, isDrawerOpen }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40">
      <div className="flex items-center justify-around safe-area-bottom">
        <NavItem
          icon={Home}
          label="Inicio"
          href="/dashboard"
          active={pathname === "/dashboard"}
        />
        <NavItem
          icon={Users}
          label="Pacientes"
          href="/dashboard/medical-records"
          active={pathname?.startsWith("/dashboard/medical-records")}
        />
        <NavItem
          icon={Calendar}
          label="Citas"
          href="/appointments"
          active={pathname === "/appointments"}
        />
        <NavItem
          icon={FileText}
          label="Blog"
          href="/dashboard/blog"
          active={pathname?.startsWith("/dashboard/blog")}
        />
        <NavItem
          icon={Menu}
          label="Más"
          href="#"
          active={isDrawerOpen}
          onClick={onMoreClick}
        />
      </div>
    </nav>
  );
}
