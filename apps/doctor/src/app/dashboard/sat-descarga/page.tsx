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
  BookOpen,
  BarChart3,
  FileSpreadsheet,
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

interface CfdiDetailConcepto {
  claveProdServ: string | null;
  descripcion: string | null;
  cantidad: number | null;
  claveUnidad: string | null;
  unidad: string | null;
  valorUnitario: number | null;
  importe: number | null;
  descuento: number | null;
  ivaTrasladado: number | null;
  isrRetenido: number | null;
}

interface CfdiDetailData {
  uuid: string;
  subtotal: number | null;
  descuento: number | null;
  total: number | null;
  ivaTrasladado: number | null;
  isrRetenido: number | null;
  ivaRetenido: number | null;
  ieps: number | null;
  metodoPago: string | null;
  formaPago: string | null;
  usoCfdi: string | null;
  moneda: string | null;
  tipoCambio: number | null;
  serie: string | null;
  folio: string | null;
  lugarExpedicion: string | null;
  conceptos: CfdiDetailConcepto[];
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SatDescargaPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const [activeTab, setActiveTab] = useState<"cfdi" | "resumen" | "jobs" | "info" | "contable">("cfdi");
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
          <TabBtn active={activeTab === "resumen"} onClick={() => setActiveTab("resumen")} label="Resumen Fiscal" />
          <TabBtn active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} label="Historial de Syncs" />
          <TabBtn active={activeTab === "contable"} onClick={() => setActiveTab("contable")} label="Guía Contable" />
          <TabBtn active={activeTab === "info"} onClick={() => setActiveTab("info")} label="Info" />
        </div>
      </div>

      {activeTab === "cfdi" && (
        <CfdiList direction={direction} setDirection={setDirection} month={month} />
      )}
      {activeTab === "resumen" && <ResumenFiscal />}
      {activeTab === "jobs" && <JobsList />}
      {activeTab === "contable" && <ContableTab />}
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
  const [syncing, setSyncing] = useState<string | null>(null); // "emitted" | "received" | "both" | null
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncType, setSyncType] = useState<"metadata" | "xml" | "full">("full");

  const triggerSync = async (direction: "emitted" | "received") => {
    const res = await authFetch(`${API_URL}/api/sat-descarga/sync`, {
      method: "POST",
      body: JSON.stringify({ direction, month, requestType: syncType }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Error al crear sincronización");
    }
    const jobId = Array.isArray(json.data) ? json.data.map((j: any) => `#${j.id}`).join(', ') : `#${json.data.id}`;
    return { direction, jobId };
  };

  const triggerSingle = async (direction: "emitted" | "received") => {
    setSyncing(direction);
    setMessage(null);
    try {
      const result = await triggerSync(direction);
      const typeLabel = syncType === "full" ? "metadata + XML" : syncType === "xml" ? "XMLs" : "metadata";
      setMessage({
        type: "success",
        text: `Sincronización de ${typeLabel} ${direction === "emitted" ? "emitidos" : "recibidos"} creada (Job ${result.jobId}). Se procesará en unos minutos.`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSyncing(null);
    }
  };

  const triggerBoth = async () => {
    setSyncing("both");
    setMessage(null);
    const results: string[] = [];
    const errors: string[] = [];
    for (const dir of ["received", "emitted"] as const) {
      try {
        const result = await triggerSync(dir);
        results.push(`${dir === "emitted" ? "Emitidos" : "Recibidos"} (Job ${result.jobId})`);
      } catch (err: any) {
        errors.push(`${dir === "emitted" ? "Emitidos" : "Recibidos"}: ${err.message}`);
      }
    }
    if (results.length > 0 && errors.length === 0) {
      const typeLabel = syncType === "full" ? "metadata + XML" : syncType === "xml" ? "XMLs" : "metadata";
      setMessage({ type: "success", text: `Sincronización de ${typeLabel} creada: ${results.join(" + ")}. Se procesará en unos minutos.` });
    } else if (results.length > 0 && errors.length > 0) {
      setMessage({ type: "success", text: `Parcial: ${results.join(" + ")}. Errores: ${errors.join("; ")}` });
    } else {
      setMessage({ type: "error", text: errors.join("; ") });
    }
    setSyncing(null);
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            value={syncType}
            onChange={e => setSyncType(e.target.value as "metadata" | "xml" | "full")}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="full">Completa (metadata + XML)</option>
            <option value="metadata">Solo metadata (listado)</option>
            <option value="xml">Solo XML (desglose fiscal)</option>
          </select>
        </div>

        <button
          onClick={triggerBoth}
          disabled={syncing !== null}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar Todo
        </button>

        <button
          onClick={() => triggerSingle("received")}
          disabled={syncing !== null}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 border border-gray-300"
        >
          {syncing === "received" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
          Solo Recibidos
        </button>

        <button
          onClick={() => triggerSingle("emitted")}
          disabled={syncing !== null}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 border border-gray-300"
        >
          {syncing === "emitted" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
          Solo Emitidos
        </button>
      </div>

      {syncType === "xml" && (
        <p className="mt-2 text-xs text-gray-500">
          Solo descarga XMLs. Requiere haber descargado la metadata primero.
        </p>
      )}

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

      {/* Export button */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-4">
          <ExportButton
            label="Exportar CSV (detalle)"
            href={`${API_URL}/api/sat-descarga/export?month=${month}&type=details${direction ? `&direction=${direction}` : ""}`}
          />
          <ExportButton
            label="Exportar CSV (metadata)"
            href={`${API_URL}/api/sat-descarga/export?month=${month}&type=metadata${direction ? `&direction=${direction}` : ""}`}
            secondary
          />
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
  const [xmlDetail, setXmlDetail] = useState<CfdiDetailData | null>(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState<string | null>(null);

  const isReceived = item.direction === "received";
  const counterpart = isReceived ? item.issuerName : item.receiverName;
  const counterpartRfc = isReceived ? item.issuerRfc : item.receiverRfc;
  const impact = getFinancialImpact(item.direction, item.efecto);
  const efectoLabel: Record<string, string> = { I: "Ingreso", E: "Egreso", P: "Pago", T: "Traslado", N: "Nómina" };

  const fetchXmlDetails = async () => {
    if (xmlDetail || xmlLoading) return;
    setXmlLoading(true);
    setXmlError(null);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/details/${item.uuid}`);
      if (res.ok) {
        const { data } = await res.json();
        setXmlDetail(data);
      } else if (res.status === 404) {
        setXmlError("No hay detalles XML descargados para este CFDI.");
      } else {
        setXmlError("Error al obtener detalles.");
      }
    } catch {
      setXmlError("Error de conexión.");
    } finally {
      setXmlLoading(false);
    }
  };

  const formaPagoLabels: Record<string, string> = {
    "01": "Efectivo", "02": "Cheque nominativo", "03": "Transferencia",
    "04": "Tarjeta de crédito", "06": "Dinero electrónico",
    "28": "Tarjeta de débito", "99": "Por definir",
  };

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
            {/* Metadata section */}
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

            {/* XML Details section */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              {!xmlDetail && !xmlLoading && !xmlError && (
                <button
                  onClick={(e) => { e.stopPropagation(); fetchXmlDetails(); }}
                  className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Ver detalles XML (desglose fiscal)
                </button>
              )}
              {xmlLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cargando detalles...
                </div>
              )}
              {xmlError && (
                <p className="text-xs text-gray-500">{xmlError}</p>
              )}
              {xmlDetail && <XmlDetailPanel detail={xmlDetail} formaPagoLabels={formaPagoLabels} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// XML Detail Panel (shown inside expanded row)
// ---------------------------------------------------------------------------

function XmlDetailPanel({ detail, formaPagoLabels }: { detail: CfdiDetailData; formaPagoLabels: Record<string, string> }) {
  const fmt = (n: number | null) => n !== null ? `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-3">
      {/* Financial breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        <DetailItem label="Subtotal" value={fmt(detail.subtotal)} />
        {detail.descuento !== null && <DetailItem label="Descuento" value={fmt(detail.descuento)} />}
        <DetailItem label="IVA Trasladado" value={fmt(detail.ivaTrasladado)} />
        {detail.isrRetenido !== null && <DetailItem label="ISR Retenido" value={fmt(detail.isrRetenido)} />}
        {detail.ivaRetenido !== null && <DetailItem label="IVA Retenido" value={fmt(detail.ivaRetenido)} />}
        {detail.ieps !== null && <DetailItem label="IEPS" value={fmt(detail.ieps)} />}
        <DetailItem label="Total" value={fmt(detail.total)} />
      </div>

      {/* Payment info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        {detail.metodoPago && <DetailItem label="Método de Pago" value={detail.metodoPago === "PUE" ? "PUE (Pago en una exhibición)" : "PPD (Pago en parcialidades)"} />}
        {detail.formaPago && <DetailItem label="Forma de Pago" value={`${detail.formaPago} — ${formaPagoLabels[detail.formaPago] || "Otro"}`} />}
        {detail.usoCfdi && <DetailItem label="Uso CFDI" value={detail.usoCfdi} />}
        {detail.moneda && <DetailItem label="Moneda" value={detail.moneda} />}
        {detail.tipoCambio !== null && <DetailItem label="Tipo de Cambio" value={detail.tipoCambio.toString()} />}
        {detail.serie && <DetailItem label="Serie" value={detail.serie} />}
        {detail.folio && <DetailItem label="Folio" value={detail.folio} />}
        {detail.lugarExpedicion && <DetailItem label="Lugar Expedición (CP)" value={detail.lugarExpedicion} />}
      </div>

      {/* Conceptos table */}
      {detail.conceptos.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Conceptos ({detail.conceptos.length})</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-2 py-1.5 text-left font-medium text-gray-600">Descripción</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600">Cant.</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600">P. Unit.</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600">Importe</th>
                  <th className="px-2 py-1.5 text-right font-medium text-gray-600">IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.conceptos.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 max-w-[250px] truncate" title={c.descripcion || ""}>
                      {c.descripcion || "—"}
                      {c.claveProdServ && (
                        <span className="ml-1 text-gray-400">[{c.claveProdServ}]</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{c.cantidad ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {c.valorUnitario !== null ? `$${c.valorUnitario.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {c.importe !== null ? `$${c.importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {c.ivaTrasladado !== null ? `$${c.ivaTrasladado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
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
// Resumen Fiscal Tab
// ---------------------------------------------------------------------------

interface MonthSummary {
  month: number;
  ingresos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
  gastos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
}

interface SummaryResponse {
  year: number;
  months: MonthSummary[];
  annual: {
    ingresos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
    gastos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
  };
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ResumenFiscal() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/summary?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p>No hay datos XML descargados para {year}.</p>
        <p className="text-xs mt-1">Sincroniza con tipo "Completa" o "Solo XML" para ver el resumen fiscal.</p>
        <div className="mt-4">
          <YearSelector year={year} setYear={setYear} />
        </div>
      </div>
    );
  }

  const { annual, months } = data;
  const balance = annual.ingresos.total - annual.gastos.total;
  const ivaAPagar = annual.ingresos.iva - annual.gastos.iva;

  return (
    <div className="space-y-6">
      {/* Year selector + export */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          Resumen Fiscal {year}
        </h3>
        <div className="flex items-center gap-3">
          <ExportButton
            label="Exportar CSV"
            href={`${API_URL}/api/sat-descarga/export?month=${year}-01&type=resumen`}
          />
          <YearSelector year={year} setYear={setYear} />
        </div>
      </div>

      {/* Annual summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Ingresos (subtotal)" value={fmt(annual.ingresos.subtotal)} sublabel={`${annual.ingresos.count} facturas`} color="green" />
        <SummaryCard label="Gastos (subtotal)" value={fmt(annual.gastos.subtotal)} sublabel={`${annual.gastos.count} facturas`} color="red" />
        <SummaryCard label="Balance neto" value={fmt(balance)} sublabel="Ingresos − Gastos (total)" color={balance >= 0 ? "blue" : "orange"} />
        <SummaryCard label="IVA a pagar" value={fmt(ivaAPagar)} sublabel="IVA cobrado − IVA pagado" color={ivaAPagar >= 0 ? "amber" : "green"} />
      </div>

      {/* Tax breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">IVA Trasladado (cobrado)</p>
          <p className="text-xl font-bold text-gray-900">{fmt(annual.ingresos.iva)}</p>
          <p className="text-xs text-gray-400 mt-1">En tus facturas emitidas</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">IVA Acreditable (pagado)</p>
          <p className="text-xl font-bold text-gray-900">{fmt(annual.gastos.iva)}</p>
          <p className="text-xs text-gray-400 mt-1">En facturas que recibes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">ISR Retenido + IVA Retenido</p>
          <p className="text-xl font-bold text-gray-900">{fmt(annual.ingresos.isrRetenido + annual.ingresos.ivaRetenido)}</p>
          <p className="text-xs text-gray-400 mt-1">Retenciones en tus emitidas (pago anticipado)</p>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">Desglose mensual</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left font-semibold">Mes</th>
                <th className="px-3 py-2 text-right font-semibold">Ingresos (subtotal)</th>
                <th className="px-3 py-2 text-right font-semibold">IVA cobrado</th>
                <th className="px-3 py-2 text-right font-semibold">ISR ret.</th>
                <th className="px-3 py-2 text-right font-semibold">Gastos (subtotal)</th>
                <th className="px-3 py-2 text-right font-semibold">IVA pagado</th>
                <th className="px-3 py-2 text-right font-semibold">Balance</th>
                <th className="px-3 py-2 text-right font-semibold">IVA neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {months.map(m => {
                const monthBalance = m.ingresos.total - m.gastos.total;
                const monthIva = m.ingresos.iva - m.gastos.iva;
                return (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmt(m.ingresos.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmt(m.ingresos.iva)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{m.ingresos.isrRetenido > 0 ? fmt(m.ingresos.isrRetenido) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-700">{fmt(m.gastos.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmt(m.gastos.iva)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-medium ${monthBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                      {monthBalance >= 0 ? "+" : ""}{fmt(monthBalance)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${monthIva >= 0 ? "text-amber-700" : "text-green-700"}`}>
                      {monthIva >= 0 ? "+" : ""}{fmt(monthIva)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="px-3 py-2.5 text-gray-900">Total {year}</td>
                <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmt(annual.ingresos.subtotal)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmt(annual.ingresos.iva)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-700">{annual.ingresos.isrRetenido > 0 ? fmt(annual.ingresos.isrRetenido) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-red-700">{fmt(annual.gastos.subtotal)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmt(annual.gastos.iva)}</td>
                <td className={`px-3 py-2.5 text-right font-mono ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                  {balance >= 0 ? "+" : ""}{fmt(balance)}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono ${ivaAPagar >= 0 ? "text-amber-700" : "text-green-700"}`}>
                  {ivaAPagar >= 0 ? "+" : ""}{fmt(ivaAPagar)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-600 space-y-1">
        <p><strong>Ingresos:</strong> Facturas emitidas tipo Ingreso (lo que facturaste). Subtotal = antes de impuestos.</p>
        <p><strong>Gastos:</strong> Facturas recibidas tipo Ingreso (lo que te facturaron). Subtotal = base para deduccion.</p>
        <p><strong>IVA cobrado:</strong> Lo que cobraste de IVA — debes enterarlo al SAT.</p>
        <p><strong>IVA pagado:</strong> Lo que pagaste de IVA en gastos — lo restas del IVA que debes (acreditable).</p>
        <p><strong>IVA neto:</strong> IVA cobrado − IVA pagado. Positivo = debes pagar. Negativo = saldo a favor.</p>
        <p><strong>ISR ret.:</strong> ISR que te retuvieron (personas morales). Se resta en tu declaracion anual.</p>
        <p className="text-gray-400 mt-2">Datos extraidos de los XMLs descargados. Solo incluye facturas vigentes tipo I y E.</p>
      </div>
    </div>
  );
}

function YearSelector({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const currentYear = new Date().getFullYear();
  return (
    <select
      value={year}
      onChange={e => setYear(Number(e.target.value))}
      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
    >
      {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}

function SummaryCard({ label, value, sublabel, color }: { label: string; value: string; sublabel: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
    orange: "bg-orange-50 border-orange-200",
    amber: "bg-amber-50 border-amber-200",
  };
  const textClasses: Record<string, string> = {
    green: "text-green-700",
    red: "text-red-700",
    blue: "text-blue-700",
    orange: "text-orange-700",
    amber: "text-amber-700",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color] || "bg-gray-50 border-gray-200"}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className={`text-xl font-bold mt-1 ${textClasses[color] || "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Button
// ---------------------------------------------------------------------------

function ExportButton({ label, href, secondary }: { label: string; href: string; secondary?: boolean }) {
  const handleExport = async () => {
    try {
      const res = await authFetch(href);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.error || "Error al exportar");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || "export.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al exportar CSV");
    }
  };

  return (
    <button
      onClick={handleExport}
      className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 ${
        secondary
          ? "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
          : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
      }`}
    >
      <FileSpreadsheet className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Contable Tab — Accounting Guide
// ---------------------------------------------------------------------------

function ContableTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Intro */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-purple-600" />
          Guia de Informacion Contable
        </h3>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
          <p>
            Esta guia explica los conceptos fiscales que aparecen en tus CFDIs descargados del SAT.
            Util para entender tus obligaciones, retenciones e impuestos como persona fisica con actividad empresarial o profesional.
          </p>
        </div>
      </section>

      {/* IVA Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">IVA (Impuesto al Valor Agregado)</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            El IVA es un impuesto <strong>indirecto</strong> que se cobra al consumidor final.
            Como emisor de facturas, tu lo <strong>trasladas</strong> (cobras) y despues lo enteras al SAT.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Tasas de IVA en Mexico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Tasa</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Aplica a</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Ejemplos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium text-green-700">16%</td>
                    <td className="px-3 py-2">Tasa general — la mayoria de bienes y servicios</td>
                    <td className="px-3 py-2 text-gray-500">Consultas medicas, software, renta de oficina, equipo medico, servicios profesionales</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-blue-700">0%</td>
                    <td className="px-3 py-2">Alimentos basicos no procesados, medicinas, libros</td>
                    <td className="px-3 py-2 text-gray-500">Cafe en grano, leche, frutas, verduras, pan, medicamentos de patente, libros fisicos</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-orange-700">Exento</td>
                    <td className="px-3 py-2">Servicios medicos, educacion, venta de casa habitacion</td>
                    <td className="px-3 py-2 text-gray-500">Honorarios medicos a personas fisicas (consulta, cirugia), colegiaturas, venta de primer inmueble</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Caso especial: Servicios medicos</p>
            <p className="text-xs text-amber-700">
              Los honorarios medicos a <strong>personas fisicas</strong> estan <strong>exentos</strong> de IVA
              (Art. 15 fraccion XIV LIVA). Pero si facturas a una <strong>persona moral</strong> (hospital, aseguradora,
              empresa), SI debes cobrar IVA al 16%. La diferencia es quien es el receptor de tu factura.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">IVA Trasladado vs IVA Acreditable</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>IVA Trasladado</strong> — El que TU cobras en tus facturas emitidas. Lo debes pagar al SAT.</li>
              <li><strong>IVA Acreditable</strong> — El que TE cobran en facturas que recibes (gastos). Lo puedes restar del IVA que debes.</li>
              <li><strong>IVA a pagar</strong> = IVA Trasladado − IVA Acreditable. Si es negativo, tienes saldo a favor.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">¿Por que algunos CFDIs muestran IVA = $0.00?</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Productos alimenticios basicos (cafe, leche, pan) → tasa 0%</li>
              <li>Servicios medicos a persona fisica → exento</li>
              <li>Complementos de pago (tipo P) → no llevan IVA, solo referencian el pago</li>
              <li>Facturas de nomina → exentas</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ISR Retention Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Retenciones de ISR e IVA</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            Las retenciones son impuestos que el <strong>pagador</strong> (persona moral) descuenta del pago
            y entera directamente al SAT en tu nombre. Es un pago anticipado de tus impuestos.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">¿Cuando aplican retenciones?</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Quien emite</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Quien recibe</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Tipo de servicio</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Retenciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2">Persona fisica</td>
                    <td className="px-3 py-2 font-medium">Persona moral</td>
                    <td className="px-3 py-2">Servicios profesionales (honorarios)</td>
                    <td className="px-3 py-2 text-red-600 font-medium">ISR 10% + IVA 10.6667%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Persona fisica</td>
                    <td className="px-3 py-2 font-medium">Persona moral</td>
                    <td className="px-3 py-2">Venta de bienes (productos)</td>
                    <td className="px-3 py-2 text-green-600 font-medium">Ninguna</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Persona fisica</td>
                    <td className="px-3 py-2">Persona fisica</td>
                    <td className="px-3 py-2">Cualquiera</td>
                    <td className="px-3 py-2 text-green-600 font-medium">Ninguna</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Persona moral</td>
                    <td className="px-3 py-2">Cualquiera</td>
                    <td className="px-3 py-2">Cualquiera</td>
                    <td className="px-3 py-2 text-green-600 font-medium">Ninguna</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Regla clave</p>
            <p className="text-xs text-blue-700">
              Retenciones SOLO aplican cuando una <strong>persona fisica</strong> le factura <strong>servicios profesionales</strong> a
              una <strong>persona moral</strong>. Si vendes productos (bienes), no hay retencion aunque el cliente sea empresa.
              Si facturas a otra persona fisica (pacientes), tampoco hay retencion.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Calculo de retenciones (ejemplo)</p>
            <div className="bg-gray-50 rounded p-3 font-mono text-xs space-y-1">
              <p>Subtotal (honorarios medicos):     $10,000.00</p>
              <p>+ IVA Trasladado (16%):            + $1,600.00</p>
              <p>− ISR Retenido (10% del subtotal): − $1,000.00</p>
              <p>− IVA Retenido (2/3 del IVA):      − $1,066.67</p>
              <p className="border-t border-gray-300 pt-1 font-bold">= Total a cobrar:                    $9,533.33</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Recibes menos en el momento, pero las retenciones cuentan como pago anticipado de tus impuestos.
              Al hacer tu declaracion anual, restas lo retenido de lo que debes.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">¿Donde aparecen las retenciones en el CFDI?</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>En la seccion <strong>"Ver detalles XML"</strong> de cada factura emitida</li>
              <li>Campos: "ISR Retenido" e "IVA Retenido"</li>
              <li>Si aparecen como null/vacio, esa factura no tiene retenciones</li>
              <li>Las retenciones las declara quien te paga (la persona moral), no tu</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">Casos donde NO hay retencion aunque factures a persona moral:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Venta de productos</strong> — Cafe, equipos, insumos (enajenacion de bienes)</li>
              <li><strong>Arrendamiento</strong> — Tiene su propio regimen de retenciones (diferente %)</li>
              <li><strong>IVA exento</strong> — Si no cobras IVA (servicios medicos a PF), no hay IVA que retener</li>
              <li><strong>Factura entre personas morales</strong> — Solo aplica PF → PM</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Metodo de Pago Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Metodo de Pago: PUE vs PPD</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Metodo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Significado</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Cuando usar</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Complemento de pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-bold text-green-700">PUE</td>
                  <td className="px-3 py-2">Pago en Una sola Exhibicion</td>
                  <td className="px-3 py-2 text-gray-500">El cliente paga al momento o antes de generar la factura (contado)</td>
                  <td className="px-3 py-2 text-green-600">No necesario</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-bold text-orange-700">PPD</td>
                  <td className="px-3 py-2">Pago en Parcialidades o Diferido</td>
                  <td className="px-3 py-2 text-gray-500">El cliente pagara despues (credito, parcialidades, 30/60/90 dias)</td>
                  <td className="px-3 py-2 text-red-600 font-medium">Obligatorio al recibir cada pago</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Implicacion fiscal importante</p>
            <p className="text-xs text-amber-700">
              Con <strong>PUE</strong>, el IVA se causa en el mes de la factura — lo declaras ese mes.<br/>
              Con <strong>PPD</strong>, el IVA se causa hasta que <strong>efectivamente cobras</strong> — lo declaras el mes que recibes el pago.
              Por eso los complementos de pago son cruciales: le avisan al SAT cuando realmente cobraste.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">Forma de Pago con PPD</p>
            <p className="text-xs text-gray-600">
              Cuando una factura es PPD, la "Forma de Pago" en la factura original dice <strong>"99 — Por definir"</strong>.
              La forma real de pago (transferencia, efectivo, etc.) se especifica despues en el <strong>complemento de pago</strong> (CFDI tipo P).
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">Complementos de pago (tipo P) en tu listado</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Aparecen como <strong>"Pago recibido"</strong> o <strong>"Pago emitido"</strong> en la columna Tipo</li>
              <li>No tienen subtotal, IVA ni conceptos propios — solo registran que se pago una factura previa</li>
              <li>Son obligatorios para facturas PPD: sin complemento, el SAT no sabe que ya cobraste</li>
              <li>Debes emitirlos maximo el dia 5 del mes siguiente al que recibiste el pago</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Uso CFDI Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Uso del CFDI (Clave de Uso)</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            El "Uso CFDI" indica para que usara el <strong>receptor</strong> esa factura en su contabilidad.
            Lo define quien recibe la factura, no quien la emite.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Clave</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripcion</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Uso tipico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">G01</td>
                  <td className="px-3 py-2">Adquisicion de mercancias</td>
                  <td className="px-3 py-2 text-gray-500">Compra de productos para reventa o insumos</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">G03</td>
                  <td className="px-3 py-2">Gastos en general</td>
                  <td className="px-3 py-2 text-gray-500">Servicios, renta, software, SaaS, suministros</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">I01</td>
                  <td className="px-3 py-2">Construcciones</td>
                  <td className="px-3 py-2 text-gray-500">Remodelacion de consultorio, obra</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">I02</td>
                  <td className="px-3 py-2">Mobiliario y equipo de oficina</td>
                  <td className="px-3 py-2 text-gray-500">Escritorios, sillas, equipo medico</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">I04</td>
                  <td className="px-3 py-2">Equipo de computo</td>
                  <td className="px-3 py-2 text-gray-500">Computadoras, servidores, tablets</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">D01</td>
                  <td className="px-3 py-2">Honorarios medicos, dentales y hospitalarios</td>
                  <td className="px-3 py-2 text-gray-500">Cuando un paciente deduce tu consulta en su declaracion anual</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">D02</td>
                  <td className="px-3 py-2">Gastos medicos por incapacidad</td>
                  <td className="px-3 py-2 text-gray-500">Gastos por discapacidad o enfermedad</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">S01</td>
                  <td className="px-3 py-2">Sin efectos fiscales</td>
                  <td className="px-3 py-2 text-gray-500">El receptor no la va a deducir (uso informal)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">CP01</td>
                  <td className="px-3 py-2">Pagos</td>
                  <td className="px-3 py-2 text-gray-500">Exclusivo para complementos de pago (tipo P)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Para medicos</p>
            <p className="text-xs text-blue-700">
              Cuando un paciente (persona fisica) te pide factura con uso <strong>D01</strong>, significa que va a deducir
              tu consulta en su declaracion anual como gasto medico personal. Esto es perfectamente valido y comun.
              Si el paciente no piensa deducirla, usara S01.
            </p>
          </div>
        </div>
      </section>

      {/* Regimen Fiscal Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Regimenes Fiscales para Medicos</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Regimen</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Para quien</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Limite ingresos</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">ISR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-medium">612 — Servicios Profesionales</td>
                  <td className="px-3 py-2">Medicos en consultorio privado (honorarios)</td>
                  <td className="px-3 py-2 text-gray-500">Sin limite</td>
                  <td className="px-3 py-2 text-gray-500">Tabla progresiva (1.92% a 35%)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">621 — Actividad Empresarial</td>
                  <td className="px-3 py-2">Medicos que ademas venden productos (farmacia, insumos)</td>
                  <td className="px-3 py-2 text-gray-500">Sin limite</td>
                  <td className="px-3 py-2 text-gray-500">Tabla progresiva (1.92% a 35%)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">626 — RESICO (Simplificado de Confianza)</td>
                  <td className="px-3 py-2">Medicos con ingresos menores</td>
                  <td className="px-3 py-2 text-gray-500">$3,500,000/anio</td>
                  <td className="px-3 py-2 text-gray-500">Tasa fija baja (1% a 2.5%)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">RESICO: Restricciones importantes</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
              <li>Si un solo cliente representa mas del 50% de tus ingresos, RESICO puede obligarte a retenciones especiales</li>
              <li>No puedes facturar al publico en general (siempre necesitas RFC del receptor)</li>
              <li>Si rebasas $3.5M en el anio, sales de RESICO automaticamente</li>
              <li>No puedes ser socio o accionista de persona moral</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Deducibility Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Gastos Deducibles para Medicos</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            Los gastos deducibles son facturas que <strong>recibes</strong> (aparecen como "Gasto" en tu listado)
            y que puedes restar de tus ingresos para pagar menos ISR. Deben cumplir requisitos:
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Requisitos para que un gasto sea deducible</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Estrictamente indispensable</strong> para tu actividad profesional</li>
              <li>Tener el <strong>CFDI (factura)</strong> a tu nombre y RFC</li>
              <li>Pagado con <strong>medio bancarizado</strong> si supera $2,000 MXN (transferencia, tarjeta, cheque nominativo)</li>
              <li>Registrado en tu <strong>contabilidad</strong></li>
              <li>El proveedor debe estar <strong>activo</strong> en el RFC (no en lista negra 69-B)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Gastos tipicos deducibles para un medico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Ejemplo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Renta de consultorio</td>
                    <td className="px-3 py-2 text-gray-500">Renta mensual del espacio donde consultas</td>
                    <td className="px-3 py-2 text-gray-500">100% deducible</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Insumos medicos</td>
                    <td className="px-3 py-2 text-gray-500">Guantes, jeringas, material de curacion</td>
                    <td className="px-3 py-2 text-gray-500">100% deducible</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Equipo medico</td>
                    <td className="px-3 py-2 text-gray-500">Estetoscopio, baumanometro, ultrasonido</td>
                    <td className="px-3 py-2 text-gray-500">Depreciacion anual (excepto si &lt;$4,400)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Software / SaaS</td>
                    <td className="px-3 py-2 text-gray-500">Sistema de expedientes, contabilidad, facturacion</td>
                    <td className="px-3 py-2 text-gray-500">100% deducible</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Servicios (luz, internet, tel)</td>
                    <td className="px-3 py-2 text-gray-500">Servicios del consultorio</td>
                    <td className="px-3 py-2 text-gray-500">Proporcion uso profesional</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Capacitacion / congresos</td>
                    <td className="px-3 py-2 text-gray-500">Cursos, diplomados, congresos medicos</td>
                    <td className="px-3 py-2 text-gray-500">100% si es de tu especialidad</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Vehiculo</td>
                    <td className="px-3 py-2 text-gray-500">Auto para visitas, gasolina, mantenimiento</td>
                    <td className="px-3 py-2 text-gray-500">Tope $175,000 en inversion; gasolina proporcional</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Honorarios (contador, abogado)</td>
                    <td className="px-3 py-2 text-gray-500">Servicios profesionales que contratas</td>
                    <td className="px-3 py-2 text-gray-500">100% deducible</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="font-semibold text-red-800 text-xs mb-1">Gastos NO deducibles (errores comunes)</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-red-700">
              <li>Gastos personales (supermercado, ropa, entretenimiento)</li>
              <li>Facturas a nombre de otra persona</li>
              <li>Pagos en efectivo mayores a $2,000 (aun con factura)</li>
              <li>Facturas de proveedores en lista negra del SAT (Art. 69-B)</li>
              <li>Gastos sin relacion con tu actividad profesional</li>
              <li>Donaciones a entidades no autorizadas</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Declaraciones Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Obligaciones Fiscales Periodicas</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Obligacion</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Frecuencia</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha limite</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Que se declara</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-medium">Declaracion mensual ISR</td>
                  <td className="px-3 py-2">Mensual</td>
                  <td className="px-3 py-2 text-gray-500">Dia 17 del mes siguiente</td>
                  <td className="px-3 py-2 text-gray-500">Ingresos − Deducciones = Base. Aplica tabla ISR.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Declaracion mensual IVA</td>
                  <td className="px-3 py-2">Mensual</td>
                  <td className="px-3 py-2 text-gray-500">Dia 17 del mes siguiente</td>
                  <td className="px-3 py-2 text-gray-500">IVA cobrado − IVA pagado (acreditable)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Declaracion anual</td>
                  <td className="px-3 py-2">Anual</td>
                  <td className="px-3 py-2 text-gray-500">Abril (PF)</td>
                  <td className="px-3 py-2 text-gray-500">Resumen del anio. Aqui restas retenciones que te hicieron.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">DIOT</td>
                  <td className="px-3 py-2">Mensual</td>
                  <td className="px-3 py-2 text-gray-500">Dia 17 del mes siguiente</td>
                  <td className="px-3 py-2 text-gray-500">Informativa: a quienes les pagaste IVA (proveedores)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Contabilidad electronica</td>
                  <td className="px-3 py-2">Mensual</td>
                  <td className="px-3 py-2 text-gray-500">Varies (3-5 del segundo mes)</td>
                  <td className="px-3 py-2 text-gray-500">Balanza de comprobacion y catalogo de cuentas</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="font-semibold text-green-800 text-xs mb-1">Como te ayuda esta herramienta</p>
            <p className="text-xs text-green-700">
              Con los CFDIs descargados del SAT puedes:<br/>
              • Verificar que tienes todas las facturas de ingresos y gastos del mes<br/>
              • Calcular tu IVA trasladado vs acreditable<br/>
              • Identificar facturas canceladas que ya no debes considerar<br/>
              • Preparar la informacion para tu contador antes de la fecha limite
            </p>
          </div>
        </div>
      </section>

      {/* Edge Cases Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Casos Especiales y Edge Cases</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Facturas canceladas</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Una factura cancelada <strong>no cuenta</strong> para ingresos ni gastos</li>
              <li>Si ya la declaraste y luego se cancela, debes hacer declaracion complementaria</li>
              <li>El SAT tiene proceso de cancelacion con aceptacion del receptor (72h para responder)</li>
              <li>Facturas menores a $1,000 o al publico en general se cancelan sin aceptacion</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Notas de credito (Egreso)</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Son CFDIs tipo "E" que <strong>reducen</strong> el ingreso de una factura previa</li>
              <li>Si emites una nota de credito, reduces tu ingreso declarado (y el IVA correspondiente)</li>
              <li>Si recibes una nota de credito, tu gasto deducible se reduce</li>
              <li>Deben referenciar el UUID de la factura original</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Facturas en moneda extranjera (USD)</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>El tipo de cambio en la factura es el del dia de emision (DOF)</li>
              <li>Para declarar, conviertes a MXN usando ese tipo de cambio</li>
              <li>Si cobras en una fecha distinta, la diferencia cambiaria es ingreso/gasto adicional</li>
              <li>El campo "TipoCambio" en el XML muestra la tasa usada</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Facturas de periodos anteriores</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Un gasto es deducible en el <strong>ejercicio en que se paga</strong>, no cuando se factura</li>
              <li>Si recibes una factura de diciembre pero la pagas en enero, se deduce en enero</li>
              <li>Excepcion: facturas PUE se consideran pagadas en el mes de emision</li>
              <li>Puedes deducir facturas de hasta 10 dias antes del inicio del mes (regla de devengo)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Sueldos y salarios (si tienes empleados)</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li>Las facturas de nomina (tipo N) que emites a tus empleados son <strong>gasto deducible</strong> para ti</li>
              <li>Debes retenerles ISR y enterar cuotas IMSS/INFONAVIT</li>
              <li>La nomina aparece como "emitida" en tu listado (tu eres el emisor)</li>
              <li>No confundir con nomina "recibida" (eso seria si tu eres empleado de alguien)</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Disclaimer</p>
            <p className="text-xs text-gray-500">
              Esta guia es informativa y no sustituye el consejo de un contador publico certificado.
              Las leyes fiscales cambian frecuentemente. Consulta a tu contador para decisiones
              especificas sobre tu situacion fiscal.
            </p>
          </div>
        </div>
      </section>
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
          <p>La descarga tiene <strong>dos capas</strong> de información:</p>

          <div className="mt-2">
            <p className="font-semibold text-gray-800">1. Metadata (listado básico)</p>
            <p className="text-xs text-gray-500 mb-1">Se obtiene rápido — es lo que ves en la tabla principal.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>UUID (folio fiscal único)</li>
              <li>Emisor y receptor (nombre + RFC)</li>
              <li>Monto total</li>
              <li>Fecha de emisión y certificación</li>
              <li>Tipo de comprobante (Ingreso, Egreso, Pago, Traslado)</li>
              <li>Status (Vigente / Cancelado)</li>
              <li>PAC que certificó</li>
            </ul>
          </div>

          <div className="mt-3">
            <p className="font-semibold text-gray-800">2. XML (desglose fiscal completo)</p>
            <p className="text-xs text-gray-500 mb-1">Se descarga por separado — es lo que ves al hacer clic en "Ver detalles XML".</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Subtotal (monto antes de impuestos)</li>
              <li>IVA trasladado (16% cobrado al cliente)</li>
              <li>ISR retenido (retención de ISR que te hacen)</li>
              <li>IVA retenido (retención de IVA — personas morales)</li>
              <li>Descuentos aplicados</li>
              <li>Método de pago: PUE (una exhibición) o PPD (parcialidades)</li>
              <li>Forma de pago: efectivo, transferencia, tarjeta, cheque, etc.</li>
              <li>Uso CFDI: G01 (adquisición), G03 (gastos), D01 (honorarios médicos), etc.</li>
              <li>Moneda y tipo de cambio (para facturas en USD)</li>
              <li>Serie y folio (numeración interna del emisor)</li>
              <li>Conceptos: cada línea de la factura con descripción, cantidad, precio unitario, importe e IVA</li>
            </ul>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            El tipo "Completa" descarga ambas capas en una sola acción. Si solo quieres el listado
            sin desglose, usa "Solo metadata".
          </p>
        </div>
      </section>

      {/* XML Details explanation */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Detalles XML — ¿Para qué sirve cada campo?</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            Al expandir un CFDI y hacer clic en <strong>"Ver detalles XML"</strong>, se muestra el desglose
            fiscal completo extraído del XML original. Aquí una explicación de cada sección:
          </p>

          <div className="mt-3">
            <p className="font-semibold text-gray-800 mb-1">Desglose financiero</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Campo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Qué es</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Ejemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Subtotal</td>
                    <td className="px-3 py-2 text-gray-500">Suma de conceptos antes de impuestos</td>
                    <td className="px-3 py-2 font-mono">$8,620.69</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">IVA Trasladado</td>
                    <td className="px-3 py-2 text-gray-500">Impuesto al 16% que se cobra al cliente. Algunos productos tienen tasa 0% (alimentos básicos, medicinas).</td>
                    <td className="px-3 py-2 font-mono">$1,379.31</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">ISR Retenido</td>
                    <td className="px-3 py-2 text-gray-500">Retención de Impuesto Sobre la Renta. Aplica cuando una persona moral te paga honorarios (te retienen el 10%).</td>
                    <td className="px-3 py-2 font-mono">$862.07</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">IVA Retenido</td>
                    <td className="px-3 py-2 text-gray-500">Retención de IVA (2/3 del IVA). Aplica en servicios profesionales de persona física a moral.</td>
                    <td className="px-3 py-2 font-mono">$689.66</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Total</td>
                    <td className="px-3 py-2 text-gray-500">Subtotal + IVA − Retenciones − Descuentos = lo que efectivamente se cobra/paga</td>
                    <td className="px-3 py-2 font-mono">$10,000.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <p className="font-semibold text-gray-800 mb-1">Información de pago</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Campo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Qué es</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Valores comunes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Método de Pago</td>
                    <td className="px-3 py-2 text-gray-500">Cuándo se paga la factura</td>
                    <td className="px-3 py-2"><strong>PUE</strong> = pago en una sola exhibición (contado) • <strong>PPD</strong> = pago en parcialidades o diferido (crédito)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Forma de Pago</td>
                    <td className="px-3 py-2 text-gray-500">Cómo se paga</td>
                    <td className="px-3 py-2">01=Efectivo • 02=Cheque • 03=Transferencia • 04=Tarjeta crédito • 28=Tarjeta débito • 99=Por definir</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Uso CFDI</td>
                    <td className="px-3 py-2 text-gray-500">Para qué usará el receptor este CFDI fiscalmente</td>
                    <td className="px-3 py-2">G01=Adquisición de mercancías • G03=Gastos en general • D01=Honorarios médicos • S01=Sin efectos fiscales</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Moneda</td>
                    <td className="px-3 py-2 text-gray-500">Moneda de la factura</td>
                    <td className="px-3 py-2">MXN (pesos) • USD (dólares) — si es USD incluye tipo de cambio</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <p className="font-semibold text-gray-800 mb-1">Conceptos (líneas de la factura)</p>
            <p className="text-gray-600">
              Cada factura tiene uno o más conceptos. Cada concepto es un producto o servicio facturado
              con su descripción, cantidad, precio unitario e importe. Los conceptos son útiles para:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Deducibilidad</strong> — Verificar que la descripción coincide con un gasto deducible</li>
              <li><strong>Clasificación</strong> — La clave de producto/servicio SAT indica la categoría fiscal</li>
              <li><strong>Auditoría</strong> — Revisar que cantidades y precios coinciden con lo acordado</li>
              <li><strong>IVA por concepto</strong> — Algunos conceptos tienen IVA 0% (alimentos, medicinas) y otros 16%</li>
            </ul>
          </div>

          <p className="text-xs text-gray-500 mt-4 border-t border-gray-100 pt-3">
            <strong>Nota:</strong> No todos los campos están presentes en todas las facturas. Por ejemplo,
            los complementos de pago (tipo P) no tienen subtotal ni conceptos con importe — solo registran
            que se realizó un pago asociado a una factura previa.
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
            <th className="pb-2 pr-4 font-medium">Tipo</th>
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
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  job.requestType === "xml" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
                }`}>
                  {job.requestType === "xml" ? "XML" : "Metadata"}
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
