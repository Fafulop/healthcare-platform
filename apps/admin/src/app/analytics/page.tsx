"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Activity, Eye, Clock, Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import type { DateRange, PlatformAnalytics } from "@healthcare/types";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import KpiCard from "@/components/analytics/KpiCard";
import DailyChart from "@/components/analytics/DailyChart";
import TrafficSourcesChart from "@/components/analytics/TrafficSourcesChart";
import SearchQueriesTable from "@/components/analytics/SearchQueriesTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export default function PlatformAnalyticsPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [range, setRange] = useState<DateRange>("28d");
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/analytics/platform?range=${range}`);
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
    fetchAnalytics();
  }, [fetchAnalytics]);

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics de Plataforma</h1>
              <p className="text-gray-600 mt-1">Vision general de todo el sitio</p>
            </div>
          </div>
          <DateRangeSelector value={range} onChange={setRange} />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4">
            {error}
            <button onClick={fetchAnalytics} className="ml-3 underline">Reintentar</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : data ? (
          <>
            {/* Overview KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Usuarios"
                value={data.overview.totalUsers}
                icon={<Users className="w-5 h-5" />}
                change={data.overview.totalUsersChange}
              />
              <KpiCard
                title="Sesiones"
                value={data.overview.sessions}
                icon={<Activity className="w-5 h-5" />}
                change={data.overview.sessionsChange}
              />
              <KpiCard
                title="Vistas de pagina"
                value={data.overview.pageViews}
                icon={<Eye className="w-5 h-5" />}
                change={data.overview.pageViewsChange}
              />
              <KpiCard
                title="Duracion promedio"
                value={Math.round(data.overview.avgSessionDuration)}
                icon={<Clock className="w-5 h-5" />}
                change={data.overview.avgSessionDurationChange}
              />
            </div>

            {/* Daily Chart */}
            <DailyChart data={data.dailyPageViews} />

            {/* Top Doctors Ranking */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Top Doctores por vistas de perfil</h3>
              </div>
              {data.topDoctors.length === 0 ? (
                <p className="p-4 text-gray-400 text-center">Sin datos disponibles</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600 font-medium">#</th>
                        <th className="px-4 py-3 text-left text-gray-600 font-medium">Doctor (slug)</th>
                        <th className="px-4 py-3 text-right text-gray-600 font-medium">Eventos</th>
                        <th className="px-4 py-3 text-right text-gray-600 font-medium">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topDoctors.map((doc, i) => (
                        <tr key={doc.doctorSlug} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 font-medium">{i + 1}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">{doc.doctorSlug}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{doc.eventCount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/analytics/doctor/${doc.doctorSlug}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Ver <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Traffic Sources */}
            <TrafficSourcesChart data={data.trafficSources} />

            {/* Search Console Tables */}
            <SearchQueriesTable queries={data.searchConsole.queries} pages={data.searchConsole.pages} />
          </>
        ) : null}
      </div>
    </div>
  );
}
