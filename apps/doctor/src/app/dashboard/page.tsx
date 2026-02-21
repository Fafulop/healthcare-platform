"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  DollarSign,
  CheckSquare,
  Sparkles,
  UserPlus,
  ShoppingCart,
  ShoppingBag,
  FileSpreadsheet,
  Clock,
  CalendarCheck,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import RecentActivityTable from "@/components/RecentActivityTable";
import { DayDetailsSection } from "@/components/day-details/DayDetailsSection";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function DoctorDashboardPage() {
  const { data: session } = useSession();
  const doctorId = session?.user?.doctorId;

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);
  const [ventasTotal, setVentasTotal] = useState<number | null>(null);
  const [activityCollapsed, setActivityCollapsed] = useState(true);

  const now = new Date();
  const monthName = now.toLocaleDateString("es-MX", { month: "long" });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  useEffect(() => {
    if (!doctorId) return;
    const fetchData = async () => {
      const [pendingRes, confirmedRes, ventasRes] = await Promise.all([
        authFetch(`${API_URL}/api/appointments/bookings?doctorId=${doctorId}&status=PENDING`),
        authFetch(`${API_URL}/api/appointments/bookings?doctorId=${doctorId}&status=CONFIRMED`),
        authFetch(`${API_URL}/api/practice-management/ventas?startDate=${startDate}&endDate=${endDate}`),
      ]);
      const [pendingData, confirmedData, ventasData] = await Promise.all([
        pendingRes.json(),
        confirmedRes.json(),
        ventasRes.json(),
      ]);
      if (pendingData.success) setPendingCount(pendingData.count);
      if (confirmedData.success) setConfirmedCount(confirmedData.count);
      if (ventasData.data) {
        const total = (ventasData.data as { total: string }[]).reduce(
          (sum, sale) => sum + parseFloat(sale.total || "0"),
          0
        );
        setVentasTotal(total);
      }
    };
    fetchData();
  }, [doctorId]);

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

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Link
          href="/appointments"
          className="bg-white rounded-lg shadow p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {pendingCount === null ? "—" : pendingCount}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Citas por confirmar</p>
          </div>
        </Link>
        <Link
          href="/appointments"
          className="bg-white rounded-lg shadow p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {confirmedCount === null ? "—" : confirmedCount}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Citas agendadas</p>
          </div>
        </Link>
        <Link
          href="/dashboard/practice/ventas"
          className="bg-white rounded-lg shadow p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {ventasTotal === null ? "—" : `$${ventasTotal.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Ventas {monthLabel}</p>
          </div>
        </Link>
      </div>

      {/* Detalles del día */}
      <DayDetailsSection />

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
                  <p className="font-medium text-gray-900">Registro Ingreso/Egreso</p>
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
        <button
          onClick={() => setActivityCollapsed(prev => !prev)}
          className="w-full flex items-center justify-between p-4 sm:p-6 text-left"
        >
          <h2 className="text-lg font-semibold text-gray-900">Actividad Reciente</h2>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${activityCollapsed ? "-rotate-90" : ""}`} />
        </button>
        {!activityCollapsed && (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <RecentActivityTable limit={10} />
          </div>
        )}
      </div>
    </div>
  );
}
