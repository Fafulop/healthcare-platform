"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
  Bell,
  X,
  BookmarkPlus,
  BookmarkCheck,
  Link2,
  Unlink,
  Calculator,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { SAT_FORMA_PAGO_LABELS, ORIGIN_LABELS } from "@/app/dashboard/practice/flujo-de-dinero/_components/ledger-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------


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

  const [activeTab, setActiveTab] = useState<"cfdi" | "resumen" | "deducciones" | "declaraciones" | "cobranza" | "guia" | "ayuda">("cfdi");
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-6 h-6 text-purple-600" />
            Descarga Masiva SAT
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta y descarga tus CFDIs emitidos y recibidos directamente del SAT
          </p>
        </div>
        <AlertsBell />
      </div>

      {/* Sync trigger */}
      <SyncTrigger month={month} setMonth={setMonth} />

      {/* Backfill */}
      <BackfillSection />

      {/* Fiscal Calendar */}
      <FiscalCalendarBanner />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 mt-6">
        <div className="flex gap-6">
          <TabBtn active={activeTab === "cfdi"} onClick={() => setActiveTab("cfdi")} label="CFDIs Descargados" />
          <TabBtn active={activeTab === "resumen"} onClick={() => setActiveTab("resumen")} label="Resumen Fiscal" />
          <TabBtn active={activeTab === "deducciones"} onClick={() => setActiveTab("deducciones")} label="Deducciones" />
          <TabBtn active={activeTab === "declaraciones"} onClick={() => setActiveTab("declaraciones")} label="Declaraciones" />
          <TabBtn active={activeTab === "cobranza"} onClick={() => setActiveTab("cobranza")} label="Cobranza" />
          <TabBtn active={activeTab === "guia"} onClick={() => setActiveTab("guia")} label="Guia" />
          <TabBtn active={activeTab === "ayuda"} onClick={() => setActiveTab("ayuda")} label="Ayuda" />
        </div>
      </div>

      {activeTab === "cfdi" && (
        <CfdiList direction={direction} setDirection={setDirection} month={month} />
      )}
      {activeTab === "resumen" && <ResumenFiscal />}
      {activeTab === "deducciones" && <DeduccionesTab />}
      {activeTab === "declaraciones" && <DeclaracionesTab />}
      {activeTab === "cobranza" && <CobranzaTab />}
      {activeTab === "guia" && <GuiaTab />}
      {activeTab === "ayuda" && <AyudaTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fiscal Calendar Banner
// ---------------------------------------------------------------------------

interface FiscalDeadline {
  name: string;
  description: string;
  date: Date;
  daysLeft: number;
}

function getFiscalDeadlines(): FiscalDeadline[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  const deadlines: FiscalDeadline[] = [];

  // Day 17 of current month: ISR provisional + IVA + DIOT (for previous month)
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const day17current = new Date(year, month, 17);
  const prevMonthName = monthNames[month === 0 ? 11 : month - 1];
  deadlines.push({
    name: `Declaracion mensual (${prevMonthName})`,
    description: 'ISR provisional + IVA mensual + DIOT',
    date: day17current,
    daysLeft: Math.ceil((day17current.getTime() - today.getTime()) / 86400000),
  });

  // Day 17 of next month
  const nextMonth = month + 1 > 11 ? 0 : month + 1;
  const nextMonthYear = month + 1 > 11 ? year + 1 : year;
  const day17next = new Date(nextMonthYear, nextMonth, 17);
  const currentMonthName = monthNames[month];
  deadlines.push({
    name: `Declaracion mensual (${currentMonthName})`,
    description: 'ISR provisional + IVA mensual + DIOT',
    date: day17next,
    daysLeft: Math.ceil((day17next.getTime() - today.getTime()) / 86400000),
  });

  // April 30: Declaracion anual PF (shown Jan–May 7 approx, filtered by daysLeft >= -7 below)
  const april30 = new Date(year, 3, 30);
  deadlines.push({
    name: 'Declaracion anual PF',
    description: 'Declaracion anual de personas fisicas',
    date: april30,
    daysLeft: Math.ceil((april30.getTime() - today.getTime()) / 86400000),
  });

  // Sort by date, filter out deadlines more than 7 days overdue, take next 3
  return deadlines
    .filter(d => d.daysLeft >= -7)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);
}

