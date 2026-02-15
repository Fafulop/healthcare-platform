"use client";

import { useSession } from "next-auth/react";
import {
  Calendar,
  Users,
  ClipboardList,
  Heart,
  DollarSign,
  CheckSquare,
  Sparkles,
  UserPlus,
  ShoppingCart,
  ShoppingBag,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import RecentActivityTable from "@/components/RecentActivityTable";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor: string;
  iconBg: string;
}

function StatCard({ icon: Icon, label, value, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          ¡Bienvenido de vuelta, {session?.user?.name?.split(' ')[0] || 'Doctor'}!
        </h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          Esto es lo que está pasando en tu consultorio hoy
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
        <StatCard
          icon={Users}
          label="Total de Pacientes"
          value="—"
          iconColor="#2563eb"
          iconBg="#dbeafe"
        />
        <StatCard
          icon={Calendar}
          label="Citas de Hoy"
          iconColor="#10b981"
          iconBg="#d1fae5"
          value="—"
        />
        <StatCard
          icon={ClipboardList}
          label="Consultas Pendientes"
          value="—"
          iconColor="#f59e0b"
          iconBg="#fef3c7"
        />
        <StatCard
          icon={DollarSign}
          label="Ingresos Este Mes"
          value="—"
          iconColor="#8b5cf6"
          iconBg="#ede9fe"
        />
      </div>

      {/* Acciones Rápidas - Chat IA */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h2>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/dashboard/medical-records/patients/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Crear Paciente</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Registrar con Chat IA</p>
              </div>
            </Link>

            <Link
              href="/dashboard/pendientes/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Nuevo Pendiente</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Crear tarea con Chat IA</p>
              </div>
            </Link>

            <Link
              href="/dashboard/practice/flujo-de-dinero/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Movimiento de Efectivo</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Registrar ingreso o egreso</p>
              </div>
            </Link>

            <Link
              href="/dashboard/practice/ventas/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Nueva Venta</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Registrar venta con Chat IA</p>
              </div>
            </Link>

            <Link
              href="/dashboard/practice/cotizaciones/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Nueva Cotización</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Crear cotización con Chat IA</p>
              </div>
            </Link>

            <Link
              href="/dashboard/practice/compras/new?chat=true"
              className="flex items-center gap-3 p-3 sm:p-4 border border-indigo-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-gray-900">Nueva Compra</p>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <p className="text-sm text-gray-600 hidden sm:block">Registrar compra con Chat IA</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Actividad Reciente</h2>
        </div>
        <div className="p-4 sm:p-6">
          <RecentActivityTable limit={10} />
        </div>
      </div>
    </div>
  );
}
