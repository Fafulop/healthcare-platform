"use client";

import { useSession } from "next-auth/react";
import {
  Calendar,
  Users,
  ClipboardList,
  Heart,
  DollarSign,
  CheckSquare,
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

      {/* Acciones Rápidas */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Acciones Rápidas</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Link
              href="/dashboard/medical-records/patients/new"
              className="flex items-center gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Nuevo Paciente</p>
                <p className="text-sm text-gray-600 hidden sm:block">Agregar expediente</p>
              </div>
            </Link>

            <Link
              href="/dashboard/medical-records"
              className="flex items-center gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Nueva Consulta</p>
                <p className="text-sm text-gray-600 hidden sm:block">Crear consulta</p>
              </div>
            </Link>

            <Link
              href="/appointments"
              className="flex items-center gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Agenda</p>
                <p className="text-sm text-gray-600 hidden sm:block">Gestionar citas</p>
              </div>
            </Link>

            <Link
              href="/dashboard/pendientes/new"
              className="flex items-center gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <CheckSquare className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Nueva Pendiente</p>
                <p className="text-sm text-gray-600 hidden sm:block">Crear tarea</p>
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
