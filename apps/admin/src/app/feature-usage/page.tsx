"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, BarChart2, ChevronUp, ChevronDown } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { formatUsd } from "@/lib/format-usd";

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

interface FeatureDetail {
  key: string;
  label: string;
  requests: number;
  tokens: number;
}

interface DoctorRow {
  slug: string;
  name: string;
  specialty: string;
  createdAt: string;
  counts: FeatureCounts;
  /** solicitudes por función de IA. Llave de voz: "voice-transcribe:<pantalla>". */
  aiFeatures: Record<string, number>;
  aiFeatureDetail: FeatureDetail[];
  /** USD estimados a precios de hoy. null = algún modelo sin precio. */
  aiCostUsd: number | null;
}

interface FeatureMeta {
  key: string;
  label: string;
  category: string;
}

/** El endpoint ahora devuelve un objeto, no un arreglo: trae también el catálogo. */
interface FeatureUsageResponse {
  doctors: DoctorRow[];
  features: FeatureMeta[];
  voiceFeatureKeys: { key: string; label: string }[];
  unknownEndpoints: string[];
}

type SortKey = "name" | "aiCostUsd" | keyof FeatureCounts;
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
  { key: "aiCostUsd",     label: "Costo USD (est.)", group: "IA" },
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
  // null (sin precio) ordena como -1 para que no se confunda con $0 real.
  if (key === "aiCostUsd") return row.aiCostUsd ?? -1;
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

  const [data, setData] = useState<FeatureUsageResponse | null>(null);
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

  const doctors = data?.doctors ?? [];

  /**
   * Columnas de la matriz de IA: SOLO las funciones con uso real (hoy ~15 de 19),
   * ordenadas por total de solicitudes. Meter las 19 siempre dejaría media tabla en
   * ceros y taparía lo que sí se usa.
   */
  const aiColumns = (() => {
    const totals = new Map<string, { label: string; total: number }>();
    const labelOf = new Map<string, string>([
      ...(data?.features ?? []).map((f) => [f.key, f.label] as [string, string]),
      ...(data?.voiceFeatureKeys ?? []).map((f) => [f.key, f.label] as [string, string]),
    ]);
    for (const d of doctors) {
      for (const [key, n] of Object.entries(d.aiFeatures)) {
        const prev = totals.get(key);
        totals.set(key, { label: labelOf.get(key) ?? key, total: (prev?.total ?? 0) + n });
      }
    }
    return [...totals.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);
  })();

  const sorted = [...doctors].sort((a, b) => {
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
                        if (col.key === "aiCostUsd") {
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-3 text-right tabular-nums ${
                                row.aiCostUsd === null ? "text-gray-400 italic" : "text-emerald-700 font-medium"
                              }`}
                            >
                              {formatUsd(row.aiCostUsd)}
                            </td>
                          );
                        }
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

        {/* ── Matriz: QUÉ función de IA usa cada doctor ───────────────────────
            La pregunta que esta sección contesta es "¿usa la voz en notas o en
            plantillas?", que la columna "Solicitudes IA" no puede contestar
            porque suma todo en un número. */}
        {!isLoading && !error && aiColumns.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-purple-50">
              <h2 className="font-semibold text-purple-900">Uso de IA por función</h2>
              <p className="text-xs text-purple-700 mt-0.5">
                Solicitudes por doctor y función. Sólo se listan las funciones con uso real.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Doctor</th>
                    {aiColumns.map((c) => (
                      <th
                        key={c.key}
                        className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap"
                        title={c.key}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((row) => (
                    <tr key={row.slug} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                        {row.name}
                      </td>
                      {aiColumns.map((c) => {
                        const n = row.aiFeatures[c.key] ?? 0;
                        return (
                          <td
                            key={c.key}
                            className={`px-3 py-3 text-right tabular-nums ${
                              n === 0 ? "text-gray-200" : "text-gray-800 font-medium"
                            }`}
                          >
                            {n === 0 ? "·" : n.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500 space-y-1">
              <p>
                🎤 <strong>La voz se abre por pantalla</strong> desde el 2026-08-27. Las
                transcripciones anteriores aparecen como{" "}
                <em>&quot;Transcripción de voz (origen desconocido)&quot;</em>: el dato de qué
                pantalla las originó no se guardaba, y no es recuperable hacia atrás.
              </p>
              <p>
                Las filas de voz pesan <strong>0 tokens</strong> (Whisper se cobra por minuto),
                así que la columna &quot;Tokens IA&quot; de arriba no las cuenta — pero
                &quot;Costo USD&quot; sí.
              </p>
              {data?.unknownEndpoints?.length ? (
                <p className="text-amber-700">
                  ⚠️ Endpoints sin etiqueta (agrégalos a <code>llm-features.ts</code>):{" "}
                  {data.unknownEndpoints.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
