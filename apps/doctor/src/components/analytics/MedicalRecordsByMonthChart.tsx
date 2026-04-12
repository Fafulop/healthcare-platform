"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

interface MonthRow {
  month: string;
  patients: number;
  encounters: number;
  prescriptions: number;
}

interface StatsResponse {
  success: boolean;
  year: number;
  data: MonthRow[];
  availableYears: number[];
}

const SERIES = [
  { key: "patients"      as const, label: "Pacientes nuevos", color: "#14b8a6" },
  { key: "encounters"    as const, label: "Consultas",         color: "#3b82f6" },
  { key: "prescriptions" as const, label: "Recetas",           color: "#a855f7" },
];

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatMonth(monthKey: string): string {
  const [, m] = monthKey.split("-");
  return MONTH_LABELS[parseInt(m, 10) - 1] ?? monthKey;
}

export default function MedicalRecordsByMonthChart() {
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
      const res = await fetch(`/api/medical-records/stats?year=${y}`);
      const data: StatsResponse = await res.json();
      if (!data.success) throw new Error("Error al cargar");
      setRows(data.data);
      setAvailableYears(data.availableYears);
    } catch {
      setError("Error al cargar las estadísticas de expedientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(year); }, [year, fetchStats]);

  const formatted = rows.map((r) => ({ ...r, month: formatMonth(r.month) }));

  // Annual totals
  const totals = SERIES.map(({ key, label, color }) => ({
    label,
    color,
    total: rows.reduce((sum, r) => sum + r[key], 0),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Actividad de expedientes por mes</h3>
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
              <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
              {label}: {total}
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-52 sm:h-72">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-52 sm:h-72 text-red-500 text-sm">
          {error}
          <button onClick={() => fetchStats(year)} className="ml-2 underline">Reintentar</button>
        </div>
      ) : (
        <div className="h-52 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f3f4f6" }} />
              {SERIES.map(({ key, label, color }) => (
                <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
