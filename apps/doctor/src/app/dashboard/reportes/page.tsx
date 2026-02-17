"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Eye, Phone, CalendarCheck, BookOpen, Loader2, BarChart3 } from "lucide-react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { authFetch } from "@/lib/auth-fetch";
import type { DateRange, DoctorAnalytics } from "@healthcare/types";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import KpiCard from "@/components/analytics/KpiCard";
import DailyChart from "@/components/analytics/DailyChart";
import TrafficSourcesChart from "@/components/analytics/TrafficSourcesChart";
import SearchQueriesTable from "@/components/analytics/SearchQueriesTable";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export default function ReportesPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const { doctorProfile } = useDoctorProfile();
  const slug = doctorProfile?.slug;

  const [range, setRange] = useState<DateRange>("28d");
  const [data, setData] = useState<DoctorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/analytics/doctor/${slug}?range=${range}`);
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
  }, [slug, range]);

  useEffect(() => {
    if (slug) fetchAnalytics();
  }, [slug, fetchAnalytics]);

  if (status === "loading" || !slug) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600 mt-1">Estadisticas de tu perfil publico</p>
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Vistas de perfil" value={data.events.profile_view} icon={<Eye className="w-5 h-5" />} />
            <KpiCard title="Clics de contacto" value={data.events.contact_click} icon={<Phone className="w-5 h-5" />} />
            <KpiCard title="Citas completadas" value={data.events.booking_complete} icon={<CalendarCheck className="w-5 h-5" />} />
            <KpiCard title="Vistas de blog" value={data.events.blog_view} icon={<BookOpen className="w-5 h-5" />} />
          </div>

          {/* Daily Chart */}
          <DailyChart data={data.dailyPageViews} />

          {/* Traffic Sources */}
          <TrafficSourcesChart data={data.trafficSources} />

          {/* Search Console Tables */}
          <SearchQueriesTable queries={data.searchConsole.queries} pages={data.searchConsole.pages} />

          {/* Event Breakdown */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Desglose de eventos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600 font-medium">Evento</th>
                    <th className="px-4 py-3 text-right text-gray-600 font-medium">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(data.events).map(([event, count]) => (
                    <tr key={event} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                          {event.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
