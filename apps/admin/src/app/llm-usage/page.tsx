"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Bot, Zap, MessageSquare, Users, ChevronDown, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

type Range = "7d" | "28d" | "90d";

interface EndpointStats {
  endpoint: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
}

interface DoctorStats {
  doctorId: string;
  doctorName: string;
  slug: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  byEndpoint: EndpointStats[];
}

interface LlmUsageData {
  range: string;
  since: string;
  totalTokens: number;
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  uniqueDoctors: number;
  byDoctor: DoctorStats[];
  byEndpoint: EndpointStats[];
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const options: { label: string; value: Range }[] = [
    { label: "7 días", value: "7d" },
    { label: "28 días", value: "28d" },
    { label: "90 días", value: "90d" },
  ];
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-medium transition ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 text-blue-600 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function DoctorRow({ doctor }: { doctor: DoctorStats }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3 text-gray-900 font-medium">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            {doctor.doctorName}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-700">{doctor.requests.toLocaleString()}</td>
        <td className="px-4 py-3 text-right text-gray-500">{doctor.promptTokens.toLocaleString()}</td>
        <td className="px-4 py-3 text-right text-gray-500">{doctor.completionTokens.toLocaleString()}</td>
        <td className="px-4 py-3 text-right font-semibold text-gray-900">{doctor.totalTokens.toLocaleString()}</td>
      </tr>
      {expanded && doctor.byEndpoint.map((ep) => (
        <tr key={ep.endpoint} className="bg-blue-50 text-sm">
          <td className="pl-12 pr-4 py-2 text-gray-600 italic">{ep.endpoint}</td>
          <td className="px-4 py-2 text-right text-gray-500">{ep.requests.toLocaleString()}</td>
          <td className="px-4 py-2 text-right text-gray-400">{ep.promptTokens.toLocaleString()}</td>
          <td className="px-4 py-2 text-right text-gray-400">{ep.completionTokens.toLocaleString()}</td>
          <td className="px-4 py-2 text-right text-gray-600 font-medium">{ep.totalTokens.toLocaleString()}</td>
        </tr>
      ))}
    </>
  );
}

export default function LlmUsagePage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [range, setRange] = useState<Range>("28d");
  const [data, setData] = useState<LlmUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"doctors" | "endpoints">("doctors");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/llm-usage?range=${range}`);
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
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Uso de IA por Doctor</h1>
                <p className="text-gray-600 mt-0.5 text-sm">Consumo de tokens LLM en toda la plataforma</p>
              </div>
            </div>
          </div>
          <RangeSelector value={range} onChange={setRange} />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4">
            {error}
            <button onClick={fetchData} className="ml-3 underline">Reintentar</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Tokens totales"
                value={data.totalTokens}
                sub={`${data.promptTokens.toLocaleString()} entrada · ${data.completionTokens.toLocaleString()} salida`}
                icon={<Zap className="w-4 h-4" />}
              />
              <KpiCard
                label="Solicitudes"
                value={data.totalRequests}
                icon={<MessageSquare className="w-4 h-4" />}
              />
              <KpiCard
                label="Doctores activos"
                value={data.uniqueDoctors}
                icon={<Users className="w-4 h-4" />}
              />
              <KpiCard
                label="Promedio por solicitud"
                value={data.totalRequests > 0 ? Math.round(data.totalTokens / data.totalRequests) : 0}
                sub="tokens / solicitud"
                icon={<Bot className="w-4 h-4" />}
              />
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="border-b flex">
                <button
                  onClick={() => setActiveTab("doctors")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === "doctors"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Por Doctor
                </button>
                <button
                  onClick={() => setActiveTab("endpoints")}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === "endpoints"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Por Funcionalidad
                </button>
              </div>

              {activeTab === "doctors" && (
                <div className="overflow-x-auto">
                  {data.byDoctor.length === 0 ? (
                    <p className="p-8 text-center text-gray-400">Sin datos para este periodo</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">Doctor</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Solicitudes</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Tokens entrada</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Tokens salida</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Total tokens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.byDoctor.map((doctor) => (
                          <DoctorRow key={doctor.doctorId} doctor={doctor} />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === "endpoints" && (
                <div className="overflow-x-auto">
                  {data.byEndpoint.length === 0 ? (
                    <p className="p-8 text-center text-gray-400">Sin datos para este periodo</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-600 font-medium">Funcionalidad</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Solicitudes</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Tokens entrada</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Tokens salida</th>
                          <th className="px-4 py-3 text-right text-gray-600 font-medium">Total tokens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.byEndpoint.map((ep) => (
                          <tr key={ep.endpoint} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">{ep.endpoint}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{ep.requests.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{ep.promptTokens.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{ep.completionTokens.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{ep.totalTokens.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