function FiscalCalendarBanner() {
  const deadlines = getFiscalDeadlines();
  if (deadlines.length === 0) return null;

  const nearest = deadlines[0];
  const isUrgent = nearest.daysLeft <= 3 && nearest.daysLeft >= 0;
  const isOverdue = nearest.daysLeft < 0;

  const bannerColor = isOverdue
    ? 'bg-red-50 border-red-200'
    : isUrgent
    ? 'bg-amber-50 border-amber-200'
    : 'bg-blue-50 border-blue-200';

  const iconColor = isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className={`rounded-lg border p-4 mt-4 ${bannerColor}`}>
      <div className="flex items-start gap-3">
        <CalendarClock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Calendario Fiscal</h3>
          <div className="mt-2 space-y-2">
            {deadlines.map((d, i) => {
              const color = d.daysLeft < 0
                ? 'text-red-700'
                : d.daysLeft <= 3
                ? 'text-amber-700'
                : 'text-gray-700';
              const badge = d.daysLeft < 0
                ? 'bg-red-100 text-red-700'
                : d.daysLeft === 0
                ? 'bg-amber-100 text-amber-700'
                : d.daysLeft <= 3
                ? 'bg-amber-50 text-amber-600'
                : 'bg-gray-100 text-gray-600';
              const label = d.daysLeft < 0
                ? `${Math.abs(d.daysLeft)}d vencido`
                : d.daysLeft === 0
                ? 'Hoy'
                : `${d.daysLeft}d`;
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${color}`}>{d.name}</span>
                    <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{d.description}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 hidden sm:inline">
                      {d.date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const triggerSync = async () => {
    setSyncing(true);
    setMessage(null);
    const results: string[] = [];
    const errors: string[] = [];
    for (const dir of ["received", "emitted"] as const) {
      try {
        const res = await authFetch(`${API_URL}/api/sat-descarga/sync`, {
          method: "POST",
          body: JSON.stringify({ direction: dir, month, requestType: "full" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al crear sincronización");
        const jobId = Array.isArray(json.data) ? json.data.map((j: any) => `#${j.id}`).join(', ') : `#${json.data.id}`;
        results.push(`${dir === "emitted" ? "Emitidos" : "Recibidos"} (Job ${jobId})`);
      } catch (err: any) {
        errors.push(`${dir === "emitted" ? "Emitidos" : "Recibidos"}: ${err.message}`);
      }
    }
    if (results.length > 0 && errors.length === 0) {
      setMessage({ type: "success", text: `Sincronización creada: ${results.join(" + ")}. Se procesará en unos minutos.` });
    } else if (results.length > 0) {
      setMessage({ type: "success", text: `Parcial: ${results.join(" + ")}. Errores: ${errors.join("; ")}` });
    } else {
      setMessage({ type: "error", text: errors.join("; ") });
    }
    setSyncing(false);
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
          onClick={triggerSync}
          disabled={syncing}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descarga Manual Mensual
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Descarga metadata y XML de todos los CFDIs emitidos y recibidos del mes seleccionado.
      </p>

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
// Backfill Section
// ---------------------------------------------------------------------------

function BackfillSection() {
  const [progress, setProgress] = useState<{ totalMonths: number; completedMonths: number; activeJobs: number; fromMonth: string; toMonth: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/backfill`);
      if (res.ok) {
        const json = await res.json();
        setProgress(json.data);
      }
    } catch (err) {
      // silently fail — not critical
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const triggerBackfill = async (force = false) => {
    setBackfilling(true);
    setMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/backfill`, {
        method: "POST",
        body: JSON.stringify({ fromMonth: "2025-01", force }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Error al crear backfill" });
      } else {
        const parts = [];
        if (json.data.created > 0) parts.push(`${json.data.created} jobs nuevos`);
        if (json.data.reset > 0) parts.push(`${json.data.reset} XMLs re-sincronizados`);
        if (json.data.skipped > 0) parts.push(`${json.data.skipped} ya existentes`);
        setMessage({ type: "success", text: `Backfill: ${parts.join(', ')}. Se procesarán gradualmente.` });
        fetchProgress();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error de red al crear backfill" });
    } finally {
      setBackfilling(false);
    }
  };

  if (!progress) return null;

  const isComplete = progress.completedMonths >= progress.totalMonths;
  const pct = progress.totalMonths > 0 ? Math.round((progress.completedMonths / progress.totalMonths) * 100) : 0;

  return (
    <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Historial completo</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isComplete
              ? `Todos los meses sincronizados (${progress.fromMonth} a ${progress.toMonth})`
              : `${progress.completedMonths} de ${progress.totalMonths} meses completados (${progress.fromMonth} a ${progress.toMonth})`
            }
            {progress.activeJobs > 0 && ` · ${progress.activeJobs} jobs activos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <button
              onClick={() => triggerBackfill(false)}
              disabled={backfilling}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-md hover:bg-purple-100 border border-purple-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Descargar historico
            </button>
          )}
          {isComplete && (
            <button
              onClick={() => triggerBackfill(true)}
              disabled={backfilling}
              className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-100 border border-amber-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Re-sincronizar XMLs
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isComplete && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {message && (
        <div className={`mt-3 p-2 rounded text-xs flex items-center gap-1.5 ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
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
  const [registeredMap, setRegisteredMap] = useState<Record<string, number>>({});
  const [registering, setRegistering] = useState<string | null>(null); // uuid being registered
  const [suggestionModal, setSuggestionModal] = useState<{
    uuid: string;
    suggestions: { ledgerEntryId: number; score: number; confidence: 'high' | 'medium'; concept: string; origin: string; amount: number; transactionDate: string }[];
  } | null>(null);
  const [linking, setLinking] = useState<number | null>(null); // ledgerEntryId being linked
  const [deducibilityFlags, setDeducibilityFlags] = useState<Record<string, Array<{ type: string; severity: string; message: string }>>>({});

  // Check which CFDIs are already registered as LedgerEntries
  const checkRegistered = useCallback(async (uuids: string[]) => {
    if (uuids.length === 0) return;
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/register-to-ledger?uuids=${uuids.join(",")}`);
      if (res.ok) {
        const { data: map } = await res.json();
        setRegisteredMap(prev => ({ ...prev, ...map }));
      }
    } catch { /* silent */ }
  }, []);

  const registerCfdi = async (uuid: string, skipMatch = false) => {
    setRegistering(uuid);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/register-to-ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuids: [uuid],
          ...(skipMatch ? { skipMatchUuids: [uuid] } : {}),
        }),
      });
      if (res.ok) {
        const result = await res.json();
        const entry = result.data?.entries?.[0];
        if (entry) {
          if (entry.action === 'suggestion') {
            // Open modal with suggestions — user picks one to link or creates new
            setSuggestionModal({ uuid, suggestions: entry.suggestions || [] });
          } else {
            // action === 'created'
            setRegisteredMap(prev => ({ ...prev, [uuid]: entry.ledgerEntryId }));
          }
        }
      } else {
        const err = await res.json();
        alert(err.error || "Error al registrar");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRegistering(null);
    }
  };

  const handleSuggestionLink = async (ledgerEntryId: number) => {
    if (!suggestionModal) return;
    setLinking(ledgerEntryId);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ledger/${ledgerEntryId}/link-cfdi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: suggestionModal.uuid }),
      });
      if (res.ok) {
        setRegisteredMap(prev => ({ ...prev, [suggestionModal.uuid]: ledgerEntryId }));
        setSuggestionModal(null);
      } else {
        const err = await res.json();
        alert(err.error || "Error al vincular");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLinking(null);
    }
  };

  const handleSuggestionCreateNew = async () => {
    if (!suggestionModal) return;
    setSuggestionModal(null);
    await registerCfdi(suggestionModal.uuid, true);
  };

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

  // When data loads, check which are registered
  useEffect(() => {
    if (data?.data) {
      const uuids = data.data.map(c => c.uuid);
      checkRegistered(uuids);
    }
  }, [data, checkRegistered]);

  // Fetch deducibility flags for the current month
  useEffect(() => {
    if (!month) return;
    const yearFromMonth = month.slice(0, 4);
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/sat-descarga/check-deducibility?year=${yearFromMonth}`);
        if (res.ok) {
          const json = await res.json();
          const flagMap: Record<string, Array<{ type: string; severity: string; message: string }>> = {};
          for (const cfdi of json.data?.flaggedCfdis || []) {
            flagMap[cfdi.uuid] = cfdi.flags;
          }
          setDeducibilityFlags(flagMap);
        }
      } catch { /* silent */ }
    })();
  }, [month]);

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
                  <th className="pb-2 font-medium text-center text-xs text-gray-500">Registro</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <CfdiRow
                    key={item.id}
                    item={item}
                    isRegistered={!!registeredMap[item.uuid]}
                    registering={registering === item.uuid}
                    onRegister={registerCfdi}
                    deducibilityFlags={deducibilityFlags[item.uuid]}
                  />
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

      {/* Suggestion Modal — matches found for a CFDI */}
      {suggestionModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSuggestionModal(null)}
          onKeyDown={e => { if (e.key === 'Escape') setSuggestionModal(null); }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-md sm:rounded-xl rounded-t-2xl bg-white shadow-xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Movimientos similares encontrados</h3>
                <p className="text-xs text-gray-500 mt-0.5">Selecciona uno para vincular o crea un movimiento nuevo</p>
              </div>
              <button onClick={() => setSuggestionModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Suggestions list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {suggestionModal.suggestions.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No se encontraron movimientos similares
                </div>
              )}
              {suggestionModal.suggestions.map((s) => {
                const originInfo = ORIGIN_LABELS[s.origin] || { label: s.origin, color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={s.ledgerEntryId} className="px-5 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            s.confidence === 'high' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {s.confidence === 'high' ? 'Alta' : 'Media'}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${originInfo.color}`}>
                            {originInfo.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{s.concept || 'Sin concepto'}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>${Number(s.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                          <span>&middot;</span>
                          <span>{new Date(s.transactionDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSuggestionLink(s.ledgerEntryId)}
                        disabled={linking !== null}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      >
                        {linking === s.ledgerEntryId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Link2 className="w-3 h-3" />
                        )}
                        Vincular
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleSuggestionCreateNew}
                disabled={linking !== null}
                className="flex-1 px-4 py-2.5 border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                Crear movimiento nuevo
              </button>
              <button
                onClick={() => setSuggestionModal(null)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
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

function CfdiRow({ item, isRegistered, registering, onRegister, deducibilityFlags }: {
  item: CfdiMetadata;
  isRegistered: boolean;
  registering: boolean;
  onRegister: (uuid: string) => void;
  deducibilityFlags?: Array<{ type: string; severity: string; message: string }>;
}) {
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

  const formaPagoLabels = SAT_FORMA_PAGO_LABELS;

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
          {item.efecto === 'P' && Number(item.monto) === 0
            ? <span className="text-gray-400 text-xs font-sans">Comp. Pago</span>
            : `$${Number(item.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
        </td>
        <td className="py-2.5 pr-4">
          <span className={`text-xs font-medium ${impact.color}`}>
            {impact.label}
          </span>
        </td>
        <td className="py-2.5">
          <div className="flex items-center gap-1">
            {item.satStatus === "Vigente" ? (
              <span className="text-xs text-green-600 font-medium">Vigente</span>
            ) : (
              <span className="text-xs text-red-500 font-medium">Cancelado</span>
            )}
            {deducibilityFlags && deducibilityFlags.length > 0 && (
              <span
                title={deducibilityFlags.map(f => f.message).join('\n')}
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                  deducibilityFlags.some(f => f.severity === 'error') ? 'bg-red-100 text-red-600' :
                  deducibilityFlags.some(f => f.severity === 'warning') ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}
              >
                {deducibilityFlags.some(f => f.severity === 'error') ? '!' :
                 deducibilityFlags.some(f => f.severity === 'warning') ? '!' : 'i'}
              </span>
            )}
          </div>
        </td>
        <td className="py-2.5 text-center">
          {isRegistered ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <BookmarkCheck className="w-3.5 h-3.5" />
              Registrado
            </span>
          ) : item.satStatus === "Vigente" ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRegister(item.uuid); }}
              disabled={registering}
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              {registering ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5" />
              )}
              Registrar
            </button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50/50">
          <td colSpan={7} className="px-4 py-3">
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

            {/* Deducibility flags */}
            {deducibilityFlags && deducibilityFlags.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1.5">Alertas de deducibilidad</p>
                <div className="flex flex-wrap gap-1.5">
                  {deducibilityFlags.map((f, i) => (
                    <span key={i} className={`text-[11px] px-2 py-0.5 rounded ${
                      f.severity === 'error' ? 'bg-red-100 text-red-700' :
                      f.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {f.severity === 'error' ? '✕ ' : f.severity === 'warning' ? '⚠ ' : 'ℹ '}{f.message}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              {xmlDetail && <XmlDetailPanel detail={xmlDetail} formaPagoLabels={formaPagoLabels} issuerRfc={item.issuerRfc} />}
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

function XmlDetailPanel({ detail, formaPagoLabels, issuerRfc }: { detail: CfdiDetailData; formaPagoLabels: Record<string, string>; issuerRfc?: string }) {
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

      {/* Payment status for PPD invoices */}
      {detail.metodoPago === "PPD" && <PagoStatusBadge uuid={detail.uuid} issuerRfc={issuerRfc} />}

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

// ---------------------------------------------------------------------------
// Payment Status Badge (for PPD invoices)
// ---------------------------------------------------------------------------

function PagoStatusBadge({ uuid, issuerRfc }: { uuid: string; issuerRfc?: string }) {
  const [data, setData] = useState<{
    totalPagado: number; saldoInsoluto: number | null; status: string;
    pagos: { id: number; pagoUuid: string; montoPagado: number | null; source: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    authFetch(`${API_URL}/api/sat-descarga/pagos?uuid=${uuid}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data) {
          setData({
            totalPagado: json.data.totalPagado,
            saldoInsoluto: json.data.saldoInsoluto,
            status: json.data.status,
            pagos: (json.data.pagos ?? []).map((p: any) => ({
              id: p.id, pagoUuid: p.pagoUuid,
              montoPagado: typeof p.montoPagado === 'object' ? Number(p.montoPagado) : p.montoPagado,
              source: p.source ?? 'auto',
            })),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uuid]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleUnlink = async (pagoId: number) => {
    if (!confirm("¿Desvincular este complemento de pago de la factura?")) return;
    setActing(true);
    try {
      await authFetch(`${API_URL}/api/sat-descarga/pagos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pagoId, action: "unlink" }),
      });
      fetchStatus();
    } catch {}
    setActing(false);
  };

  const handleManualLink = async (pagoUuid: string) => {
    setActing(true);
    try {
      await authFetch(`${API_URL}/api/sat-descarga/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagoUuid, facturaUuid: uuid }),
      });
      setShowLinkModal(false);
      fetchStatus();
    } catch {}
    setActing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Verificando pagos...
      </div>
    );
  }

  if (!data) return null;

  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

  const badgeStyles: Record<string, string> = {
    pagado: "bg-green-100 text-green-700 border-green-200",
    parcial: "bg-yellow-100 text-yellow-700 border-yellow-200",
    pendiente: "bg-red-100 text-red-700 border-red-200",
  };

  const badgeLabels: Record<string, string> = {
    pagado: "Pagado",
    parcial: "Pago parcial",
    pendiente: "Pago pendiente",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-2 rounded-md bg-gray-50 border border-gray-200">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${badgeStyles[data.status] || badgeStyles.pendiente}`}>
          {data.status === "pagado" && <CheckCircle2 className="w-3 h-3" />}
          {data.status === "parcial" && <Clock className="w-3 h-3" />}
          {data.status === "pendiente" && <AlertCircle className="w-3 h-3" />}
          {badgeLabels[data.status] || "Pendiente"}
        </span>
        {data.pagos.length > 0 && (
          <span className="text-xs text-gray-600">
            {data.pagos.length} pago{data.pagos.length > 1 ? "s" : ""} — Total: {fmt(data.totalPagado)}
            {data.saldoInsoluto !== null && data.saldoInsoluto > 0 && ` — Saldo: ${fmt(data.saldoInsoluto)}`}
          </span>
        )}
        {data.pagos.length === 0 && (
          <span className="text-xs text-gray-500">Sin complementos de pago registrados</span>
        )}
        <button
          onClick={() => setShowLinkModal(true)}
          disabled={acting}
          className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          title="Vincular complemento manualmente"
        >
          <Link2 className="w-3 h-3" />
          Vincular
        </button>
      </div>

      {data.pagos.length > 0 && (
        <div className="space-y-1 pl-2">
          {data.pagos.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono text-gray-400">{p.pagoUuid.slice(0, 8)}...</span>
              {p.montoPagado !== null && <span>{fmt(p.montoPagado)}</span>}
              {p.source === "manual" && (
                <span className="text-blue-500 text-[10px] font-medium">(manual)</span>
              )}
              <button
                onClick={() => handleUnlink(p.id)}
                disabled={acting}
                className="inline-flex items-center gap-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                title="Desvincular este complemento"
              >
                <Unlink className="w-3 h-3" />
                Desvincular
              </button>
            </div>
          ))}
        </div>
      )}

      {showLinkModal && (
        <ManualLinkModal
          facturaUuid={uuid}
          issuerRfc={issuerRfc}
          onLink={handleManualLink}
          onClose={() => setShowLinkModal(false)}
          acting={acting}
        />
      )}
    </div>
  );
}

function ManualLinkModal({ facturaUuid, issuerRfc, onLink, onClose, acting }: {
  facturaUuid: string; issuerRfc?: string;
  onLink: (pagoUuid: string) => void; onClose: () => void; acting: boolean;
}) {
  const [complementos, setComplementos] = useState<{ uuid: string; issuerName: string; issuedAt: string; folio: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available complementos de pago (tipo P) that could match
    authFetch(`${API_URL}/api/sat-descarga/metadata?efecto=P&limit=200`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (Array.isArray(json?.data)) {
          const filtered = (json.data as any[])
            .filter((c: any) => {
              // Only show complementos where the target RFC is the issuer.
              // Cobranza: receiverRfc (customer) should be the issuer of the pago complement.
              // CFDI detail: issuerRfc (vendor) should be the issuer of the pago complement.
              if (issuerRfc && c.issuerRfc !== issuerRfc) return false;
              return true;
            })
            .map((c: any) => ({
              uuid: c.uuid,
              issuerName: c.issuerName || c.issuerRfc,
              issuedAt: c.issuedAt,
              folio: c.folio || null,
            }));
          setComplementos(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [issuerRfc]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Vincular complemento de pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando complementos...
            </div>
          ) : complementos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No se encontraron complementos de pago disponibles{issuerRfc ? ` para RFC ${issuerRfc}` : ""}.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Selecciona el complemento de pago que corresponde a esta factura:
              </p>
              {complementos.map(c => (
                <button
                  key={c.uuid}
                  onClick={() => onLink(c.uuid)}
                  disabled={acting}
                  className="w-full text-left p-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.issuerName}</span>
                    {c.folio && <span className="text-xs text-gray-400">Folio: {c.folio}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="font-mono">{c.uuid.slice(0, 8)}...{c.uuid.slice(-4)}</span>
                    <span className="mx-2">·</span>
                    {new Date(c.issuedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
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

      {/* Accountant report download */}
      <AccountantReportSection year={year} />
    </div>
  );
}

function AccountantReportSection({ year }: { year: number }) {
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    // Default to previous month (most common use case for accountants)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return prev.getMonth() + 1;
  });
  const [reportFormat, setReportFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');

  const monthParam = `${year}-${String(reportMonth).padStart(2, "0")}`;
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const formatSuffix = `&format=${reportFormat}`;

  return (
    <div className="bg-white rounded-lg border border-purple-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
        Reporte para Contador
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        Descarga el reporte con toda la informacion necesaria para que tu contador haga la declaracion mensual o anual:
        ISR, IVA, detalle de CFDIs, retenciones por cliente, y gastos no deducibles.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={reportMonth}
          onChange={e => setReportMonth(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          {monthNames.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={reportFormat}
          onChange={e => setReportFormat(e.target.value as 'xlsx' | 'csv' | 'pdf')}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
        <ExportButton
          label={`Reporte ${monthNames[reportMonth - 1]}`}
          href={`${API_URL}/api/sat-descarga/export/accountant-report?month=${monthParam}${formatSuffix}`}
        />
        <ExportButton
          label={`Reporte Anual ${year}`}
          href={`${API_URL}/api/sat-descarga/export/accountant-report?period=annual&year=${year}${formatSuffix}`}
          secondary
        />
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
// Alerts Bell
// ---------------------------------------------------------------------------

interface SatAlertItem {
  id: number;
  type: string;
  uuid: string | null;
  direction: string | null;
  issuerName: string | null;
  monto: string | null;
  message: string | null;
  read: boolean;
  createdAt: string;
}

function AlertsBell() {
  const [alerts, setAlerts] = useState<SatAlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/alerts?limit=20`);
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.data.alerts);
        setUnreadCount(json.data.unreadCount);
      }
    } catch (err) {
      // silent
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const markAllRead = async () => {
    try {
      await authFetch(`${API_URL}/api/sat-descarga/alerts`, {
        method: "PATCH",
        body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (err) {
      // silent
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">Alertas SAT</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-purple-800">
                  Marcar leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              Sin alertas
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map(alert => (
                <div key={alert.id} className={`px-3 py-2.5 ${!alert.read ? "bg-purple-50/50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      alert.type === "cancelled" ? "bg-red-500" : "bg-green-500"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">{alert.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(alert.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
      // Derive extension from URL format param as fallback
      const formatMatch = href.match(/[?&]format=(xlsx|csv|pdf)/);
      const ext = formatMatch?.[1] || 'xlsx';
      const filename = filenameMatch?.[1] || `export.${ext}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al exportar reporte");
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
// Deducciones Tab — Categorized expenses (612) / Expense overview (RESICO)
// ---------------------------------------------------------------------------

interface DeductionCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  subtotal: number;
  iva: number;
  flaggedCount: number;
  cfdiSamples: Array<{
    uuid: string;
    issuerName: string | null;
    issuerRfc: string;
    subtotal: number;
    issuedAt: string;
    categoryId: string;
    flags: Array<{ type: string; message: string }>;
  }>;
}

interface DeductionsResponse {
  year: number;
  regimenFiscal: string;
  categories: DeductionCategory[];
  months: Array<{
    month: number;
    categories: Record<string, { count: number; subtotal: number; iva: number }>;
  }>;
  totals: {
    count: number;
    subtotal: number;
    iva: number;
    nonDeductible: number;
    flagged: number;
  };
  alerts: Array<{ type: string; message: string; count: number }>;
  resicoMonitor?: {
    ytdIncome: number;
    limit: number;
    percentage: number;
  };
}

function DeduccionesTab() {
  const [data, setData] = useState<DeductionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const fetchDeductions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/deductions?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching deductions:', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchDeductions(); }, [fetchDeductions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Calculando deducciones...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>No se pudieron cargar las deducciones. Intenta de nuevo.</p>
      </div>
    );
  }

  const isResico = data.regimenFiscal === '626';
  const fmtMoney = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isResico ? 'Gastos del Ejercicio' : 'Deducciones Fiscales'} — {year}
        </h2>
        <YearSelector year={year} setYear={setYear} />
      </div>

      {/* RESICO banner */}
      {isResico && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium">
            RESICO: Tus gastos no reducen ISR, pero el IVA sí es acreditable.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Tu ISR se calcula sobre ingresos brutos a tasa fija (1% a 2.5%) — los gastos no lo reducen.
            Sin embargo, el <strong>IVA de tus gastos sí es acreditable</strong> contra el IVA que cobras (regla 3.13.20 RMF),
            siempre que sean gastos indispensables, con CFDI válido y pagados con medios bancarios.
          </p>
        </div>
      )}

      {/* RESICO income monitor */}
      {isResico && data.resicoMonitor && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Monitor de Ingresos RESICO</h3>
            <span className={`text-sm font-bold ${
              data.resicoMonitor.percentage > 90 ? 'text-red-600' :
              data.resicoMonitor.percentage > 70 ? 'text-amber-600' : 'text-green-600'
            }`}>
              {data.resicoMonitor.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all ${
                data.resicoMonitor.percentage > 90 ? 'bg-red-500' :
                data.resicoMonitor.percentage > 70 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(data.resicoMonitor.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Ingresos YTD: {fmtMoney(data.resicoMonitor.ytdIncome)}</span>
            <span>Límite: {fmtMoney(data.resicoMonitor.limit)}</span>
          </div>
          {data.resicoMonitor.percentage > 80 && (
            <p className="text-xs text-red-600 mt-2 font-medium">
              Te acercas al límite de $3.5M. Si lo excedes, el SAT puede cambiarte a Régimen 612.
            </p>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Gastos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmtMoney(data.totals.subtotal)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.totals.count} CFDIs</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">IVA Acreditable</p>
          <p className="text-xl font-bold text-green-700 mt-1">{fmtMoney(data.totals.iva)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{isResico ? 'Aplica en RESICO (regla 3.13.20)' : 'Para declaración mensual'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            {isResico ? 'Sin IVA Acreditable' : 'No Deducible'}
          </p>
          <p className="text-xl font-bold text-red-600 mt-1">{fmtMoney(data.totals.nonDeductible)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isResico ? 'S01, efectivo >$2k' : 'S01, efectivo >$2k, cancelados'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Con Alertas</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{data.totals.flagged}</p>
          <p className="text-xs text-gray-400 mt-0.5">requieren revisión</p>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm p-3 rounded-md border ${
              alert.type === 'cash_over_2k' || alert.type === 'sin_efectos' ? 'bg-red-50 border-red-200 text-red-700' :
              alert.type === 'sin_clasificar' ? 'bg-amber-50 border-amber-200 text-amber-700' :
              alert.type === 'no_xml' ? 'bg-gray-50 border-gray-200 text-gray-600' :
              'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {data.categories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No se encontraron gastos recibidos en {year}.</p>
          <p className="text-xs text-gray-400 mt-1">Sincroniza tus CFDIs recibidos para ver las deducciones.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              {isResico ? 'Desglose por Categoría' : 'Categorías de Deducción'}
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.categories.map(cat => {
              const pct = data.totals.subtotal > 0
                ? Math.round((cat.subtotal / data.totals.subtotal) * 100)
                : 0;
              const isExpanded = expandedCat === cat.id;

              return (
                <div key={cat.id}>
                  <button
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                        <span className="text-sm font-semibold text-gray-900">{fmtMoney(cat.subtotal)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        <span className="text-xs text-gray-400">{cat.count} CFDIs</span>
                        {cat.flaggedCount > 0 && !isResico && (
                          <span className="text-xs text-amber-600">{cat.flaggedCount} alerta(s)</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded: CFDI list */}
                  {isExpanded && cat.cfdiSamples.length > 0 && (
                    <div className="px-4 pb-3 bg-gray-50">
                      <div className="space-y-1">
                        {cat.cfdiSamples.map((cfdi, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 px-2 text-xs rounded hover:bg-white">
                            <div className="flex-1 min-w-0">
                              <span className="text-gray-700 font-medium truncate block">
                                {cfdi.issuerName || cfdi.issuerRfc}
                              </span>
                              <span className="text-gray-400">
                                {new Date(cfdi.issuedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                            <div className="text-right ml-4">
                              <span className="text-gray-900 font-medium">{fmtMoney(cfdi.subtotal)}</span>
                              {cfdi.flags.length > 0 && (
                                <div className="mt-0.5">
                                  {cfdi.flags.map((f, fi) => (
                                    <span key={fi} className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${
                                      f.type === 'cash_over_2k' || f.type === 'sin_efectos' ? 'bg-red-100 text-red-600' :
                                      f.type === 'proportional' || f.type === 'sin_clasificar' || f.type === 'deduccion_personal_resico' ? 'bg-amber-100 text-amber-600' :
                                      'bg-gray-100 text-gray-500'
                                    }`}>
                                      {f.type === 'cash_over_2k' ? 'Efectivo >$2k' :
                                       f.type === 'sin_efectos' ? 'S01' :
                                       f.type === 'proportional' ? 'Proporcional' :
                                       f.type === 'sin_clasificar' ? 'Sin clasificar' :
                                       f.type === 'deduccion_personal_resico' ? 'Ded. personal' :
                                       f.type === 'no_xml' ? 'Sin XML' : f.type}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {cat.count > cat.cfdiSamples.length && (
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          Mostrando {cat.cfdiSamples.length} de {cat.count} CFDIs
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* IVA summary row */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-sm">
            <span className="font-medium text-gray-700">
              Total IVA Acreditable
            </span>
            <span className="font-bold text-green-700">{fmtMoney(data.totals.iva)}</span>
          </div>
        </div>
      )}

      {/* Monthly breakdown table */}
      {data.months.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Desglose Mensual</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Mes</th>
                  {data.categories.map(cat => (
                    <th key={cat.id} className="px-3 py-2 text-right text-gray-600 font-medium whitespace-nowrap" title={cat.name}>
                      <span className="mr-1">{cat.icon}</span>{cat.name.split(' ')[0]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.months.map(m => {
                  const monthTotal = Object.values(m.categories).reduce((s, c) => s + c.subtotal, 0);
                  const monthCount = Object.values(m.categories).reduce((s, c) => s + c.count, 0);
                  return (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 font-medium">
                        {MONTH_NAMES[m.month - 1]}
                      </td>
                      {data.categories.map(cat => (
                        <td key={cat.id} className="px-3 py-2 text-right text-gray-600">
                          {m.categories[cat.id]
                            ? <span title={`${m.categories[cat.id].count} CFDIs`}>{fmtMoney(m.categories[cat.id].subtotal)}</span>
                            : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                        <div>{fmtMoney(monthTotal)}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{monthCount} CFDIs</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Declaraciones Tab — Monthly ISR/IVA declaration helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cobranza Tab (Cash Flow / Aging Report)
// ---------------------------------------------------------------------------

interface CashflowInvoice {
  uuid: string;
  folio: string | null;
  serie: string | null;
  receiverRfc: string;
  receiverName: string | null;
  total: number;
  totalPagado: number;
  pendiente: number;
  issuedAt: string;
  daysSinceIssued: number;
  pagosCount: number;
  status: 'pendiente' | 'parcial' | 'pagado';
}

interface CashflowBucket {
  label: string;
  range: string;
  count: number;
  total: number;
  invoices: CashflowInvoice[];
}

interface CashflowData {
  year: number;
  summary: {
    totalPending: number;
    totalOverdue: number;
    invoiceCount: number;
    overdueCount: number;
  };
  buckets: CashflowBucket[];
  recentPayments: Array<{
    uuid: string;
    receiverName: string | null;
    montoPagado: number;
    fechaPago: string | null;
  }>;
}

function CobranzaTab() {
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedBucket, setExpandedBucket] = useState<number | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ uuid: string; rfc: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(() => {
    setLoading(true);
    authFetch(`${API_URL}/api/sat-descarga/cashflow?year=${year}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(json => setData(json.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [year, refreshKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleManualLink = async (pagoUuid: string) => {
    if (!linkTarget) return;
    setActing(true);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagoUuid, facturaUuid: linkTarget.uuid }),
      });
      if (res.ok) {
        setLinkTarget(null);
        setRefreshKey(k => k + 1);
      }
    } catch {}
    setActing(false);
  };

  const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>Error al cargar datos de cobranza</p>
      </div>
    );
  }

  const bucketColors = [
    'bg-green-50 border-green-200',
    'bg-yellow-50 border-yellow-200',
    'bg-orange-50 border-orange-200',
    'bg-red-50 border-red-200',
  ];
  const bucketTextColors = ['text-green-700', 'text-yellow-700', 'text-orange-700', 'text-red-700'];

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Cobranza — Facturas PPD Pendientes</h2>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          {[2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {data.summary.invoiceCount === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="text-gray-600 font-medium">Sin facturas PPD pendientes de cobro</p>
          <p className="text-sm text-gray-400 mt-1">Todas las facturas PPD emitidas en {year} estan pagadas</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Por cobrar</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.summary.totalPending)}</p>
              <p className="text-xs text-gray-400 mt-1">{data.summary.invoiceCount} facturas</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Vencido (&gt;30d)</p>
              <p className={`text-xl font-bold mt-1 ${data.summary.totalOverdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {fmt(data.summary.totalOverdue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.summary.overdueCount} facturas</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Al corriente (&le;30d)</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {fmt(data.summary.totalPending - data.summary.totalOverdue)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.summary.invoiceCount - data.summary.overdueCount} facturas</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">% Vencido</p>
              <p className={`text-xl font-bold mt-1 ${data.summary.totalOverdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {data.summary.totalPending > 0
                  ? Math.round((data.summary.totalOverdue / data.summary.totalPending) * 100)
                  : 0}%
              </p>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Antiguedad de Saldos</h3>
            {data.buckets.map((bucket, idx) => (
              <div key={idx} className={`border rounded-lg overflow-hidden ${bucketColors[idx]}`}>
                <button
                  onClick={() => setExpandedBucket(expandedBucket === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${bucketTextColors[idx]}`}>{bucket.label}</span>
                    <span className="text-xs text-gray-500">{bucket.count} facturas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${bucketTextColors[idx]}`}>{fmt(bucket.total)}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedBucket === idx ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expandedBucket === idx && bucket.invoices.length > 0 && (
                  <div className="border-t bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left p-2 pl-3">Folio</th>
                          <th className="text-left p-2">Cliente</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-right p-2">Pagado</th>
                          <th className="text-right p-2">Pendiente</th>
                          <th className="text-right p-2">Dias</th>
                          <th className="text-right p-2 pr-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.invoices.map(inv => (
                          <tr key={inv.uuid} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="p-2 pl-3">
                              <div className="font-medium text-gray-900 text-xs font-mono">
                                {inv.serie && <span className="text-gray-400">{inv.serie}-</span>}
                                {inv.folio || inv.uuid.slice(0, 8)}
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="font-medium text-gray-900 truncate max-w-[200px]">
                                {inv.receiverName || inv.receiverRfc}
                              </div>
                              {inv.receiverName && (
                                <div className="text-xs text-gray-400">{inv.receiverRfc}</div>
                              )}
                            </td>
                            <td className="text-right p-2 text-gray-600">{fmt(inv.total)}</td>
                            <td className="text-right p-2 text-green-600">{fmt(inv.totalPagado)}</td>
                            <td className="text-right p-2 font-medium text-gray-900">{fmt(inv.pendiente)}</td>
                            <td className="text-right p-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                inv.daysSinceIssued > 90 ? 'bg-red-100 text-red-700' :
                                inv.daysSinceIssued > 60 ? 'bg-orange-100 text-orange-700' :
                                inv.daysSinceIssued > 30 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {inv.daysSinceIssued}d
                              </span>
                            </td>
                            <td className="text-right p-2 pr-3">
                              {inv.status === 'pendiente' && (
                                <button
                                  onClick={() => setLinkTarget({ uuid: inv.uuid, rfc: inv.receiverRfc })}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                  title="Vincular complemento de pago manualmente"
                                >
                                  <Link2 className="w-3 h-3" />
                                  Vincular
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recent payments */}
          {data.recentPayments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Pagos Recientes</h3>
              <div className="bg-white border rounded-lg divide-y">
                {data.recentPayments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3">
                    <div>
                      <span className="text-sm text-gray-900">{p.receiverName || p.uuid.slice(0, 8)}</span>
                      {p.fechaPago && (
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(p.fechaPago).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-green-600">+{fmt(p.montoPagado)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 text-center mt-4">
        Solo incluye facturas emitidas con metodo de pago PPD (Pago en Parcialidades o Diferido).
        Los montos pendientes se calculan a partir de los complementos de pago recibidos.
      </p>

      {linkTarget && (
        <ManualLinkModal
          facturaUuid={linkTarget.uuid}
          issuerRfc={linkTarget.rfc}
          onLink={handleManualLink}
          onClose={() => setLinkTarget(null)}
          acting={acting}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Declaraciones Tab
// ---------------------------------------------------------------------------

interface DeclarationMonth {
  month: number;
  hasData: boolean;
  ingresos: number;
  deducciones: number;
  isr: {
    baseGravable: number;
    isrCausado: number;
    isrRetenido: number;
    pagosPrevios: number;
    isrAPagar: number;
    tasaEfectiva: number;
    tasaResico?: number;
    bracket?: {
      limiteInferior: number;
      limiteSuperior: number; // -1 = infinity
      cuotaFija: number;
      tasa: number;
      excedente: number;
    };
  };
  iva: {
    ivaCobrado: number;
    ivaAcreditable: number;
    ivaRetenido: number;
    ivaAPagar: number;
  };
}

interface DeclarationResponse {
  year: number;
  regimenFiscal: string;
  months: DeclarationMonth[];
  totals: {
    ingresos: number;
    deducciones: number;
    isrAPagar: number;
    ivaAPagar: number;
    isrRetenido: number;
  };
  isrTable: string;
}

function DeclaracionesTab() {
  const [data, setData] = useState<DeclarationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const fetchDeclaration = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/declaration?year=${year}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Error fetching declaration:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchDeclaration(); }, [fetchDeclaration]);

  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

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
        <Calculator className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p>No hay datos para calcular declaraciones de {year}.</p>
        <p className="text-xs mt-1">Sincroniza CFDIs con tipo &quot;Completa&quot; para ver el calculo.</p>
        <div className="mt-4">
          <YearSelector year={year} setYear={setYear} />
        </div>
      </div>
    );
  }

  const isResico = data.regimenFiscal === '626';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-600" />
          Declaraciones Mensuales {year}
        </h3>
        <YearSelector year={year} setYear={setYear} />
      </div>

      {/* Regime badge */}
      <div className={`rounded-lg border p-3 text-sm ${isResico ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
        <strong>Regimen {data.regimenFiscal}</strong>
        {isResico
          ? ' — RESICO: ISR es tasa fija sobre ingresos brutos mensuales. No se deducen gastos para ISR.'
          : ' — Actividad Empresarial: ISR provisional acumulado con tabla progresiva Art. 96 LISR.'}
      </div>

      {/* Annual summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-green-50 border-green-200 p-4">
          <p className="text-xs font-medium text-green-600">Ingresos acumulados</p>
          <p className="text-lg font-bold text-green-800 mt-1">{fmt(data.totals.ingresos)}</p>
        </div>
        {!isResico && (
          <div className="rounded-lg border bg-red-50 border-red-200 p-4">
            <p className="text-xs font-medium text-red-600">Deducciones acumuladas</p>
            <p className="text-lg font-bold text-red-800 mt-1">{fmt(data.totals.deducciones)}</p>
          </div>
        )}
        <div className={`rounded-lg border p-4 ${data.totals.isrAPagar > 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs font-medium text-orange-600">ISR pagado en el ano</p>
          <p className="text-lg font-bold text-orange-800 mt-1">{fmt(data.totals.isrAPagar)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${data.totals.ivaAPagar > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs font-medium text-amber-600">IVA neto del ano</p>
          <p className={`text-lg font-bold mt-1 ${data.totals.ivaAPagar >= 0 ? 'text-amber-800' : 'text-green-800'}`}>{fmt(data.totals.ivaAPagar)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{data.totals.ivaAPagar >= 0 ? 'A pagar' : 'A favor'}</p>
        </div>
      </div>

      {/* Monthly table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">
            {isResico ? 'ISR RESICO + IVA por mes' : 'ISR Provisional + IVA por mes'}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {isResico
              ? 'Cada mes es independiente. ISR = ingresos x tasa fija RESICO.'
              : 'ISR provisional es acumulado: cada mes recalcula sobre la base del ano. Haz clic en un mes para ver el desglose.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left font-semibold">Mes</th>
                <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
                {!isResico && <th className="px-3 py-2 text-right font-semibold">Deducciones</th>}
                <th className="px-3 py-2 text-right font-semibold">{isResico ? 'Tasa' : 'Tasa ef.'}</th>
                <th className="px-3 py-2 text-right font-semibold">ISR causado</th>
                <th className="px-3 py-2 text-right font-semibold">ISR retenido</th>
                {!isResico && <th className="px-3 py-2 text-right font-semibold">Pagos prev.</th>}
                <th className="px-3 py-2 text-right font-semibold text-orange-700">ISR a pagar</th>
                {!isResico && <th className="px-3 py-2 text-right font-semibold text-blue-700">ISR a favor</th>}
                <th className="px-3 py-2 text-right font-semibold text-amber-700">IVA a pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.months.map(m => (
                <Fragment key={m.month}>
                  <tr
                    className={`hover:bg-gray-50 ${!isResico ? 'cursor-pointer' : ''} ${expandedMonth === m.month ? 'bg-purple-50' : ''}`}
                    onClick={() => !isResico && setExpandedMonth(expandedMonth === m.month ? null : m.month)}
                  >
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {!isResico && (
                        <ChevronDown className={`w-3 h-3 inline mr-1 transition-transform ${expandedMonth === m.month ? 'rotate-180' : ''}`} />
                      )}
                      {MONTH_NAMES[m.month - 1]}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmt(m.ingresos)}</td>
                    {!isResico && <td className="px-3 py-2.5 text-right font-mono text-red-700">{fmt(m.deducciones)}</td>}
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {isResico ? fmtPct((m.isr.tasaResico ?? 0) * 100) : fmtPct(m.isr.tasaEfectiva)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmt(m.isr.isrCausado)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-500">{m.isr.isrRetenido > 0 ? fmt(m.isr.isrRetenido) : '—'}</td>
                    {!isResico && <td className="px-3 py-2.5 text-right font-mono text-gray-500">{m.isr.pagosPrevios > 0 ? fmt(m.isr.pagosPrevios) : '—'}</td>}
                    <td className={`px-3 py-2.5 text-right font-mono font-medium ${m.isr.isrAPagar > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                      {fmt(m.isr.isrAPagar)}
                    </td>
                    {!isResico && (() => {
                      const saldoAFavor = m.isr.isrRetenido + m.isr.pagosPrevios - m.isr.isrCausado;
                      return (
                        <td className={`px-3 py-2.5 text-right font-mono font-medium ${saldoAFavor > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                          {saldoAFavor > 0 ? fmt(saldoAFavor) : '—'}
                        </td>
                      );
                    })()}
                    <td className={`px-3 py-2.5 text-right font-mono font-medium ${m.iva.ivaAPagar > 0 ? 'text-amber-700' : m.iva.ivaAPagar < 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {m.iva.ivaAPagar !== 0 ? `${m.iva.ivaAPagar > 0 ? '+' : ''}${fmt(m.iva.ivaAPagar)}` : '—'}
                    </td>
                  </tr>

                  {/* Expanded detail for 612 */}
                  {!isResico && expandedMonth === m.month && (
                    <tr key={`${m.month}-detail`}>
                      <td colSpan={10} className="px-4 py-3 bg-purple-50 border-t border-purple-100">
                        <div className="grid grid-cols-2 gap-4 text-xs max-w-2xl">
                          <div>
                            <p className="font-semibold text-gray-700 mb-2">ISR Provisional (acumulado)</p>
                            <div className="space-y-1 text-gray-600">
                              <div className="flex justify-between">
                                <span>Base gravable acumulada</span>
                                <span className="font-mono">{fmt(m.isr.baseGravable)}</span>
                              </div>
                              {/* Bracket breakdown */}
                              {m.isr.bracket && (
                                <div className="bg-purple-100/50 rounded p-2 my-1 space-y-0.5 text-[11px]">
                                  <p className="font-semibold text-purple-700 mb-1">Desglose tabla Art. 96 (mes {m.month}, tramos ×{m.month}):</p>
                                  <div className="flex justify-between text-purple-600">
                                    <span>Tramo: {fmt(m.isr.bracket.limiteInferior)} – {m.isr.bracket.limiteSuperior === -1 ? 'en adelante' : fmt(m.isr.bracket.limiteSuperior)}</span>
                                    <span className="font-mono">tasa {(m.isr.bracket.tasa * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="flex justify-between text-purple-600">
                                    <span>Cuota fija (impuesto tramos inferiores)</span>
                                    <span className="font-mono">{fmt(m.isr.bracket.cuotaFija)}</span>
                                  </div>
                                  <div className="flex justify-between text-purple-600">
                                    <span>Excedente ({fmt(m.isr.baseGravable)} − {fmt(m.isr.bracket.limiteInferior)})</span>
                                    <span className="font-mono">{fmt(m.isr.bracket.excedente)}</span>
                                  </div>
                                  <div className="flex justify-between text-purple-600">
                                    <span>Impuesto excedente ({fmt(m.isr.bracket.excedente)} × {(m.isr.bracket.tasa * 100).toFixed(0)}%)</span>
                                    <span className="font-mono">{fmt(m.isr.bracket.excedente * m.isr.bracket.tasa)}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold text-purple-800 border-t border-purple-200 pt-0.5 mt-0.5">
                                    <span>= ISR causado ({fmt(m.isr.bracket.cuotaFija)} + {fmt(m.isr.bracket.excedente * m.isr.bracket.tasa)})</span>
                                    <span className="font-mono">{fmt(m.isr.isrCausado)}</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between text-gray-500">
                                <span>(-) ISR retenido acumulado</span>
                                <span className="font-mono">{fmt(m.isr.isrRetenido)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>(-) Pagos provisionales previos</span>
                                <span className="font-mono">{fmt(m.isr.pagosPrevios)}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-orange-700 border-t border-purple-200 pt-1 mt-1">
                                <span>= ISR a pagar este mes</span>
                                <span className="font-mono">{fmt(m.isr.isrAPagar)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-2">IVA Mensual</p>
                            <div className="space-y-1 text-gray-600">
                              <div className="flex justify-between">
                                <span>IVA trasladado (cobrado)</span>
                                <span className="font-mono">{fmt(m.iva.ivaCobrado)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>(-) IVA acreditable (pagado)</span>
                                <span className="font-mono">{fmt(m.iva.ivaAcreditable)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>(-) IVA retenido</span>
                                <span className="font-mono">{fmt(m.iva.ivaRetenido)}</span>
                              </div>
                              <div className={`flex justify-between font-semibold border-t border-purple-200 pt-1 mt-1 ${m.iva.ivaAPagar >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                <span>= IVA {m.iva.ivaAPagar >= 0 ? 'a pagar' : 'a favor'}</span>
                                <span className="font-mono">{fmt(Math.abs(m.iva.ivaAPagar))}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="px-3 py-2.5 text-gray-900">Total {year}</td>
                <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmt(data.totals.ingresos)}</td>
                {!isResico && <td className="px-3 py-2.5 text-right font-mono text-red-700">{fmt(data.totals.deducciones)}</td>}
                <td className="px-3 py-2.5 text-right font-mono text-gray-500">—</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-500">—</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmt(data.totals.isrRetenido)}</td>
                {!isResico && <td className="px-3 py-2.5 text-right font-mono text-gray-500">—</td>}
                <td className="px-3 py-2.5 text-right font-mono text-orange-700">{fmt(data.totals.isrAPagar)}</td>
                {!isResico && (() => {
                  const lastMonth = data.months[data.months.length - 1];
                  // Total paid = pagos previos (cumulative before last month) + last month's payment + retenciones
                  // Total owed = ISR causado (cumulative through last month)
                  const saldo = lastMonth ? (lastMonth.isr.pagosPrevios + lastMonth.isr.isrAPagar + lastMonth.isr.isrRetenido) - lastMonth.isr.isrCausado : 0;
                  return (
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${saldo > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                      {saldo > 0 ? fmt(saldo) : '—'}
                    </td>
                  );
                })()}
                <td className={`px-3 py-2.5 text-right font-mono ${data.totals.ivaAPagar >= 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {fmt(data.totals.ivaAPagar)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Deadline reminder */}
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 text-xs text-amber-800">
        <p className="font-semibold mb-1">Fecha limite de declaracion: dia 17 de cada mes</p>
        <p>Las declaraciones mensuales provisionales de ISR e IVA se presentan a mas tardar el dia 17 del mes siguiente al periodo que se declara.</p>
        {!isResico && (
          <p className="mt-1 text-amber-600">
            Los montos de ISR son acumulados: cada mes recalcula sobre el total del ano. El &quot;ISR a pagar&quot; ya descuenta retenciones y pagos previos.
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
        <p><strong>Importante:</strong> Estos calculos son una <strong>estimacion</strong> basada en los CFDIs descargados del SAT. Consulta con tu contador antes de presentar tus declaraciones.</p>
        <p>Los ingresos considerados son subtotales de facturas emitidas vigentes tipo Ingreso. Las deducciones son subtotales de facturas recibidas vigentes tipo Ingreso.</p>
        {!isResico && <p>El calculo de ISR provisional usa la tabla mensual del Art. 96 LISR. No incluye deducciones personales ni otros ajustes que tu contador puede aplicar.</p>}
        <p>IVA: solo se consideran CFDIs con detalles XML descargados. Facturas sin XML no se incluyen en el calculo.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contable Tab — Accounting Guide
// ---------------------------------------------------------------------------

function AyudaTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Intro */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-600" />
          Como usar esta herramienta
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
          <p>
            Esta seccion de <strong>Descarga Masiva SAT</strong> te permite descargar, visualizar y analizar
            todos los CFDIs (facturas) que has emitido y recibido, directamente desde el SAT usando tu e.Firma (FIEL).
          </p>
          <p>
            La informacion se organiza en varias pestanas, cada una con un enfoque distinto.
            Abajo encontraras una explicacion de cada una, como se relacionan entre si, y ejemplos de uso.
          </p>
        </div>
      </section>

      {/* 1. CFDIs Descargados */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">1</span>
          CFDIs Descargados
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> El listado completo de todas tus facturas sincronizadas desde el SAT.
            Es la <strong>base de datos central</strong> — todas las demas pestanas se alimentan de estos datos.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que puedes hacer aqui</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Filtrar</strong> por direccion (emitidas/recibidas), tipo (Ingreso, Egreso, Pago), status (Vigente/Cancelado) y monto</li>
              <li><strong>Buscar</strong> por RFC o nombre del emisor/receptor</li>
              <li><strong>Ver detalles XML</strong> — expande cualquier factura para ver subtotal, IVA, retenciones, conceptos, forma/metodo de pago, uso CFDI</li>
              <li><strong>Registrar en contabilidad</strong> — vincula un CFDI a tu libro de ingresos/egresos con un clic</li>
              <li><strong>Ver banderas de deducibilidad</strong> — cada CFDI recibido muestra alertas si tiene problemas (efectivo &gt;$2k, S01, cancelado, etc.)</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Quieres verificar que todas las facturas que emitiste en enero estan vigentes.
              Seleccionas "Emitidas", mes "2026-01", y revisas que ninguna aparezca como "Cancelado".
              Si encuentras una cancelada, haces clic para ver los detalles y verificas si necesitas emitir una nueva.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              Esta pestana es el <strong>origen de todos los datos</strong>. Si aqui no hay CFDIs sincronizados,
              las demas pestanas apareceran vacias. Primero sincroniza tus CFDIs (usando el boton de descarga arriba),
              y luego las demas pestanas se calculan automaticamente.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Resumen Fiscal */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">2</span>
          Resumen Fiscal
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> Un panorama anual de tu situacion financiera — ingresos, gastos, IVA y retenciones,
            desglosado mes por mes. Piensalo como tu <strong>estado de resultados simplificado</strong>.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que muestra</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Tarjetas resumen</strong> — Ingresos totales, Gastos totales, Balance neto, IVA a pagar</li>
              <li><strong>Desglose de impuestos</strong> — IVA trasladado, IVA acreditable, ISR retenido, IVA retenido</li>
              <li><strong>Tabla mensual</strong> — Mes a mes: ingresos, gastos, IVA, retenciones, balance</li>
              <li><strong>Leyenda explicativa</strong> — Que significa cada columna y como interpretar los numeros</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Tu contador te pide el total de ingresos y gastos del trimestre para la declaracion provisional.
              Abres Resumen Fiscal, seleccionas el ano, y en la tabla mensual sumas enero + febrero + marzo.
              Tambien ves cuanto IVA trasladado cobraste vs cuanto IVA acreditable pagaste y cuanto IVA te retuvieron — la diferencia es lo que debes al SAT.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              Usa los mismos CFDIs de la pestana 1, pero <strong>agrupados y sumados</strong> por mes.
              Los numeros de ingresos y gastos aqui deben coincidir con lo que ves en <strong>Declaraciones</strong> (pestana 4).
              Si eres RESICO, el monitor de ingresos aqui se complementa con el de <strong>Deducciones</strong> (pestana 3).
            </p>
          </div>
        </div>
      </section>

      {/* 3. Deducciones */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">3</span>
          Deducciones
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> Clasificacion automatica de tus gastos (facturas recibidas) en categorias como
            Insumos Medicos, Renta, Equipo, Software, Alimentos, etc. Te ayuda a entender <strong>en que gastas</strong> y
            si esos gastos son deducibles.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que muestra</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Tarjetas por categoria</strong> — Cada tipo de gasto con subtotal, IVA y numero de facturas</li>
              <li><strong>Alertas de deducibilidad</strong> — CFDIs con uso S01, efectivo &gt;$2k, sin clasificar, cancelados</li>
              <li><strong>Desglose mensual</strong> — Tabla con categorias por mes para ver tendencias</li>
              <li><strong>Drill-down</strong> — Expande cada categoria para ver las facturas individuales</li>
              <li><strong>Monitor RESICO</strong> — Si eres 626, muestra tus ingresos acumulados vs el limite de $3.5M</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Diferencia segun tu regimen</p>
            <p className="text-xs text-amber-700">
              <strong>612:</strong> El titulo dice "Deducciones Fiscales" — tus gastos reducen ISR. Las alertas indican que gastos NO son deducibles.<br/>
              <strong>RESICO:</strong> El titulo dice "Gastos del Ejercicio" — no hay deducciones de ISR, pero el IVA si es acreditable.
              Las alertas se enfocan en IVA no acreditable.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Notas que tienes 5 alertas de "Efectivo &gt;$2,000". Expandes la alerta y ves que son pagos a un proveedor
              de insumos. La proxima vez le pagas por transferencia para que la factura salga con forma de pago "03 — Transferencia"
              y el gasto sea deducible. Tambien ves 3 facturas con uso S01 — esas no son deducibles y debes
              pedirle al emisor que las cancele y re-emita con uso G03 si realmente son gastos de negocio.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              Solo analiza facturas <strong>recibidas</strong> (gastos) de la pestana 1.
              El total de gastos aqui debe coincidir con el total de gastos en <strong>Resumen Fiscal</strong> (pestana 2).
              Las deducciones validas aqui son las que se usan para calcular ISR en <strong>Declaraciones</strong> (pestana 4).
            </p>
          </div>
        </div>
      </section>

      {/* 4. Declaraciones */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">4</span>
          Declaraciones
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> Calculo estimado de tus declaraciones mensuales de ISR e IVA,
            usando la informacion de tus CFDIs. Es un <strong>borrador de pre-declaracion</strong> — te da una idea
            de cuanto debes pagar antes de ir con tu contador.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que muestra</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Tarjetas anuales</strong> — Ingresos acumulados, deducciones acumuladas, ISR estimado, IVA a pagar</li>
              <li><strong>Tabla mes a mes</strong> — Para cada mes: ingresos, deducciones, base gravable, ISR, IVA, retenciones</li>
              <li><strong>Calculo segun regimen</strong> — 612 usa tabla progresiva Art. 96 LISR con pagos provisionales acumulados; RESICO usa tasa fija sobre ingresos brutos</li>
              <li><strong>Detalle expandible</strong> — Clic en un mes para ver el desglose completo del calculo</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="font-semibold text-green-800 text-xs mb-1">ISR acumulado — meses malos compensan meses buenos</p>
            <p className="text-xs text-green-700">
              En regimen 612, el ISR se calcula sobre la <strong>utilidad acumulada del ano</strong>, no del mes aislado.
              Si un mes gastas mas de lo que ingresas, la base gravable acumulada baja y puedes generar <strong>ISR a favor</strong> —
              es decir, no pagas ISR hasta que la utilidad acumulada supere lo que ya pagaste. El excedente se recupera en la
              declaracion anual. Consulta la seccion "ISR Provisional: Calculo Acumulado" en la pestana <strong>Guia</strong> para un ejemplo con numeros.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <p className="font-semibold text-purple-800 text-xs mb-1">Tabla de ISR Art. 96 LISR (mensual, Anexo 8 RMF 2026)</p>
            <p className="text-xs text-purple-700 mb-2">
              Esta es la tabla que se usa para calcular tu ISR. Al expandir un mes en la tabla veras exactamente que tramo se uso.
              Formula: <strong className="font-mono">ISR = Cuota Fija + (Base − Limite Inferior) × Tasa</strong>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border border-purple-200 rounded">
                <thead>
                  <tr className="bg-purple-100 text-purple-800">
                    <th className="px-2 py-1 text-right border-r border-purple-200">Limite Inferior</th>
                    <th className="px-2 py-1 text-right border-r border-purple-200">Limite Superior</th>
                    <th className="px-2 py-1 text-right border-r border-purple-200">Cuota Fija</th>
                    <th className="px-2 py-1 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-purple-700">
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$0.01</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$844.58</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$0.00</td><td className="px-2 py-0.5 text-right">1.92%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$844.59</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$7,167.67</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$16.22</td><td className="px-2 py-0.5 text-right">6.40%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$7,167.68</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$12,601.03</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$420.90</td><td className="px-2 py-0.5 text-right">10.88%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$12,601.04</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$14,648.87</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,012.08</td><td className="px-2 py-0.5 text-right">16.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$14,648.88</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,533.64</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,339.74</td><td className="px-2 py-0.5 text-right">17.92%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,533.65</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$35,362.83</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,856.84</td><td className="px-2 py-0.5 text-right">21.36%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$35,362.84</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$55,734.75</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$5,662.62</td><td className="px-2 py-0.5 text-right">23.52%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$55,734.76</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$79,388.37</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$10,454.09</td><td className="px-2 py-0.5 text-right">30.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$79,388.38</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$106,410.50</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,550.18</td><td className="px-2 py-0.5 text-right">32.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$106,410.51</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$375,975.61</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$26,197.27</td><td className="px-2 py-0.5 text-right">34.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$375,975.62</td><td className="px-2 py-0.5 text-right border-r border-purple-100">En adelante</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$117,829.97</td><td className="px-2 py-0.5 text-right">35.00%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-purple-500 mt-1">
              Para pagos provisionales mensuales, los limites y cuotas se multiplican por el numero de mes (ej: marzo = ×3). La tasa no cambia. Al expandir un mes en la tabla de Declaraciones, veras el tramo exacto que se uso con los numeros ya escalados.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
            <p className="font-semibold text-emerald-800 text-xs mb-1">Tabla de ISR RESICO Art. 113-E LISR</p>
            <p className="text-xs text-emerald-700 mb-2">
              Si estas en RESICO (regimen 626), el ISR es mucho mas simple: <strong className="font-mono">ISR = Ingresos del mes × Tasa</strong>. No hay cuota fija, no hay excedente, no hay acumulacion. Cada mes es independiente.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border border-emerald-200 rounded">
                <thead>
                  <tr className="bg-emerald-100 text-emerald-800">
                    <th className="px-2 py-1 text-right border-r border-emerald-200">Ingreso Mensual Desde</th>
                    <th className="px-2 py-1 text-right border-r border-emerald-200">Hasta</th>
                    <th className="px-2 py-1 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-emerald-700">
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$0.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$25,000.00</td><td className="px-2 py-0.5 text-right">1.00%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$25,000.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$50,000.00</td><td className="px-2 py-0.5 text-right">1.10%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$50,000.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$83,333.33</td><td className="px-2 py-0.5 text-right">1.50%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$83,333.34</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$208,333.33</td><td className="px-2 py-0.5 text-right">2.00%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$208,333.34</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$291,666.67</td><td className="px-2 py-0.5 text-right">2.50%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-emerald-500 mt-1">
              Limite anual RESICO: $3,500,000. Si lo excedes, el SAT te cambia a regimen 612 con tabla progresiva.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Importante</p>
            <p className="text-xs text-amber-700">
              Estos calculos son <strong>estimaciones</strong> basadas en tus CFDIs. Tu contador puede ajustar montos
              por depreciaciones, deducciones personales, pagos provisionales previos, y otros factores que el sistema
              no contempla. Usa estos numeros como referencia, no como declaracion final.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Es 15 de abril y necesitas presentar tu declaracion de marzo. Abres Declaraciones, expandes el mes de marzo,
              y ves: ingresos $85,000, deducciones $22,000, base gravable $63,000, ISR provisional estimado $8,500,
              menos retenciones que te hicieron $4,200, ISR a pagar ~$4,300. Le mandas estos numeros a tu contador
              para que verifique y presente la declaracion. Si febrero fue un mes malo con muchos gastos,
              veras que el ISR de marzo es menor (o incluso $0) gracias al calculo acumulado.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              Toma los ingresos de facturas emitidas y los gastos deducibles de facturas recibidas (mismos datos que pestanas 2 y 3).
              Las <strong>retenciones</strong> (ISR e IVA retenidos) vienen de las facturas emitidas a personas morales.
              Si los montos no coinciden con <strong>Resumen Fiscal</strong>, revisa si hay facturas canceladas o notas de credito.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Cobranza */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">5</span>
          Cobranza
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> Seguimiento de facturas PPD (pago diferido) que aun no has cobrado.
            Es un <strong>reporte de cuentas por cobrar</strong> — te muestra cuanto te deben, hace cuanto, y quien.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que muestra</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Total por cobrar</strong> — Suma de facturas PPD emitidas sin complemento de pago completo</li>
              <li><strong>Total vencido</strong> — Facturas con mas de 30 dias sin cobrar</li>
              <li><strong>Buckets de antiguedad</strong> — 0-30 dias, 31-60 dias, 61-90 dias, +90 dias</li>
              <li><strong>Lista de facturas</strong> — Expande cada bucket para ver las facturas individuales con RFC, nombre y monto</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Ves que tienes $45,000 en el bucket de "+90 dias" — son facturas de hace 3 meses que no te han pagado.
              Expandes el bucket, identificas que son 2 facturas a la misma aseguradora, y decides llamarles para dar seguimiento.
              Tambien notas que sin el complemento de pago, ese ingreso <strong>no cuenta como cobrado</strong> para efectos de IVA,
              asi que no debes declarar el IVA de esas facturas hasta que te paguen.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              Solo analiza facturas <strong>emitidas con metodo PPD</strong>. Cruza la factura original con sus complementos de pago (tipo P)
              para determinar cuanto se ha cobrado. Las facturas PUE (pago de contado) no aparecen aqui porque se consideran pagadas
              al momento de emitirse. Si al expandir el XML de una factura PPD en la pestana 1 ves el indicador de pago en verde
              pero aqui aparece como pendiente, puede ser que el complemento de pago aun no se ha sincronizado.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Guia */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm mr-2">6</span>
          Guia
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            <strong>Que es:</strong> Referencia fiscal completa con conceptos de impuestos, regimenes, retenciones,
            IVA, deducibilidad, y como funciona la clasificacion automatica. Es un <strong>manual de consulta</strong> —
            no muestra datos, sino que explica los conceptos detras de los datos.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Que contiene</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Como funciona la sincronizacion</strong> — Proceso de descarga, dos capas de datos, limitaciones del SAT</li>
              <li><strong>Tu regimen fiscal</strong> — Diferencias entre 612 y RESICO, como afectan tus impuestos</li>
              <li><strong>IVA</strong> — Tasas, trasladado vs acreditable, por que algunos CFDIs muestran IVA $0</li>
              <li><strong>Retenciones</strong> — Cuando aplican, como se calculan, ejemplo numerico</li>
              <li><strong>PUE vs PPD</strong> — Metodos de pago, implicaciones fiscales, complementos de pago</li>
              <li><strong>Uso CFDI y clasificacion automatica</strong> — Tabla de usos con deducibilidad por regimen, como clasifica el sistema</li>
              <li><strong>Gastos deducibles</strong> — Requisitos, tabla de gastos tipicos, errores comunes</li>
              <li><strong>Obligaciones fiscales</strong> — Calendario de declaraciones, diferencias por regimen</li>
              <li><strong>Detalles XML</strong> — Que significa cada campo del CFDI</li>
              <li><strong>Casos especiales</strong> — Cancelaciones, notas de credito, moneda extranjera, facturas de periodos anteriores</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="font-semibold text-gray-700 text-xs mb-1">Ejemplo</p>
            <p className="text-xs text-gray-600">
              Ves una factura recibida con "IVA Retenido: $1,066.67" y no entiendes por que. Abres la Guia, buscas
              la seccion de Retenciones, y encuentras que cuando una persona fisica factura servicios profesionales a una
              persona moral, esta retiene 2/3 del IVA. Ahora entiendes que eso es un pago anticipado de tu IVA, no dinero perdido.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Relacion con otras pestanas</p>
            <p className="text-xs text-blue-700">
              No muestra datos — es pura referencia. Usala cuando no entiendas un concepto que aparece en las otras pestanas.
              Si ves un termino como "PUE", "S01", "IVA acreditable" o "retencion" y no sabes que significa,
              la explicacion esta en la Guia.
            </p>
          </div>
        </div>
      </section>

      {/* How tabs relate — visual flow */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Como se relacionan las pestanas
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-2 text-center">
            <p className="font-bold text-gray-800">Sincronizacion SAT (e.Firma)</p>
            <p className="text-gray-400">|</p>
            <p className="text-gray-400">v</p>
            <p className="font-bold text-blue-700">[1] CFDIs Descargados</p>
            <p className="text-gray-500 text-xs">(base de datos de todas tus facturas)</p>
            <p className="text-gray-400">|</p>
            <div className="flex justify-center gap-8 items-start">
              <div className="text-center">
                <p className="text-gray-400">v</p>
                <p className="font-bold text-green-700">[2] Resumen</p>
                <p className="text-gray-500 text-xs">(totales anuales)</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">v</p>
                <p className="font-bold text-orange-700">[3] Deducciones</p>
                <p className="text-gray-500 text-xs">(gastos clasificados)</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">v</p>
                <p className="font-bold text-purple-700">[4] Declaraciones</p>
                <p className="text-gray-500 text-xs">(ISR + IVA estimados)</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">v</p>
                <p className="font-bold text-red-700">[5] Cobranza</p>
                <p className="text-gray-500 text-xs">(cuentas por cobrar)</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <p><strong>Flujo tipico de uso:</strong></p>
            <ol className="list-decimal list-inside space-y-1.5 ml-2">
              <li>Sincroniza tus CFDIs con tu e.Firma en la parte superior de la pagina</li>
              <li>Revisa el <strong>listado de CFDIs</strong> para asegurarte que todo se descargo correctamente</li>
              <li>Consulta el <strong>Resumen Fiscal</strong> para tener el panorama general del ano/mes</li>
              <li>Revisa <strong>Deducciones</strong> para identificar gastos problematicos (S01, efectivo, sin clasificar)</li>
              <li>Antes de declarar, abre <strong>Declaraciones</strong> para estimar ISR e IVA del mes</li>
              <li>Si emites facturas PPD, revisa <strong>Cobranza</strong> periodicamente para dar seguimiento a pagos pendientes</li>
              <li>Si no entiendes algun concepto, consultalo en la <strong>Guia</strong></li>
            </ol>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Preguntas frecuentes</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-800">¿Por que no veo datos en las pestanas?</p>
            <p className="text-xs text-gray-600 mt-1">
              Necesitas sincronizar primero. Sube tu e.Firma (.key y .cer) en la parte superior, selecciona un mes,
              y haz clic en "Descargar". La sincronizacion tipo "Completa" descarga metadata + XML (necesario para Resumen Fiscal,
              Deducciones y Declaraciones). La sincronizacion tipo "Solo metadata" es mas rapida pero solo llena el listado de CFDIs.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800">¿Cada cuanto debo sincronizar?</p>
            <p className="text-xs text-gray-600 mt-1">
              Idealmente una vez al mes, despues de que termines de facturar. Si necesitas informacion actualizada para
              una declaracion, sincroniza el mes correspondiente. Los datos ya sincronizados no se pierden — la descarga
              solo agrega facturas nuevas o actualiza status de las existentes (ej. si alguna se cancelo).
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800">¿Los datos de Declaraciones son exactos?</p>
            <p className="text-xs text-gray-600 mt-1">
              Son estimaciones basadas en tus CFDIs. Tu contador puede tener ajustes adicionales (depreciaciones, deducciones
              personales, pagos provisionales de meses anteriores). Usa los numeros como punto de partida, no como declaracion final.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800">¿Que pasa si una factura aparece como "Sin Clasificar" en Deducciones?</p>
            <p className="text-xs text-gray-600 mt-1">
              Significa que el sistema no pudo determinar automaticamente la categoria del gasto. Esto pasa cuando el XML no tiene
              clave de producto/servicio reconocida o no tiene XML descargado. La factura podria ser deducible — revisala manualmente
              o consultalo con tu contador.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800">¿Puedo cambiar mi regimen fiscal aqui?</p>
            <p className="text-xs text-gray-600 mt-1">
              El sistema lee tu regimen desde la configuracion de Facturacion (/dashboard/facturacion, pestana Configuracion).
              Si cambias de regimen ante el SAT, actualiza esa configuracion para que los calculos de Deducciones y Declaraciones
              reflejen las reglas correctas (612 vs RESICO).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function GuiaTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Intro */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-purple-600" />
          Guia Fiscal y de Uso
        </h3>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800 space-y-2">
          <p>
            Guia completa sobre la descarga masiva de CFDIs, conceptos fiscales, deducibilidad de gastos,
            y como funciona la clasificacion automatica. Aplica para medicos persona fisica en regimen 612 o RESICO (626).
          </p>
        </div>
      </section>

      {/* How sync works */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-600" />
          Como funciona la sincronizacion
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            La sincronizacion se conecta <strong>directamente al SAT</strong> usando tu e.Firma (FIEL)
            para descargar el listado de todos los CFDIs que has emitido o recibido en un mes determinado.
          </p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2">
            <li><strong>Autenticacion</strong> — Se firma una solicitud con tu e.Firma para obtener un token del SAT</li>
            <li><strong>Solicitud</strong> — Se pide al SAT que prepare el paquete de metadata (emitidos o recibidos)</li>
            <li><strong>Espera</strong> — El SAT procesa la solicitud (normalmente 30 seg a unos minutos, maximo 72 horas)</li>
            <li><strong>Descarga</strong> — Se descarga el paquete ZIP con la metadata de tus CFDIs</li>
            <li><strong>Almacenamiento</strong> — Se parsea y guarda cada CFDI en la base de datos</li>
          </ol>
          <p className="text-xs text-gray-500 mt-3">
            Un worker automatico revisa el progreso cada 15 minutos. No necesitas mantener la pagina abierta.
          </p>

          <div className="mt-3">
            <p className="font-semibold text-gray-800">Dos capas de informacion</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="border border-gray-200 rounded p-3">
                <p className="font-medium text-gray-800 text-xs mb-1">1. Metadata (listado basico)</p>
                <p className="text-xs text-gray-500 mb-1">Se obtiene rapido — es lo que ves en la tabla principal.</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600">
                  <li>UUID, emisor, receptor, monto, fecha</li>
                  <li>Tipo (Ingreso, Egreso, Pago, Traslado)</li>
                  <li>Status (Vigente / Cancelado)</li>
                </ul>
              </div>
              <div className="border border-gray-200 rounded p-3">
                <p className="font-medium text-gray-800 text-xs mb-1">2. XML (desglose fiscal completo)</p>
                <p className="text-xs text-gray-500 mb-1">Se descarga por separado — al hacer clic en "Ver detalles XML".</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600">
                  <li>Subtotal, IVA, retenciones, descuentos</li>
                  <li>Metodo/forma de pago, Uso CFDI</li>
                  <li>Conceptos con clave SAT y descripcion</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-2">
            <p className="font-semibold text-amber-800 text-xs mb-1">Limitaciones del SAT</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-700">
              <li>Puede tardar hasta 72 horas en procesar (normalmente minutos)</li>
              <li>Maximo 1,000,000 registros por solicitud</li>
              <li>Historico disponible: hasta 5 anos fiscales + ano actual</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Regimen-specific overview */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Tu Regimen Fiscal y Como Afecta tus Impuestos</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            Como medico persona fisica, solo puedes estar en uno de estos dos regimenes para emitir facturas por servicios profesionales:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
              <p className="font-bold text-indigo-800 mb-2">612 — Actividad Empresarial y Profesional</p>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-indigo-700">
                <li><strong>Sin limite de ingresos</strong></li>
                <li>ISR sobre ingresos <strong>menos deducciones</strong> (tasa progresiva 1.92% a 35%)</li>
                <li>Puedes deducir todos tus gastos de negocio (renta, insumos, equipo, sueldos, etc.)</li>
                <li>Retencion ISR cuando facturas a persona moral: <strong>10%</strong></li>
                <li>Debes llevar contabilidad electronica</li>
                <li>Declaraciones mensuales de ISR y IVA + anual en abril</li>
              </ul>
            </div>
            <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
              <p className="font-bold text-emerald-800 mb-2">626 — RESICO (Simplificado de Confianza)</p>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-emerald-700">
                <li>Limite de ingresos: <strong>$3,500,000 MXN/ano</strong></li>
                <li>ISR sobre ingresos <strong>brutos</strong> a tasa fija baja (1% a 2.5%)</li>
                <li><strong>NO puedes deducir gastos</strong> para efectos de ISR</li>
                <li>Retencion ISR cuando facturas a persona moral: <strong>1.25%</strong> (no 10%)</li>
                <li>No requiere contabilidad electronica</li>
                <li>Declaracion anual simplificada</li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Diferencia clave en deducciones</p>
            <p className="text-xs text-amber-700">
              En <strong>612</strong>, tus gastos reducen la base sobre la que pagas ISR — entre mas gastos deducibles, menos ISR pagas.
              En <strong>RESICO</strong>, tus gastos <strong>no afectan tu ISR</strong> — pagas un porcentaje fijo sobre todo lo que facturas, sin importar cuanto gastes.
              Sin embargo, en ambos regimenes puedes <strong>acreditar IVA</strong> (restar el IVA que pagas en tus compras del IVA que cobras).
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="font-semibold text-red-800 text-xs mb-1">Si estas en RESICO, vigila tu limite</p>
            <p className="text-xs text-red-700">
              Si tus ingresos anuales superan $3,500,000 MXN, el SAT te saca de RESICO automaticamente y pasas al regimen 612.
              Esto cambia radicalmente tus obligaciones fiscales. Usa la pestana de Resumen Fiscal para monitorear tus ingresos acumulados.
            </p>
          </div>
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
                    <td className="px-3 py-2">Servicios medicos por PF, educacion, venta de casa habitacion</td>
                    <td className="px-3 py-2 text-gray-500">Honorarios medicos prestados por PF con titulo (consulta, cirugia), colegiaturas, venta de primer inmueble</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Caso especial: Servicios medicos</p>
            <p className="text-xs text-amber-700">
              Los servicios medicos profesionales prestados por una <strong>persona fisica con titulo de medico</strong> estan
              <strong>exentos</strong> de IVA (Art. 15 fraccion XIV LIVA), sin importar si el receptor es persona fisica o persona moral.
              Es decir, si eres medico PF y facturas honorarios a un hospital (PM) o a un paciente (PF), en ambos casos
              la consulta es <strong>exenta de IVA</strong>. La exencion se basa en la naturaleza del servicio y en que el prestador
              sea persona fisica, no en quien recibe la factura.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              <strong>Excepcion:</strong> Si los servicios medicos se prestan a traves de una <strong>sociedad mercantil</strong>
              (persona moral como S.A. de C.V.), entonces SI se cobra IVA al 16%. La exencion solo aplica cuando el
              prestador es persona fisica (individualmente o a traves de sociedad civil).
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
              <li>Servicios medicos profesionales prestados por PF con titulo → exento (Art. 15 frac. XIV LIVA)</li>
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
                    <td className="px-3 py-2">Persona fisica (612)</td>
                    <td className="px-3 py-2 font-medium">Persona moral</td>
                    <td className="px-3 py-2">Servicios profesionales (honorarios)</td>
                    <td className="px-3 py-2 text-red-600 font-medium">ISR 10% + IVA 10.6667%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Persona fisica (RESICO 626)</td>
                    <td className="px-3 py-2 font-medium">Persona moral</td>
                    <td className="px-3 py-2">Servicios profesionales (honorarios)</td>
                    <td className="px-3 py-2 text-orange-600 font-medium">ISR 1.25% + IVA 10.6667%</td>
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

      {/* Uso CFDI + Clasificacion automatica */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Uso del CFDI y Clasificacion Automatica</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            El "Uso CFDI" indica para que usara el <strong>receptor</strong> esa factura en su contabilidad.
            Es la <strong>senal principal de deducibilidad</strong> — el sistema la usa para determinar automaticamente
            si un gasto es deducible, acreditable, o sin efectos.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Clave</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripcion</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">612</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">RESICO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-green-50">
                  <td className="px-3 py-2 font-mono font-medium">G01</td>
                  <td className="px-3 py-2">Adquisicion de mercancias</td>
                  <td className="px-3 py-2 text-green-700">Deducible + IVA</td>
                  <td className="px-3 py-2 text-green-700">IVA acreditable</td>
                </tr>
                <tr className="bg-green-50">
                  <td className="px-3 py-2 font-mono font-medium">G03</td>
                  <td className="px-3 py-2">Gastos en general</td>
                  <td className="px-3 py-2 text-green-700">Deducible + IVA</td>
                  <td className="px-3 py-2 text-green-700">IVA acreditable</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">I01-I08</td>
                  <td className="px-3 py-2">Inversiones (mobiliario, computo, construccion)</td>
                  <td className="px-3 py-2 text-blue-700">Depreciable + IVA</td>
                  <td className="px-3 py-2 text-green-700">IVA acreditable</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">D01-D10</td>
                  <td className="px-3 py-2">Deducciones personales (medicos, colegiaturas, etc.)</td>
                  <td className="px-3 py-2 text-amber-700">Solo anual</td>
                  <td className="px-3 py-2 text-red-600 font-medium">No aplica</td>
                </tr>
                <tr className="bg-red-50">
                  <td className="px-3 py-2 font-mono font-medium text-red-700">S01</td>
                  <td className="px-3 py-2 text-red-700">Sin efectos fiscales</td>
                  <td className="px-3 py-2 text-red-600 font-medium">No deducible</td>
                  <td className="px-3 py-2 text-red-600 font-medium">Sin IVA</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium">CP01</td>
                  <td className="px-3 py-2">Pagos (complemento de pago tipo P)</td>
                  <td className="px-3 py-2 text-gray-500">N/A</td>
                  <td className="px-3 py-2 text-gray-500">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Clasificacion automatica de gastos</p>
            <p className="text-xs text-blue-700">
              Ademas del Uso CFDI, el sistema clasifica cada gasto en categorias (Insumos, Equipo Medico, Renta, Alimentos, etc.)
              usando la <strong>clave de producto/servicio (claveProdServ)</strong> del XML — un codigo UNSPSC de 8 digitos que identifica
              el tipo de bien o servicio. Si la clave no matchea, se buscan palabras clave en la descripcion del concepto.
              Los gastos que no se pueden clasificar aparecen como <strong>"Sin Clasificar"</strong> para revision manual.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Para medicos</p>
            <p className="text-xs text-amber-700">
              Cuando un paciente (persona fisica) te pide factura con uso <strong>D01</strong>, significa que va a deducir
              tu consulta como gasto medico personal en su declaracion anual. Si no piensa deducirla, usara S01.
              Esto afecta al <em>receptor</em>, no a ti como emisor — tu ingreso es el mismo.
            </p>
          </div>
        </div>
      </section>

      {/* Deducibility Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Gastos Deducibles para Medicos</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Deducibilidad segun tu regimen</p>
            <p className="text-xs text-blue-700">
              <strong>612 (Actividad Empresarial):</strong> Tus gastos son deducibles para ISR — reducen la base sobre la que pagas impuestos.
              El sistema clasifica automaticamente cada gasto usando el <strong>Uso CFDI</strong> (S01 = no deducible, G01/G03 = gasto operativo, I0x = inversion)
              y la <strong>clave de producto/servicio SAT</strong> del XML.<br/><br/>
              <strong>RESICO (626):</strong> Tus gastos <strong>no reducen ISR</strong>, pero el <strong>IVA si es acreditable</strong> (regla 3.13.20 RMF).
              Para acreditar IVA necesitas: CFDI valido, gasto indispensable para tu actividad, y pago bancarizado.
              CFDIs con uso S01 no generan IVA acreditable en ningun regimen.
            </p>
          </div>

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
                    <td className="px-3 py-2 text-gray-500">Depreciacion anual (% segun tipo de activo, Art. 34 LISR)</td>
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
                  <tr>
                    <td className="px-3 py-2 font-medium">Alimentos y viajes</td>
                    <td className="px-3 py-2 text-gray-500">Restaurantes, hoteles, vuelos, viaticos</td>
                    <td className="px-3 py-2 text-gray-500">Restaurantes: 8.5% deducible. Viaticos: 100% hasta $750/dia nacional</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Papeleria y limpieza</td>
                    <td className="px-3 py-2 text-gray-500">Material de oficina, toner, articulos de limpieza</td>
                    <td className="px-3 py-2 text-gray-500">100% deducible</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Clasificacion automatica</p>
            <p className="text-xs text-blue-700">
              El sistema clasifica tus gastos automaticamente usando dos senales del XML:<br/>
              1. <strong>Uso CFDI</strong> — Determina si el gasto es deducible (G01/G03 = si, S01 = no, I0x = inversion depreciable)<br/>
              2. <strong>Clave de producto/servicio (claveProdServ)</strong> — Codigo UNSPSC de 8 digitos que indica la categoria del gasto<br/>
              Si ninguna senal matchea, el gasto aparece como <strong>"Sin Clasificar"</strong> y requiere revision manual.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="font-semibold text-red-800 text-xs mb-1">Gastos NO deducibles (errores comunes)</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-red-700">
              <li><strong>Uso CFDI "S01 — Sin efectos fiscales"</strong> — no deducible y sin IVA acreditable en ningun regimen</li>
              <li>Gastos personales (supermercado, ropa, entretenimiento)</li>
              <li>Facturas a nombre de otra persona</li>
              <li>Pagos en efectivo mayores a $2,000 (aun con factura — Art. 105 LISR)</li>
              <li>Facturas de proveedores en lista negra del SAT (Art. 69-B)</li>
              <li>Gastos sin relacion con tu actividad profesional</li>
              <li>Donaciones a entidades no autorizadas</li>
              <li>CFDIs cancelados</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ISR Provisional Acumulado */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">ISR Provisional: Como Funciona el Calculo Acumulado</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            El ISR para personas fisicas con actividad empresarial (regimen 612) se paga de forma <strong>provisional cada mes</strong>,
            pero el calculo es <strong>acumulado</strong> desde enero hasta el mes que declaras. Esto significa que un mes malo
            puede compensar un mes bueno.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Regla fundamental</p>
            <p className="text-xs text-blue-700">
              Cada mes calculas ISR sobre la <strong>utilidad acumulada del ano</strong> (todos los ingresos del ano menos todas las
              deducciones del ano), no solo sobre lo de ese mes. Luego restas lo que ya pagaste en meses anteriores.
              El resultado es lo que pagas (o no pagas) ese mes.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Ejemplo con numeros</p>
            <p className="text-xs text-gray-600 mb-3">
              Un medico con consultorio privado tiene estos movimientos (ISR calculado con tarifa acumulada Art. 96 LISR,
              que es la tarifa mensual multiplicada por el numero de meses del periodo):
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Concepto</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Enero</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Febrero</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Marzo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-medium">Ingresos del mes</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">$100,000</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">$30,000</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">$80,000</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Deducciones del mes</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">$40,000</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">$80,000</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">$35,000</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 font-medium">Utilidad del mes</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-blue-700">$60,000</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-orange-700">−$50,000</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-blue-700">$45,000</td>
                  </tr>
                  <tr className="border-t-2 border-gray-300">
                    <td className="px-3 py-2 font-bold">Ingresos acumulados</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$100,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$130,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$210,000</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold">Deducciones acumuladas</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$40,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$120,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">$155,000</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-3 py-2 font-bold">Base gravable acumulada</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">$60,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">$10,000</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">$55,000</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">ISR acumulado (tarifa Art. 96)</td>
                    <td className="px-3 py-2 text-right font-mono">~$11,500</td>
                    <td className="px-3 py-2 text-right font-mono">~$570</td>
                    <td className="px-3 py-2 text-right font-mono">~$6,700</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">ISR ya pagado en meses previos</td>
                    <td className="px-3 py-2 text-right font-mono">$0</td>
                    <td className="px-3 py-2 text-right font-mono">$11,500</td>
                    <td className="px-3 py-2 text-right font-mono">$11,500</td>
                  </tr>
                  <tr className="bg-green-50 font-bold">
                    <td className="px-3 py-2">ISR a pagar este mes</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">$11,500</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">$0 (a favor: ~$10,900)</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">$0 (a favor: ~$4,800)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">¿Que paso en este ejemplo?</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-xs">
              <li><strong>Enero:</strong> Buen mes — gano $60k netos, paga ~$11,500 de ISR provisional</li>
              <li><strong>Febrero:</strong> Mal mes — gasto mas de lo que ingreso ($80k vs $30k). La base gravable acumulada baja de $60k a $10k.
                El ISR acumulado sobre $10k (2 meses) es solo ~$570, pero ya pago $11,500. Resultado: <strong>ISR a favor de ~$10,900</strong>. No paga nada este mes.</li>
              <li><strong>Marzo:</strong> Buen mes de nuevo — la base acumulada sube a $55k. ISR acumulado (3 meses) ~$6,700, pero ya pago $11,500.
                Todavia tiene <strong>~$4,800 a favor</strong>. Sigue sin pagar ISR.</li>
              <li>En abril, si sigue facturando bien, el ISR acumulado eventualmente superara los $11,500 que ya pago, y entonces empezara a pagar de nuevo.</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="font-semibold text-green-800 text-xs mb-1">ISR a favor — ¿como lo recuperas?</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-green-700">
              <li>El ISR a favor se <strong>arrastra automaticamente</strong> a los meses siguientes — no pagas ISR hasta que la utilidad acumulada genere mas ISR del que ya pagaste</li>
              <li>Si al terminar el ano todavia tienes ISR a favor, lo recuperas en la <strong>declaracion anual</strong> (abril del ano siguiente)</li>
              <li>En la anual puedes solicitar <strong>devolucion</strong> (el SAT te deposita el saldo a tu cuenta bancaria)</li>
              <li>El pago provisional mensual <strong>nunca puede ser negativo</strong> — lo minimo que pagas es $0, no te devuelven mes a mes</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <p className="font-semibold text-purple-800 text-xs mb-2">Como funciona la tabla de ISR (Art. 96)</p>
            <p className="text-xs text-purple-700 mb-2">
              La tabla tiene <strong>tramos</strong> (brackets). Cada tramo tiene: limite inferior, limite superior, <strong>cuota fija</strong> y <strong>tasa</strong>.
              Para calcular tu ISR, ubicas en que tramo cae tu base gravable y aplicas:
            </p>
            <div className="bg-white rounded p-2 mb-2 font-mono text-xs text-purple-900">
              <p className="font-bold mb-1">ISR = Cuota Fija + (Base Gravable − Limite Inferior) × Tasa</p>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-purple-700 mb-2">
              <li><strong>Cuota fija</strong> — Es el impuesto pre-calculado de todos los tramos debajo del tuyo. Es un atajo: en vez de calcular cada tramo inferior uno por uno, la tabla te da el total.</li>
              <li><strong>Tasa</strong> — Solo se aplica al <strong>excedente</strong>, es decir, la parte de tu base que esta DENTRO de tu tramo (base − limite inferior).</li>
              <li><strong>Escalamiento por mes</strong> — Para pagos provisionales (Art. 106), los limites y cuotas fijas se multiplican por el numero de mes. Enero ×1, febrero ×2, marzo ×3, etc. Esto ensancha los tramos conforme avanza el ano.</li>
            </ul>
            <p className="text-xs text-purple-700 mb-1 font-semibold">Ejemplo con numeros:</p>
            <div className="bg-white rounded p-2 text-xs text-purple-800 font-mono space-y-0.5">
              <p>Base gravable acumulada Ene-Feb: $130,492</p>
              <p>Mes 2 → tramo escalado: $111,470 – $158,777 (cuota $20,908, tasa 30%)</p>
              <p>Excedente = $130,492 − $111,470 = $19,023</p>
              <p>ISR = $20,908 + ($19,023 × 30%) = $20,908 + $5,707 = <strong>$26,615</strong></p>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              Por eso el ISR puede bajar de un mes a otro aunque tus ingresos suban: al escalar los tramos por mas meses, tu base puede caer en un tramo mas bajo con menor tasa.
            </p>

            <p className="text-xs text-purple-700 font-semibold mt-3 mb-1">Tabla mensual Art. 96 LISR (Anexo 8 RMF 2026):</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border border-purple-200 rounded">
                <thead>
                  <tr className="bg-purple-100 text-purple-800">
                    <th className="px-2 py-1 text-right border-r border-purple-200">Limite Inferior</th>
                    <th className="px-2 py-1 text-right border-r border-purple-200">Limite Superior</th>
                    <th className="px-2 py-1 text-right border-r border-purple-200">Cuota Fija</th>
                    <th className="px-2 py-1 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-purple-700">
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$0.01</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$844.58</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$0.00</td><td className="px-2 py-0.5 text-right">1.92%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$844.59</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$7,167.67</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$16.22</td><td className="px-2 py-0.5 text-right">6.40%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$7,167.68</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$12,601.03</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$420.90</td><td className="px-2 py-0.5 text-right">10.88%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$12,601.04</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$14,648.87</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,012.08</td><td className="px-2 py-0.5 text-right">16.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$14,648.88</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,533.64</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,339.74</td><td className="px-2 py-0.5 text-right">17.92%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,533.65</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$35,362.83</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$1,856.84</td><td className="px-2 py-0.5 text-right">21.36%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$35,362.84</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$55,734.75</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$5,662.62</td><td className="px-2 py-0.5 text-right">23.52%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$55,734.76</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$79,388.37</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$10,454.09</td><td className="px-2 py-0.5 text-right">30.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$79,388.38</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$106,410.50</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$17,550.18</td><td className="px-2 py-0.5 text-right">32.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$106,410.51</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$375,975.61</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$26,197.27</td><td className="px-2 py-0.5 text-right">34.00%</td></tr>
                  <tr className="border-t border-purple-100"><td className="px-2 py-0.5 text-right border-r border-purple-100">$375,975.62</td><td className="px-2 py-0.5 text-right border-r border-purple-100">En adelante</td><td className="px-2 py-0.5 text-right border-r border-purple-100">$117,829.97</td><td className="px-2 py-0.5 text-right">35.00%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-purple-500 mt-1">
              Para pagos provisionales, multiplica Limite Inferior, Limite Superior y Cuota Fija por el numero de mes (ej: marzo = ×3). La Tasa no cambia.
            </p>

            <p className="text-xs text-purple-700 font-semibold mt-3 mb-1">Tabla RESICO Art. 113-E LISR:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border border-emerald-200 rounded">
                <thead>
                  <tr className="bg-emerald-100 text-emerald-800">
                    <th className="px-2 py-1 text-right border-r border-emerald-200">Ingreso Mensual Desde</th>
                    <th className="px-2 py-1 text-right border-r border-emerald-200">Hasta</th>
                    <th className="px-2 py-1 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-emerald-700">
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$0.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$25,000.00</td><td className="px-2 py-0.5 text-right">1.00%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$25,000.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$50,000.00</td><td className="px-2 py-0.5 text-right">1.10%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$50,000.01</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$83,333.33</td><td className="px-2 py-0.5 text-right">1.50%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$83,333.34</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$208,333.33</td><td className="px-2 py-0.5 text-right">2.00%</td></tr>
                  <tr className="border-t border-emerald-100"><td className="px-2 py-0.5 text-right border-r border-emerald-100">$208,333.34</td><td className="px-2 py-0.5 text-right border-r border-emerald-100">$291,666.67</td><td className="px-2 py-0.5 text-right">2.50%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-emerald-500 mt-1">
              RESICO: ISR = Ingresos × Tasa. Sin cuota fija, sin excedente, sin acumulacion. Limite anual $3.5M.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-800 text-xs mb-1">Diferencia clave vs RESICO</p>
            <p className="text-xs text-amber-700">
              En <strong>RESICO (626)</strong>, el ISR se calcula sobre <strong>ingresos brutos de cada mes</strong> a tasa fija, sin deducciones
              y sin acumulacion. Un mes malo no te ayuda — si facturaste $30,000, pagas 1-2.5% sobre esos $30,000 sin importar
              cuanto hayas gastado. No puedes generar ISR a favor por exceso de gastos (porque no hay deducciones).
              Sin embargo, si facturas a personas morales y las retenciones de ISR (1.25%) superan el ISR calculado del mes,
              si puedes tener ISR a favor por retenciones.
              En general, si tus gastos son altos o variables, el regimen 612 puede ser mas conveniente.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Las retenciones tambien se acumulan</p>
            <p className="text-xs text-blue-700">
              Si facturas a personas morales (hospitales, aseguradoras), te retienen 10% de ISR. Esas retenciones se restan
              del ISR provisional que debes pagar. Si las retenciones son mayores que el ISR calculado,
              el excedente se convierte en ISR a favor adicional. Ejemplo: si tu ISR del mes es $8,000 pero te retuvieron
              $12,000 en el ano, tienes $4,000 mas a favor.
            </p>
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
                  <td className="px-3 py-2 text-gray-500">Ultimo dia del mes siguiente (Regla 4.5.1 RMF)</td>
                  <td className="px-3 py-2 text-gray-500">Informativa: a quienes les pagaste IVA (proveedores)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Contabilidad electronica</td>
                  <td className="px-3 py-2">Mensual</td>
                  <td className="px-3 py-2 text-gray-500">Variable (3-5 del segundo mes)</td>
                  <td className="px-3 py-2 text-gray-500">Balanza de comprobacion y catalogo de cuentas</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Diferencias por regimen</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
              <li><strong>612:</strong> ISR mensual provisional (ingresos − deducciones × tabla), IVA mensual, DIOT, contabilidad electronica, declaracion anual en abril</li>
              <li><strong>RESICO (626):</strong> ISR mensual (ingresos brutos × tasa fija), IVA mensual, declaracion anual simplificada. <strong>No requiere</strong> contabilidad electronica ni DIOT</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="font-semibold text-green-800 text-xs mb-1">Como te ayuda esta herramienta</p>
            <p className="text-xs text-green-700">
              Con los CFDIs descargados del SAT puedes:<br/>
              • Verificar que tienes todas las facturas de ingresos y gastos del mes<br/>
              • Calcular tu IVA trasladado vs acreditable (aplica a 612 y RESICO)<br/>
              • Identificar facturas canceladas que ya no debes considerar<br/>
              • Monitorear tus ingresos acumulados (importante para RESICO y su limite de $3.5M)<br/>
              • Preparar la informacion para tu contador antes de la fecha limite
            </p>
          </div>
        </div>
      </section>

      {/* XML Details */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Detalles XML — Campos del CFDI</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            Al expandir un CFDI y hacer clic en <strong>"Ver detalles XML"</strong>, se muestra el desglose
            fiscal completo. Estos son los campos principales:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Campo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Que es</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-medium">Subtotal</td>
                  <td className="px-3 py-2 text-gray-500">Suma de conceptos antes de impuestos</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">IVA Trasladado</td>
                  <td className="px-3 py-2 text-gray-500">Impuesto al 16% cobrado al cliente. Tasa 0% en alimentos basicos y medicinas.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">ISR Retenido</td>
                  <td className="px-3 py-2 text-gray-500">Retencion de ISR (10% en 612, 1.25% en RESICO) cuando persona moral paga honorarios.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">IVA Retenido</td>
                  <td className="px-3 py-2 text-gray-500">Retencion de IVA (2/3 del IVA). Aplica en servicios profesionales PF a PM.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Metodo Pago</td>
                  <td className="px-3 py-2 text-gray-500"><strong>PUE</strong> = pago al contado. <strong>PPD</strong> = pago diferido/parcialidades.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Forma Pago</td>
                  <td className="px-3 py-2 text-gray-500">01=Efectivo, 03=Transferencia, 04=Tarjeta credito, 28=Tarjeta debito, 99=Por definir</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Uso CFDI</td>
                  <td className="px-3 py-2 text-gray-500">Destino fiscal (G03=Gastos, I04=Computo, S01=Sin efectos). Determina deducibilidad.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Conceptos</td>
                  <td className="px-3 py-2 text-gray-500">Lineas de la factura con descripcion, clave SAT (claveProdServ), cantidad, precio e IVA. El sistema usa la clave SAT para clasificar el gasto automaticamente.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
            <strong>Nota:</strong> Los complementos de pago (tipo P) no tienen subtotal ni conceptos — solo registran
            que se realizo un pago asociado a una factura previa.
          </p>
        </div>
      </section>

      {/* Tipo column */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Columna "Tipo" — Impacto Financiero</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 text-sm text-gray-700">
          <p>
            El SAT clasifica cada CFDI por su <strong>EfectoComprobante</strong> (I=Ingreso, E=Egreso, P=Pago).
            Pero el impacto financiero depende de si tu lo <em>emitiste</em> o lo <em>recibiste</em>:
          </p>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Direccion + Efecto</th>
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
                  <td className="px-3 py-2 text-gray-500">Alguien te facturo — dinero que pagaste</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Emi</span> + Egreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-orange-600">Nota de credito</span></td>
                  <td className="px-3 py-2 text-gray-500">Emitiste una devolucion/descuento</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Rec</span> + Egreso</td>
                  <td className="px-3 py-2"><span className="font-medium text-blue-600">Nota de credito</span></td>
                  <td className="px-3 py-2 text-gray-500">Te emitieron una devolucion/descuento a tu favor</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">Rec</span> + Pago</td>
                  <td className="px-3 py-2"><span className="font-medium text-green-600">Pago recibido</span></td>
                  <td className="px-3 py-2 text-gray-500">Complemento de pago — te pagaron una factura PPD</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Emi</span> + Pago</td>
                  <td className="px-3 py-2"><span className="font-medium text-red-600">Pago emitido</span></td>
                  <td className="px-3 py-2 text-gray-500">Complemento de pago — pagaste una factura PPD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Edge Cases Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Casos Especiales</h3>
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
              <li>Para PF, la deduccion se toma en el periodo en que se <strong>paga efectivamente</strong> (flujo de efectivo, Art. 105 LISR), sin importar la fecha de la factura</li>
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

        </div>
      </section>

      {/* Complementos de Pago */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Complementos de Pago (PPD)</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 text-sm text-gray-700">
          <p>
            Cuando emites una factura con metodo de pago <strong>PPD</strong> (Pago en Parcialidades o Diferido),
            el pago no se recibe al momento de facturar. El SAT requiere que cuando recibas el pago,
            emitas un <strong>CFDI tipo P</strong> (Complemento de Pago) que vincula el pago recibido con tu factura original.
          </p>

          <div>
            <p className="font-semibold text-gray-800 mb-2">¿Como funciona?</p>
            <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
              <li>Emites una factura PPD (ej: $50,000 por un tratamiento a pagarse en 3 meses)</li>
              <li>Cuando tu cliente paga (parcial o total), se emite un CFDI tipo P</li>
              <li>El complemento indica: que factura se paga, cuanto se pago, y cuanto queda pendiente</li>
              <li>Se repite hasta que el saldo insoluto llegue a $0</li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">¿Como lo veo aqui?</p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>En la lista de CFDIs, busca facturas con metodo de pago <strong>PPD</strong></li>
              <li>Expande la factura y da clic en <em>&quot;Ver detalles XML&quot;</em></li>
              <li>Veras un indicador de estado de pago con colores:</li>
            </ul>
            <div className="mt-2 ml-5 space-y-1">
              <p><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span><strong>Pagado</strong> — el saldo insoluto llego a $0</p>
              <p><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-2"></span><strong>Pago parcial</strong> — se han recibido pagos pero falta saldo</p>
              <p><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span><strong>Pendiente</strong> — no se ha recibido ningun complemento de pago</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="font-semibold text-blue-800 text-xs mb-1">Importante para tu contabilidad</p>
            <p className="text-xs text-blue-700">
              Para efectos de IVA, el impuesto de facturas PPD se declara <strong>hasta que se recibe el pago</strong>,
              no cuando se emite la factura. Por eso es importante dar seguimiento a los complementos de pago.
              Si una factura PPD no tiene complemento, ese ingreso aun no se considera &quot;cobrado&quot; fiscalmente.
            </p>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="font-semibold text-gray-700 text-xs mb-1">Disclaimer</p>
          <p className="text-xs text-gray-500">
            Esta guia es informativa y no sustituye el consejo de un contador publico certificado.
            Las leyes fiscales cambian frecuentemente. Consulta a tu contador para decisiones
            especificas sobre tu situacion fiscal.
          </p>
        </div>
      </section>
    </div>
  );
}

