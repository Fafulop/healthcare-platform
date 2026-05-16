"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Info,
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
  pacRfc: string | null;
  monto: string; // Decimal comes as string from Prisma
  efecto: string | null;
  satStatus: string;
  cancelationDate: string | null;
  issuedAt: string;
  certifiedAt: string | null;
}

interface MetadataResponse {
  data: CfdiMetadata[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { totalVigentes: number; totalMonto: number; totalIngresos: number; totalGastos: number };
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SatDescargaPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const [activeTab, setActiveTab] = useState<"cfdi" | "jobs" | "info">("cfdi");
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
          <TabBtn active={activeTab === "info"} onClick={() => setActiveTab("info")} label="Info" />
        </div>
      </div>

      {activeTab === "cfdi" && (
        <CfdiList direction={direction} setDirection={setDirection} month={month} />
      )}
      {activeTab === "jobs" && <JobsList />}
      {activeTab === "info" && <InfoTab />}
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
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [montoFilter, setMontoFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (direction) params.set("direction", direction);
      if (month) params.set("month", month);
      if (statusFilter) params.set("status", statusFilter);
      if (sortOrder) params.set("sort", sortOrder);

      const res = await authFetch(`${API_URL}/api/sat-descarga/metadata?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
    } finally {
      setLoading(false);
    }
  }, [direction, month, page, statusFilter, sortOrder]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items = data?.data || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  // Client-side filters (derived fields not available server-side)
  let filteredItems = items;
  if (tipoFilter) {
    filteredItems = filteredItems.filter(item => getFinancialImpact(item.direction, item.efecto).key === tipoFilter);
  }
  if (montoFilter) {
    filteredItems = filteredItems.filter(item => {
      const monto = Number(item.monto);
      switch (montoFilter) {
        case "0-1000": return monto <= 1000;
        case "1000-5000": return monto > 1000 && monto <= 5000;
        case "5000-20000": return monto > 5000 && monto <= 20000;
        case "20000+": return monto > 20000;
        default: return true;
      }
    });
  }

  const hasClientFilter = !!(tipoFilter || montoFilter);

  // Server-side totals for the entire period (not just current page)
  const totalIngresos = summary?.totalIngresos ?? 0;
  const totalGastos = summary?.totalGastos ?? 0;
  const balance = totalIngresos - totalGastos;

  return (
    <div>
      {/* Summary: Ingresos vs Gastos */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <div className="text-xs text-green-600 font-medium">Ingresos</div>
            <div className="text-lg font-bold text-green-700">
              ${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="text-xs text-red-600 font-medium">Gastos</div>
            <div className="text-lg font-bold text-red-700">
              ${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className={`border rounded-lg px-4 py-3 ${balance >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
            <div className={`text-xs font-medium ${balance >= 0 ? "text-blue-600" : "text-orange-600"}`}>Balance</div>
            <div className={`text-lg font-bold ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              {balance >= 0 ? "+" : "-"}${Math.abs(balance).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

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
                  <th className="pb-2 pr-4 font-medium">
                    <ColumnFilter
                      label="Fecha"
                      value={sortOrder === "asc" ? "asc" : ""}
                      onChange={v => { setSortOrder(v === "asc" ? "asc" : "desc"); setPage(1); }}
                      options={[
                        { value: "", label: "Recientes primero" },
                        { value: "asc", label: "Antiguos primero" },
                      ]}
                    />
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    <ColumnFilter
                      label="Dir"
                      value={direction}
                      onChange={v => { setDirection(v as any); setPage(1); }}
                      options={[
                        { value: "", label: "Todos" },
                        { value: "received", label: "Recibidos" },
                        { value: "emitted", label: "Emitidos" },
                      ]}
                    />
                  </th>
                  <th className="pb-2 pr-4 font-medium">Emisor / Receptor</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    <ColumnFilter
                      label="Monto"
                      value={montoFilter}
                      onChange={v => { setMontoFilter(v); setPage(1); }}
                      options={[
                        { value: "", label: "Todos" },
                        { value: "0-1000", label: "$0 - $1,000" },
                        { value: "1000-5000", label: "$1,000 - $5,000" },
                        { value: "5000-20000", label: "$5,000 - $20,000" },
                        { value: "20000+", label: "$20,000+" },
                      ]}
                    />
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    <ColumnFilter
                      label="Tipo"
                      value={tipoFilter}
                      onChange={v => { setTipoFilter(v); setPage(1); }}
                      options={[
                        { value: "", label: "Todos" },
                        { value: "ingreso", label: "Ingreso" },
                        { value: "gasto", label: "Gasto" },
                        { value: "nota_credito_emitida", label: "Nota crédito (emi)" },
                        { value: "nota_credito_recibida", label: "Nota crédito (rec)" },
                        { value: "pago_recibido", label: "Pago recibido" },
                        { value: "pago_emitido", label: "Pago emitido" },
                      ]}
                    />
                  </th>
                  <th className="pb-2 font-medium">
                    <ColumnFilter
                      label="Status"
                      value={statusFilter}
                      onChange={v => { setStatusFilter(v); setPage(1); }}
                      options={[
                        { value: "", label: "Todos" },
                        { value: "Vigente", label: "Vigente" },
                        { value: "Cancelado", label: "Cancelado" },
                      ]}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <CfdiRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                {hasClientFilter
                  ? `${filteredItems.length} de ${items.length} en esta página`
                  : `Página ${pagination.page} de ${pagination.totalPages} (${pagination.total} resultados)`
                }
              </span>
              {!hasClientFilter && (
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial Impact Helper
// ---------------------------------------------------------------------------

function getFinancialImpact(direction: string, efecto: string | null): { key: string; label: string; color: string } {
  const isReceived = direction === "received";
  switch (efecto) {
    case "I":
      return isReceived
        ? { key: "gasto", label: "Gasto", color: "text-red-600" }
        : { key: "ingreso", label: "Ingreso", color: "text-green-600" };
    case "E":
      return isReceived
        ? { key: "nota_credito_recibida", label: "Nota de crédito", color: "text-blue-600" }
        : { key: "nota_credito_emitida", label: "Nota de crédito", color: "text-orange-600" };
    case "P":
      return isReceived
        ? { key: "pago_recibido", label: "Pago recibido", color: "text-green-600" }
        : { key: "pago_emitido", label: "Pago emitido", color: "text-red-600" };
    case "T":
      return { key: "traslado", label: "Traslado", color: "text-gray-500" };
    case "N":
      return isReceived
        ? { key: "nomina_recibida", label: "Nómina", color: "text-gray-600" }
        : { key: "nomina_emitida", label: "Nómina", color: "text-gray-600" };
    default:
      return { key: "otro", label: efecto || "—", color: "text-gray-500" };
  }
}

// ---------------------------------------------------------------------------
// Column Filter
// ---------------------------------------------------------------------------

function ColumnFilter({
  label, value, onChange, options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <span className="inline-flex items-center gap-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none bg-transparent border-none text-xs font-medium cursor-pointer pr-5 py-0.5 focus:outline-none focus:ring-0 ${
          value ? "text-purple-700 font-semibold" : "text-gray-600"
        }`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.value === "" ? label : opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className={`w-3.5 h-3.5 -ml-4 pointer-events-none ${value ? "text-purple-600" : "text-gray-500"}`} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// CFDI Row
// ---------------------------------------------------------------------------

function CfdiRow({ item }: { item: CfdiMetadata }) {
  const [expanded, setExpanded] = useState(false);
  const isReceived = item.direction === "received";
  const counterpart = isReceived ? item.issuerName : item.receiverName;
  const counterpartRfc = isReceived ? item.issuerRfc : item.receiverRfc;
  const impact = getFinancialImpact(item.direction, item.efecto);
  const efectoLabel: Record<string, string> = { I: "Ingreso", E: "Egreso", P: "Pago", T: "Traslado", N: "Nómina" };

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
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
        <td className="py-2.5 pr-4">
          <span className={`text-xs font-medium ${impact.color}`}>
            {impact.label}
          </span>
        </td>
        <td className="py-2.5">
          {item.satStatus === "Vigente" ? (
            <span className="text-xs text-green-600 font-medium">Vigente</span>
          ) : (
            <span className="text-xs text-red-500 font-medium">Cancelado</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50/50">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-xs">
              <DetailItem label="UUID (Folio Fiscal)" value={item.uuid} mono />
              <DetailItem label="Emisor" value={`${item.issuerName || "—"} (${item.issuerRfc})`} />
              <DetailItem label="Receptor" value={`${item.receiverName || "—"} (${item.receiverRfc})`} />
              <DetailItem
                label="Fecha Emisión"
                value={new Date(item.issuedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
              />
              <DetailItem
                label="Fecha Certificación SAT"
                value={item.certifiedAt
                  ? new Date(item.certifiedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                  : "—"}
              />
              <DetailItem label="PAC Certificador" value={item.pacRfc || "—"} mono />
              <DetailItem label="Efecto SAT" value={efectoLabel[item.efecto || ""] || item.efecto || "—"} />
              <DetailItem label="Impacto Financiero" value={impact.label} />
              <DetailItem label="Monto Total" value={`$${Number(item.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
              {item.satStatus === "Cancelado" && (
                <DetailItem
                  label="Fecha Cancelación"
                  value={item.cancelationDate
                    ? new Date(item.cancelationDate).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                    : "—"}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{" "}
      <span className={`text-gray-700 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Tab
// ---------------------------------------------------------------------------

function InfoTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* What does sync do */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-purple-600" />
          ¿Qué hace la sincronización?
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            La sincronización se conecta <strong>directamente al SAT</strong> usando tu e.Firma (FIEL)
            para descargar el listado de todos los CFDIs que has emitido o recibido en un mes determinado.
          </p>
          <p>El proceso funciona así:</p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2">
            <li><strong>Autenticación</strong> — Se firma una solicitud con tu e.Firma para obtener un token del SAT</li>
            <li><strong>Solicitud</strong> — Se pide al SAT que prepare el paquete de metadata (emitidos o recibidos)</li>
            <li><strong>Espera</strong> — El SAT procesa la solicitud (normalmente 30 seg a unos minutos, máximo 72 horas)</li>
            <li><strong>Descarga</strong> — Se descarga el paquete ZIP con la metadata de tus CFDIs</li>
            <li><strong>Almacenamiento</strong> — Se parsea y guarda cada CFDI en la base de datos</li>
          </ol>
          <p className="text-xs text-gray-500 mt-3">
            Un worker automático revisa el progreso cada 15 minutos. No necesitas mantener la página abierta.
          </p>
        </div>
      </section>

      {/* What data do we get */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">¿Qué datos obtenemos?</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            Actualmente descargamos la <strong>metadata</strong> de cada CFDI (no el XML completo).
            Esto incluye:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>UUID (folio fiscal único)</li>
            <li>Emisor y receptor (nombre + RFC)</li>
            <li>Monto total</li>
            <li>Fecha de emisión y certificación</li>
            <li>Tipo de comprobante (Ingreso, Egreso, Pago, Traslado)</li>
            <li>Status (Vigente / Cancelado)</li>
            <li>PAC que certificó</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            La metadata NO incluye desglose de conceptos, subtotal, IVA, método de pago ni uso CFDI.
            Para eso se necesita descargar el XML completo (próxima fase).
          </p>
        </div>
      </section>

      {/* Financial impact explanation */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Columna "Tipo" — Impacto financiero</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            El SAT clasifica cada CFDI por su <strong>EfectoComprobante</strong> (I=Ingreso, E=Egreso, P=Pago, T=Traslado).
            Pero este código describe el tipo de documento, <strong>no el impacto en tus finanzas</strong>.
          </p>
          <p>
            Por ejemplo, un CFDI tipo "Ingreso" que tú <em>recibes</em> significa que alguien te cobró — es un <strong>gasto</strong> para ti.
            Por eso traducimos la combinación Dirección + Efecto a lo que realmente significa:
          </p>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Dirección + Efecto SAT</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Se muestra como</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Significado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Emi</span> + Ingreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-green-600">Ingreso</span></td>
                  <td className="px-3 py-2 text-gray-500">Facturaste a alguien — dinero a tu favor</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Rec</span> + Ingreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-red-600">Gasto</span></td>
                  <td className="px-3 py-2 text-gray-500">Alguien te facturó — dinero que pagaste</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Emi</span> + Egreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-orange-600">Nota de crédito</span></td>
                  <td className="px-3 py-2 text-gray-500">Emitiste una devolución/descuento</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Rec</span> + Egreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-blue-600">Nota de crédito</span></td>
                  <td className="px-3 py-2 text-gray-500">Te emitieron una devolución/descuento a tu favor</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Rec</span> + Pago</td>
                  <td className="px-3 py-2"><span className="font-medium text-green-600">Pago recibido</span></td>
                  <td className="px-3 py-2 text-gray-500">Complemento de pago — te pagaron una factura</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Emi</span> + Pago</td>
                  <td className="px-3 py-2"><span className="font-medium text-red-600">Pago emitido</span></td>
                  <td className="px-3 py-2 text-gray-500">Complemento de pago — pagaste una factura</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Limitaciones del SAT</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2 text-sm text-gray-700">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>El SAT puede tardar hasta <strong>72 horas</strong> en procesar una solicitud (normalmente minutos)</li>
            <li>Máximo <strong>1,000,000</strong> registros por solicitud</li>
            <li>Histórico disponible: hasta <strong>5 años fiscales</strong> + año actual</li>
            <li>No puedes descargar el mismo XML más de 2 veces</li>
            <li>Si ya existe una solicitud activa para el mismo periodo, el SAT la rechaza</li>
          </ul>
        </div>
      </section>
    </div>
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

  const deleteJob = async (id: number) => {
    if (!confirm("¿Eliminar esta sincronización?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/sync/${id}`, { method: "DELETE" });
      if (res.ok) fetchJobs();
    } catch (err) {
      console.error("Error deleting job:", err);
    }
  };

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
            <th className="pb-2 pr-4 font-medium">Creado</th>
            <th className="pb-2 font-medium"></th>
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
              <td className="py-2.5 pr-4 text-xs text-gray-400 whitespace-nowrap">
                {new Date(job.createdAt).toLocaleString("es-MX")}
              </td>
              <td className="py-2.5">
                {job.status !== "downloading" && job.status !== "completed" && (
                  <button
                    onClick={() => deleteJob(job.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
