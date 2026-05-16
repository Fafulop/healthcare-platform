"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncJob {
  id: number;
  status: string;
  requestType: string;
  direction: string;
  dateFrom: string;
  dateTo: string;
  cfdiCount: number | null;
  attempts: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface CfdiMetadata {
  id: number;
  uuid: string;
  direction: string;
  issuerRfc: string;
  issuerName: string | null;
  receiverRfc: string;
  receiverName: string | null;
  monto: string; // Decimal comes as string from Prisma
  efecto: string | null;
  satStatus: string;
  cancelationDate: string | null;
  issuedAt: string;
}

interface MetadataResponse {
  data: CfdiMetadata[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { totalVigentes: number; totalMonto: number };
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SatDescargaPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const [activeTab, setActiveTab] = useState<"cfdi" | "jobs">("cfdi");
  const [direction, setDirection] = useState<"" | "emitted" | "received">("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-purple-600" />
          Descarga Masiva SAT
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Consulta y descarga tus CFDIs emitidos y recibidos directamente del SAT
        </p>
      </div>

      {/* Sync trigger */}
      <SyncTrigger month={month} setMonth={setMonth} />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 mt-6">
        <div className="flex gap-6">
          <TabBtn active={activeTab === "cfdi"} onClick={() => setActiveTab("cfdi")} label="CFDIs Descargados" />
          <TabBtn active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} label="Historial de Syncs" />
        </div>
      </div>

      {activeTab === "cfdi" && (
        <CfdiList direction={direction} setDirection={setDirection} month={month} />
      )}
      {activeTab === "jobs" && <JobsList />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sync Trigger
// ---------------------------------------------------------------------------

function SyncTrigger({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const [syncing, setSyncing] = useState<string | null>(null); // 'emitted' | 'received' | null
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const triggerSync = async (direction: "emitted" | "received") => {
    setSyncing(direction);
    setMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/sync`, {
        method: "POST",
        body: JSON.stringify({ direction, month }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Error al crear sincronización" });
        return;
      }
      setMessage({
        type: "success",
        text: `Sincronización de ${direction === "emitted" ? "emitidos" : "recibidos"} creada (Job #${json.data.id}). Se procesará en unos minutos.`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sincronizar con el SAT</h2>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        <button
          onClick={() => triggerSync("received")}
          disabled={syncing !== null}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing === "received" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
          Descargar Recibidos
        </button>

        <button
          onClick={() => triggerSync("emitted")}
          disabled={syncing !== null}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing === "emitted" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
          Descargar Emitidos
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-md text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CFDI Metadata List
// ---------------------------------------------------------------------------

function CfdiList({
  direction, setDirection, month
}: {
  direction: string;
  setDirection: (d: "" | "emitted" | "received") => void;
  month: string;
}) {
  const [data, setData] = useState<MetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (direction) params.set("direction", direction);
      if (month) params.set("month", month);

      const res = await authFetch(`${API_URL}/api/sat-descarga/metadata?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    } finally {
      setLoading(false);
    }
  }, [direction, month, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items = data?.data || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  return (
    <div>
      {/* Filters + Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={direction}
            onChange={e => { setDirection(e.target.value as any); setPage(1); }}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos</option>
            <option value="received">Recibidos</option>
            <option value="emitted">Emitidos</option>
          </select>

          <button onClick={fetchData} className="p-1.5 text-gray-400 hover:text-gray-600">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {summary && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{summary.totalVigentes}</span> CFDIs vigentes
            {" — "}
            <span className="font-medium text-green-700">
              ${Number(summary.totalMonto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No hay CFDIs descargados para este periodo.</p>
          <p className="text-xs mt-1">Usa los botones de arriba para sincronizar con el SAT.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Dir</th>
                  <th className="pb-2 pr-4 font-medium">Emisor / Receptor</th>
                  <th className="pb-2 pr-4 font-medium text-right">Monto</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <CfdiRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} resultados)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CFDI Row
// ---------------------------------------------------------------------------

function CfdiRow({ item }: { item: CfdiMetadata }) {
  const isReceived = item.direction === "received";
  const counterpart = isReceived ? item.issuerName : item.receiverName;
  const counterpartRfc = isReceived ? item.issuerRfc : item.receiverRfc;
  const efectoLabel: Record<string, string> = { I: "Ingreso", E: "Egreso", P: "Pago", T: "Traslado", N: "Nómina" };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2.5 pr-4 whitespace-nowrap">
        {new Date(item.issuedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td className="py-2.5 pr-4">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
          isReceived ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
        }`}>
          {isReceived ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {isReceived ? "Rec" : "Emi"}
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={counterpart || counterpartRfc}>
          {counterpart || counterpartRfc}
        </div>
        {counterpart && (
          <div className="text-xs text-gray-400">{counterpartRfc}</div>
        )}
      </td>
      <td className="py-2.5 pr-4 text-right font-mono whitespace-nowrap">
        ${Number(item.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
      </td>
      <td className="py-2.5 pr-4 text-xs text-gray-500">
        {efectoLabel[item.efecto || ""] || item.efecto || "—"}
      </td>
      <td className="py-2.5">
        {item.satStatus === "Vigente" ? (
          <span className="text-xs text-green-600 font-medium">Vigente</span>
        ) : (
          <span className="text-xs text-red-500 font-medium">Cancelado</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Jobs List
// ---------------------------------------------------------------------------

function JobsList() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/sync`);
      if (res.ok) {
        const { data } = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Auto-refresh if any job is in progress
  useEffect(() => {
    const hasActive = jobs.some(j =>
      ["pending", "authenticating", "requesting", "polling", "downloading"].includes(j.status)
    );
    if (!hasActive) return;

    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p>No hay sincronizaciones registradas.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    authenticating: "bg-blue-100 text-blue-700",
    requesting: "bg-blue-100 text-blue-700",
    polling: "bg-blue-100 text-blue-700",
    downloading: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Periodo</th>
            <th className="pb-2 pr-4 font-medium">Dirección</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">CFDIs</th>
            <th className="pb-2 font-medium">Creado</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2.5 pr-4 text-gray-400">#{job.id}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap">
                {new Date(job.dateFrom).toLocaleDateString("es-MX", { month: "short", year: "numeric", timeZone: "UTC" })}
              </td>
              <td className="py-2.5 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  job.direction === "received" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
                }`}>
                  {job.direction === "received" ? "Recibidos" : "Emitidos"}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[job.status] || "bg-gray-100 text-gray-700"}`}>
                  {job.status}
                </span>
                {job.lastError && (
                  <div className="text-xs text-red-500 mt-0.5 max-w-[200px] truncate" title={job.lastError}>
                    {job.lastError}
                  </div>
                )}
              </td>
              <td className="py-2.5 pr-4 font-medium">
                {job.cfdiCount ?? "—"}
              </td>
              <td className="py-2.5 text-xs text-gray-400 whitespace-nowrap">
                {new Date(job.createdAt).toLocaleString("es-MX")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
