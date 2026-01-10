"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import {
  User,
  Stethoscope,
  Calendar,
  ExternalLink,
  LogOut,
  Loader2,
  FileText,
  Briefcase,
  Package,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  Users,
  ClipboardList,
  Heart,
  BarChart3
} from "lucide-react";
import Link from "next/link";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
  city: string;
  heroImage: string;
  shortBio: string;
  yearsExperience: number;
  clinicPhone: string;
  clinicWhatsapp: string;
}

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
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100'
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
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor: string;
  iconBg: string;
}

function StatCard({ icon: Icon, label, value, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-6 h-6" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboardPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Doctor Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Medical Platform</p>
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
            <NavItem icon={FileText} label="My Blog" href="/dashboard/blog" />
            <NavItem icon={Calendar} label="Appointments" href="/appointments" />
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
              active={true}
            />
            <NavItem
              icon={ClipboardList}
              label="New Encounter"
              href="/dashboard/medical-records"
            />
            <NavItem
              icon={BarChart3}
              label="Reports"
              href="/dashboard/medical-records"
            />
          </NavGroup>

          <NavGroup title="Practice Management">
            <NavItem
              icon={Package}
              label="Products"
              href="/dashboard/practice/products"
            />
            <NavItem
              icon={DollarSign}
              label="Cash Flow"
              href="/dashboard/practice/flujo-de-dinero"
            />
            <NavItem
              icon={ShoppingCart}
              label="Sales"
              href="/dashboard/practice/ventas"
            />
            <NavItem
              icon={ShoppingBag}
              label="Purchases"
              href="/dashboard/practice/compras"
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {session?.user?.name?.split(' ')[0] || 'Doctor'}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your practice today
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              icon={Users}
              label="Total Patients"
              value="—"
              iconColor="#2563eb"
              iconBg="#dbeafe"
            />
            <StatCard
              icon={Calendar}
              label="Appointments Today"
              iconColor="#10b981"
              iconBg="#d1fae5"
              value="—"
            />
            <StatCard
              icon={ClipboardList}
              label="Pending Encounters"
              value="—"
              iconColor="#f59e0b"
              iconBg="#fef3c7"
            />
            <StatCard
              icon={DollarSign}
              label="Revenue This Month"
              value="—"
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/dashboard/medical-records/patients/new"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">New Patient</p>
                    <p className="text-sm text-gray-600">Add patient record</p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/medical-records"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">New Encounter</p>
                    <p className="text-sm text-gray-600">Create consultation</p>
                  </div>
                </Link>

                <Link
                  href="/appointments"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Schedule</p>
                    <p className="text-sm text-gray-600">Manage appointments</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity Placeholder */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="text-center py-8 text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No recent activity to display</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
