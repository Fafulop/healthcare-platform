"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, CalendarDays } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface MonthRow {
  month: string;
  PENDING: number;
  CONFIRMED: number;
  COMPLETED: number;
  NO_SHOW: number;
  CANCELLED: number;
}

interface StatsResponse {
  success: boolean;
  year: number;
  data: MonthRow[];
  availableYears: number[];
}

const STATUS_CONFIG = [
  { key: "PENDING",   label: "Pendiente",  color: "#f59e0b" },
  { key: "CONFIRMED", label: "Agendada",   color: "#3b82f6" },
  { key: "COMPLETED", label: "Completada", color: "#22c55e" },
  { key: "NO_SHOW",   label: "No asistió", color: "#f97316" },
  { key: "CANCELLED", label: "Cancelada",  color: "#ef4444" },
] as const;

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatMonth(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return MONTH_LABELS[parseInt(m, 10) - 1] ?? monthKey;
}

export default function BookingsByMonthChart() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/bookings/stats?year=${y}`);
      const data: StatsResponse = await res.json();
      if (!data.success) throw new Error("Error al cargar");
      setRows(data.data);
      setAvailableYears(data.availableYears);
    } catch {
      setError("Error al cargar las estadísticas de citas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(year); }, [year, fetchStats]);

  const formatted = rows.map((r) => ({ ...r, month: formatMonth(r.month) }));

  // Total per status for the year
  const totals = STATUS_CONFIG.map(({ key, label, color }) => ({
    label,
    color,
    total: rows.reduce((sum, r) => sum + (r[key] ?? 0), 0),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Citas por estado y mes</h3>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary pills */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2 mb-5">
          {totals.map(({ label, color, total }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{ borderColor: color, color, backgroundColor: `${color}18` }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block shrink-0"
                style={{ backgroundColor: color }}
              />
              {label}: {total}
            </span>
          ))}
        </div>
      )}

      {/* Chart body */}
      {loading ? (
        <div className="flex items-center justify-center h-52 sm:h-72">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-52 sm:h-72 text-red-500 text-sm">
          {error}
          <button onClick={() => fetchStats(year)} className="ml-2 underline">
            Reintentar
          </button>
        </div>
      ) : (
        <div className="h-52 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                cursor={{ fill: "#f3f4f6" }}
              />
              {STATUS_CONFIG.map(({ key, label, color }) => (
                <Bar key={key} dataKey={key} name={label} stackId="a" fill={color} radius={key === "CANCELLED" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
