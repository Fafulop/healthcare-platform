"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, BarChart2, ChevronUp, ChevronDown } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

interface FeatureCounts {
  patients: number;
  encounters: number;
  prescriptions: number;
  tasks: number;
  articles: number;
  bookings: number;
  ledgerEntries: number;
  sales: number;
  purchases: number;
  clients: number;
  products: number;
  llmRequests: number;
  llmTotalTokens: number;
}

interface DoctorRow {
  slug: string;
  name: string;
  specialty: string;
  createdAt: string;
  counts: FeatureCounts;
}

type SortKey = "name" | keyof FeatureCounts;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; group: string }[] = [
  { key: "patients",      label: "Pacientes",    group: "EMR" },
  { key: "encounters",    label: "Consultas",     group: "EMR" },
  { key: "prescriptions", label: "Recetas",       group: "EMR" },
  { key: "tasks",         label: "Tareas",        group: "Tareas" },
  { key: "articles",      label: "Blog posts",    group: "Blog" },
  { key: "bookings",      label: "Citas",         group: "Citas" },
  { key: "ledgerEntries", label: "Movimientos",   group: "Admin" },
  { key: "sales",         label: "Ventas",        group: "Admin" },
  { key: "purchases",     label: "Compras",       group: "Admin" },
  { key: "clients",       label: "Clientes",      group: "Admin" },
  { key: "products",      label: "Productos",     group: "Admin" },
  { key: "llmRequests",   label: "Solicitudes IA", group: "IA" },
  { key: "llmTotalTokens", label: "Tokens IA",    group: "IA" },
];

const GROUP_COLORS: Record<string, string> = {
  EMR:    "bg-blue-50 text-blue-700",
  Tareas: "bg-yellow-50 text-yellow-700",
  Blog:   "bg-green-50 text-green-700",
  Citas:  "bg-teal-50 text-teal-700",
  Admin:  "bg-orange-50 text-orange-700",
  IA:     "bg-purple-50 text-purple-700",
};

function getValue(row: DoctorRow, key: SortKey): string | number {
  if (key === "name") return row.name;
  return row.counts[key as keyof FeatureCounts];
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 text-gray-300" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-blue-600" />
    : <ChevronDown className="w-3 h-3 text-blue-600" />;
}

export default function FeatureUsagePage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [data, setData] = useState<DoctorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/analytics/feature-usage`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = getValue(a, sortKey);
    const bv = getValue(b, sortKey);
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Uso de Funcionalidades</h1>
              <p className="text-gray-600 mt-0.5 text-sm">
                Conteo de registros por doctor — datos históricos totales
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4">
            {error}
            <button onClick={fetchData} className="ml-3 underline">
              Reintentar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Group header row */}
                <tr className="border-b">
                  <th className="px-4 py-2 text-left" rowSpan={2}>
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 font-medium text-gray-700 hover:text-blue-600"
                    >
                      Doctor
                      <SortIcon active={sortKey === "name"} dir={sortDir} />
                    </button>
                  </th>
                  {(["EMR", "Tareas", "Blog", "Citas", "Admin", "IA"] as const).map((group) => {
                    const cols = COLUMNS.filter((c) => c.group === group);
                    return (
                      <th
                        key={group}
                        colSpan={cols.length}
                        className={`px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide ${GROUP_COLORS[group]}`}
                      >
                        {group}
                      </th>
                    );
                  })}
                </tr>
                {/* Column header row */}
                <tr className="border-b bg-gray-50">
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center justify-end gap-1 w-full font-medium text-gray-600 hover:text-blue-600 whitespace-nowrap"
                      >
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 1}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Sin datos
                    </td>
                  </tr>
                ) : (
                  sorted.map((row) => (
                    <tr key={row.slug} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/analytics/doctor/${row.slug}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-gray-400">{row.specialty}</p>
                      </td>
                      {COLUMNS.map((col) => {
                        const val = row.counts[col.key as keyof FeatureCounts];
                        return (
                          <td
                            key={col.key}
                            className={`px-3 py-3 text-right tabular-nums ${
                              val === 0 ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {val.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
