"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import {
  Receipt,
  Settings,
  Upload,
  Plus,
  FileText,
  Download,
  Mail,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  RefreshCw,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  Ban,
  CreditCard,
  MinusCircle,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiscalProfile {
  id: number;
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  regimenFiscalDesc: string | null;
  codigoPostal: string;
  csdUploaded: boolean;
  csdUploadedAt: string | null;
  csdValidUntil: string | null;
  facturamaStatus: string;
  fielUploaded: boolean;
  fielUploadedAt: string | null;
  fielValidUntil: string | null;
}

interface CSDStatus {
  configured: boolean;
  csdUploaded: boolean;
  facturamaStatus: string;
  certificateNumber?: string;
  validFrom?: string;
  validTo?: string;
  rfc?: string;
  taxName?: string;
  message?: string;
}

interface CfdiEmitted {
  id: number;
  uuid: string;
  folio: string | null;
  cfdiType: string;
  rfcReceptor: string;
  nombreReceptor: string;
  subtotal: string;
  iva: string | null;
  total: string;
  formaPago: string;
  metodoPago: string;
  status: string;
  issuedAt: string;
}

interface CatalogItem {
  Value: string;
  Name: string;
}

// ---------------------------------------------------------------------------
// Offline fallback catalogs (used when API fails or returns non-array)
// ---------------------------------------------------------------------------

const OFFLINE_REGIMENES: CatalogItem[] = [
  { Value: '601', Name: 'General de Ley Personas Morales' },
  { Value: '603', Name: 'Personas Morales con Fines no Lucrativos' },
  { Value: '605', Name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { Value: '606', Name: 'Arrendamiento' },
  { Value: '608', Name: 'Demás ingresos' },
  { Value: '612', Name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { Value: '616', Name: 'Sin obligaciones fiscales' },
  { Value: '621', Name: 'Incorporación Fiscal' },
  { Value: '625', Name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { Value: '626', Name: 'Régimen Simplificado de Confianza' },
];

const OFFLINE_FORMAS_PAGO: CatalogItem[] = [
  { Value: '01', Name: 'Efectivo' },
  { Value: '02', Name: 'Cheque nominativo' },
  { Value: '03', Name: 'Transferencia electrónica de fondos' },
  { Value: '04', Name: 'Tarjeta de crédito' },
  { Value: '28', Name: 'Tarjeta de débito' },
  { Value: '99', Name: 'Por definir' },
];

const OFFLINE_USOS_CFDI: CatalogItem[] = [
  { Value: 'D01', Name: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { Value: 'D02', Name: 'Gastos médicos por incapacidad o discapacidad' },
  { Value: 'G03', Name: 'Gastos en general' },
  { Value: 'S01', Name: 'Sin efectos fiscales' },
  { Value: 'CP01', Name: 'Pagos' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FacturacionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <FacturacionPageInner />
    </Suspense>
  );
}

function FacturacionPageInner() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"facturas" | "config" | "nueva" | "rep" | "egreso" | "guia">("config");
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [csdStatus, setCsdStatus] = useState<CSDStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Pre-fill data from ledger/booking integration (query params)
  const fromPrefill = searchParams.get("from") === "ledger" || searchParams.get("from") === "booking";
  const ledgerData = useMemo(() => fromPrefill ? {
    ledgerEntryId: parseInt(searchParams.get("ledgerId") || "0") || undefined,
    concept: searchParams.get("concept") || "",
    amount: parseFloat(searchParams.get("amount") || "0") || 0,
    clientName: searchParams.get("clientName") || "",
    formaDePago: searchParams.get("formaDePago") || "",
    rfc: searchParams.get("rfc") || undefined,
    fiscalRegime: searchParams.get("fiscalRegime") || undefined,
    cfdiUse: searchParams.get("cfdiUse") || undefined,
    taxZipCode: searchParams.get("taxZipCode") || undefined,
  } : null, [fromPrefill, searchParams]);

  // F2c: hydrate from a CFDI draft (?draft=<id>) — richer than query params
  // (N conceptos with flags; receiver derived FRESH server-side). Wins over
  // ledgerData when both are present (09-DISENO §7.3).
  const draftIdParam = parseInt(searchParams.get("draft") || "0") || 0;
  const [draftData, setDraftData] = useState<DraftPrefill | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => {
    if (!draftIdParam) return;
    authFetch(`${API_URL}/api/facturacion/drafts/${draftIdParam}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.data) {
          setDraftError(body.error || "No se pudo cargar el borrador");
          return;
        }
        setDraftData(body.data as DraftPrefill);
      })
      .catch(() => setDraftError("No se pudo cargar el borrador (error de red)"));
  }, [draftIdParam]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/profile`);
      if (res.ok) {
        const { data } = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Error fetching fiscal profile:", err);
    }
  }, []);

  const fetchCSDStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/csd/status`);
      if (res.ok) {
        const { data } = await res.json();
        setCsdStatus(data);
      }
    } catch (err) {
      console.error("Error fetching CSD status:", err);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      Promise.all([fetchProfile(), fetchCSDStatus()]).finally(() => setLoading(false));
    }
  }, [sessionStatus, fetchProfile, fetchCSDStatus]);

  // Once profile is set and CSD is active, default to appropriate tab
  // (a pending draft link also lands on "nueva" — F2c)
  useEffect(() => {
    if (profile && csdStatus?.csdUploaded && csdStatus.facturamaStatus === "active") {
      setActiveTab(ledgerData || draftIdParam ? "nueva" : "facturas");
    }
  }, [profile, csdStatus, ledgerData, draftIdParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isReady = profile && csdStatus?.csdUploaded && csdStatus.facturamaStatus === "active";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-blue-600" />
          Facturación Electrónica (CFDI)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Emite facturas oficiales (CFDI 4.0) directamente desde tu cuenta
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          <TabButton
            active={activeTab === "config"}
            onClick={() => setActiveTab("config")}
            icon={Settings}
            label="Configuración"
          />
          {isReady && (
            <>
              <TabButton
                active={activeTab === "facturas"}
                onClick={() => setActiveTab("facturas")}
                icon={FileText}
                label="Mis Facturas"
              />
              <TabButton
                active={activeTab === "nueva"}
                onClick={() => setActiveTab("nueva")}
                icon={Plus}
                label="Nueva Factura"
              />
              <TabButton
                active={activeTab === "rep"}
                onClick={() => setActiveTab("rep")}
                icon={CreditCard}
                label="REP (Pago)"
              />
              <TabButton
                active={activeTab === "egreso"}
                onClick={() => setActiveTab("egreso")}
                icon={MinusCircle}
                label="Nota de Crédito"
              />
            </>
          )}
          <TabButton
            active={activeTab === "guia"}
            onClick={() => setActiveTab("guia")}
            icon={BookOpen}
            label="Guía"
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "config" && (
        <ConfigTab
          profile={profile}
          csdStatus={csdStatus}
          onProfileSaved={() => { fetchProfile(); fetchCSDStatus(); }}
          onCSDUploaded={() => fetchCSDStatus()}
        />
      )}
      {activeTab === "facturas" && <FacturasListTab />}
      {activeTab === "nueva" && profile && (
        // Draft hydration is async: while a ?draft= link is loading, defer the
        // form mount (state initializers run once — a form mounted empty would
        // ignore the draft when it arrives).
        draftIdParam && !draftData && !draftError ? (
          <div className="text-sm text-gray-500 p-6">Cargando borrador…</div>
        ) : (
          <NuevaFacturaTab
            profile={profile}
            onCreated={() => setActiveTab("facturas")}
            ledgerData={draftData ? null : ledgerData}
            draftData={draftData}
            draftError={draftError}
          />
        )
      )}
      {activeTab === "rep" && profile && (
        <REPTab onCreated={() => setActiveTab("facturas")} />
      )}
      {activeTab === "egreso" && profile && (
        <EgresoTab onCreated={() => setActiveTab("facturas")} />
      )}
      {activeTab === "guia" && <GuiaTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

function TabButton({
  active, onClick, icon: Icon, label
}: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CONFIG TAB
// ---------------------------------------------------------------------------

function ConfigTab({
  profile, csdStatus, onProfileSaved, onCSDUploaded
}: {
  profile: FiscalProfile | null;
  csdStatus: CSDStatus | null;
  onProfileSaved: () => void;
  onCSDUploaded: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Step 1: Fiscal Profile */}
      <FiscalProfileForm profile={profile} onSaved={onProfileSaved} />

      {/* Step 2: CSD Upload (only if profile exists) */}
      {profile && (
        <CSDUploadSection profile={profile} csdStatus={csdStatus} onUploaded={onCSDUploaded} />
      )}

      {/* Step 3: e.Firma Upload (for SAT Descarga Masiva) */}
      {profile && (
        <EFirmaUploadSection profile={profile} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FISCAL PROFILE FORM
// ---------------------------------------------------------------------------

function FiscalProfileForm({
  profile, onSaved
}: {
  profile: FiscalProfile | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    rfc: profile?.rfc || "",
    razonSocial: profile?.razonSocial || "",
    regimenFiscal: profile?.regimenFiscal || "",
    regimenFiscalDesc: profile?.regimenFiscalDesc || "",
    codigoPostal: profile?.codigoPostal || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [regimenes, setRegimenes] = useState<CatalogItem[]>([]);

  useEffect(() => {
    authFetch(`${API_URL}/api/facturacion/catalogos/regimenes-fiscales`)
      .then(res => res.json())
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setRegimenes(list.length > 0 ? list : OFFLINE_REGIMENES);
      })
      .catch(() => setRegimenes(OFFLINE_REGIMENES));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const selectedRegimen = regimenes.find(r => r.Value === form.regimenFiscal);
      const res = await authFetch(`${API_URL}/api/facturacion/profile`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          regimenFiscalDesc: selectedRegimen?.Name || form.regimenFiscalDesc,
        }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al guardar");
      }

      setSuccess(true);
      onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          profile ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        }`}>
          {profile ? <CheckCircle2 className="w-4 h-4" /> : "1"}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Datos Fiscales</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
            <input
              type="text"
              value={form.rfc}
              onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
              placeholder="XAXX010101000"
              maxLength={13}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              required
            />
            <p className="text-xs text-gray-400 mt-1">12 caracteres (moral) o 13 (física)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
            <input
              type="text"
              value={form.codigoPostal}
              onChange={e => setForm({ ...form, codigoPostal: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder="06600"
              maxLength={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
          <input
            type="text"
            value={form.razonSocial}
            onChange={e => setForm({ ...form, razonSocial: e.target.value })}
            placeholder="Dr. Juan Pérez López"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Tal como aparece en tu Constancia de Situación Fiscal</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
          <select
            value={form.regimenFiscal}
            onChange={e => setForm({ ...form, regimenFiscal: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Seleccionar régimen...</option>
            {regimenes.map(r => (
              <option key={r.Value} value={r.Value}>{r.Value} - {r.Name}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Perfil fiscal guardado correctamente
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {profile ? "Actualizar" : "Guardar"} Datos Fiscales
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSD UPLOAD SECTION
// ---------------------------------------------------------------------------

function CSDUploadSection({
  profile, csdStatus, onUploaded
}: {
  profile: FiscalProfile;
  csdStatus: CSDStatus | null;
  onUploaded: () => void;
}) {
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isActive = csdStatus?.csdUploaded && csdStatus.facturamaStatus === "active";

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/x-x509-ca-cert;base64,")
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cerFile || !keyFile || !password) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const [certificate, privateKey] = await Promise.all([
        fileToBase64(cerFile),
        fileToBase64(keyFile),
      ]);

      const method = isActive ? "PUT" : "POST";
      const res = await authFetch(`${API_URL}/api/facturacion/csd`, {
        method,
        body: JSON.stringify({ certificate, privateKey, privateKeyPassword: password }),
      });

      if (!res.ok) {
        const { error: msg, details } = await res.json();
        throw new Error(msg || "Error al cargar sellos");
      }

      setSuccess(true);
      setCerFile(null);
      setKeyFile(null);
      setPassword("");
      onUploaded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          isActive ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        }`}>
          {isActive ? <CheckCircle2 className="w-4 h-4" /> : "2"}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Sellos Digitales (CSD)</h2>
      </div>

      {/* Current status */}
      {isActive && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
            <Shield className="w-4 h-4" />
            Sellos activos - RFC: {csdStatus?.rfc}
          </div>
          {csdStatus?.validTo && (
            <p className="text-xs text-green-600 mt-1">
              Vigencia hasta: {new Date(csdStatus.validTo).toLocaleDateString("es-MX")}
            </p>
          )}
          {csdStatus?.certificateNumber && (
            <p className="text-xs text-green-600">
              No. Certificado: {csdStatus.certificateNumber}
            </p>
          )}
        </div>
      )}

      {csdStatus?.facturamaStatus === "error" && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
            <AlertCircle className="w-4 h-4" />
            {csdStatus.message || "Error con los sellos. Vuélvelos a cargar."}
          </div>
        </div>
      )}

      {/* Upload form */}
      <form onSubmit={handleUpload} className="space-y-4">
        <p className="text-sm text-gray-600">
          {isActive
            ? "Puedes actualizar tus sellos si obtuviste unos nuevos:"
            : "Sube los archivos CSD que te dio el SAT para poder emitir facturas:"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Certificado (.cer)
            </label>
            <input
              type="file"
              accept=".cer"
              onChange={e => setCerFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Llave Privada (.key)
            </label>
            <input
              type="file"
              accept=".key"
              onChange={e => setKeyFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña del .key
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña de la llave privada"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Sellos cargados correctamente. Ya puedes emitir facturas.
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !cerFile || !keyFile || !password}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isActive ? "Actualizar" : "Cargar"} Sellos
        </button>
      </form>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-xs text-amber-700">
          <strong>Nota de seguridad:</strong> Tus archivos CSD se envían directamente a Facturama (PAC autorizado por el SAT)
          a través de conexión cifrada. No almacenamos tus llaves privadas en nuestros servidores.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// e.FIRMA (FIEL) UPLOAD SECTION
// ---------------------------------------------------------------------------

function EFirmaUploadSection({ profile }: { profile: FiscalProfile }) {
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fielStatus, setFielStatus] = useState<{
    configured: boolean;
    uploadedAt: string | null;
    validUntil: string | null;
    expired: boolean;
  }>({
    configured: profile.fielUploaded,
    uploadedAt: profile.fielUploadedAt,
    validUntil: profile.fielValidUntil,
    expired: profile.fielValidUntil ? new Date() > new Date(profile.fielValidUntil) : false,
  });

  const isActive = fielStatus.configured && !fielStatus.expired;

  const fetchFielStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/fiel`);
      if (res.ok) {
        const { data } = await res.json();
        setFielStatus(data);
      }
    } catch (err) {
      console.error("Error fetching e.Firma status:", err);
    }
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cerFile || !keyFile || !password) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const [certificate, privateKey] = await Promise.all([
        fileToBase64(cerFile),
        fileToBase64(keyFile),
      ]);

      const res = await authFetch(`${API_URL}/api/sat-descarga/fiel`, {
        method: "POST",
        body: JSON.stringify({ certificate, privateKey, password }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al cargar e.Firma");
      }

      setSuccess(true);
      setCerFile(null);
      setKeyFile(null);
      setPassword("");
      fetchFielStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar tu e.Firma? No podrás consultar CFDIs del SAT hasta que cargues una nueva.")) return;

    try {
      const res = await authFetch(`${API_URL}/api/sat-descarga/fiel`, { method: "DELETE" });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al eliminar e.Firma");
      }
      setFielStatus({ configured: false, uploadedAt: null, validUntil: null, expired: false });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          isActive ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
        }`}>
          {isActive ? <CheckCircle2 className="w-4 h-4" /> : "3"}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">e.Firma (FIEL) — Descarga Masiva SAT</h2>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Opcional</span>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        La e.Firma permite consultar y descargar tus CFDIs directamente del SAT (emitidos y recibidos).
        Es diferente al CSD — la e.Firma la obtuviste presencialmente en oficinas del SAT.
      </p>

      {/* Current status */}
      {isActive && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <Shield className="w-4 h-4" />
                e.Firma activa — Lista para descargar CFDIs del SAT
              </div>
              {fielStatus.validUntil && (
                <p className="text-xs text-green-600 mt-1">
                  Vigencia hasta: {new Date(fielStatus.validUntil).toLocaleDateString("es-MX")}
                </p>
              )}
            </div>
            <button
              onClick={handleDelete}
              className="text-xs text-red-600 hover:text-red-700 hover:underline"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {fielStatus.expired && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
            <AlertCircle className="w-4 h-4" />
            Tu e.Firma ha expirado. Carga una nueva para seguir consultando el SAT.
          </div>
        </div>
      )}

      {/* Upload form */}
      {!isActive && (
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificado e.Firma (.cer)
              </label>
              <input
                type="file"
                accept=".cer"
                onChange={e => setCerFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Llave Privada e.Firma (.key)
              </label>
              <input
                type="file"
                accept=".key"
                onChange={e => setKeyFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          </div>

          <div className="max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña de la e.Firma
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña de la llave privada"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-md">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              e.Firma cargada correctamente. Ya puedes consultar tus CFDIs del SAT.
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !cerFile || !keyFile || !password}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Cargar e.Firma
          </button>
        </form>
      )}

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-xs text-amber-700">
          <strong>Nota de seguridad:</strong> Tu e.Firma se almacena cifrada (AES-256) en nuestros servidores.
          Se usa exclusivamente para consultar el SAT en tu nombre. Nunca se comparte con terceros.
        </p>
      </div>

      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-gray-600">
          <strong>¿Cuál es la diferencia?</strong> El CSD (paso 2) sirve para <em>emitir</em> facturas.
          La e.Firma sirve para <em>consultar</em> tus CFDIs existentes en el SAT. Son archivos diferentes.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FACTURAS LIST TAB
// ---------------------------------------------------------------------------

function FacturasListTab() {
  const [facturas, setFacturas] = useState<CfdiEmitted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchFacturas = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi?${params}`);
      if (!res.ok) throw new Error("Error al obtener facturas");
      const json = await res.json();
      setFacturas(Array.isArray(json.data) ? json.data : []);
      if (json.pagination) setPagination(json.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchFacturas();
  }, [fetchFacturas]);

  const handleDownloadFile = async (id: number, format: "pdf" | "xml") => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/${format}`);
      if (!res.ok) throw new Error(`Error al descargar ${format.toUpperCase()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura_${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePreviewHtml = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/html`);
      if (!res.ok) throw new Error("Error al obtener preview");
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendEmail = async (id: number) => {
    const email = prompt("Email del destinatario:");
    if (!email) return;
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/email`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al enviar");
      }
      alert("Factura enviada por email");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: number) => {
    const motiveInput = prompt(
      "Motivo de cancelación:\n01 - Errores con relación (sustituir)\n02 - Errores sin relación\n03 - No se llevó a cabo\n04 - Factura global\n\nIngresa el código (01-04):"
    );
    if (motiveInput === null || motiveInput.trim() === "") return;
    const trimmed = motiveInput.trim();
    const motive = ["1", "2", "3", "4"].includes(trimmed) ? `0${trimmed}` : trimmed;
    if (!["01", "02", "03", "04"].includes(motive)) {
      alert(`Motivo inválido: "${trimmed}". Escribe el código de dos dígitos: 01, 02, 03 o 04.`);
      return;
    }

    let uuidReplacement: string | undefined;
    if (motive === "01") {
      uuidReplacement = prompt("UUID de la factura que sustituye:") || undefined;
      if (!uuidReplacement) return;
    }

    if (!confirm("¿Estás seguro de cancelar esta factura? Esta acción se reporta al SAT.")) return;

    try {
      setCancellingId(id);
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ motive, uuidReplacement }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al cancelar");
      }
      const { data } = await res.json();
      alert(data.status === "cancellation_pending"
        ? "Cancelación enviada. El receptor tiene 72 horas para aceptar."
        : "Factura cancelada exitosamente.");
      fetchFacturas();
    } catch (err: any) {
      // El "Ups! Ocurrió un problema al cancelar tu comprobante" genérico de
      // Facturama no es un problema de datos del doctor: el PAC falló al
      // procesar la cancelación (en sandbox pasa SIEMPRE con CFDIs timbrados
      // con un CSD real — el ambiente de pruebas del SAT no lo reconoce).
      let msg: string = err.message || "Error al cancelar factura";
      if (/problema al cancelar/i.test(msg)) {
        msg += "\n\n💡 La falla es del servicio de cancelación (PAC), no de tus datos. La factura sigue vigente; intenta más tarde y si persiste contacta soporte.";
      }
      alert(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadAcuse = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/acuse?format=pdf`);
      if (!res.ok) throw new Error("Error al descargar acuse");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acuse_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const cfdiTypeLabels: Record<string, string> = { I: "Ingreso", E: "Egreso", P: "Pago" };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los status</option>
          <option value="active">Vigentes</option>
          <option value="cancelled">Canceladas</option>
          <option value="cancellation_pending">Cancelación pendiente</option>
        </select>
        <button onClick={fetchFacturas} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Actualizar">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-400 ml-auto">{pagination.total} factura{pagination.total !== 1 ? "s" : ""}</span>
      </div>

      {facturas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {statusFilter ? "No hay facturas con ese status" : "No has emitido facturas aún"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Receptor</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {new Date(f.issuedAt).toLocaleDateString("es-MX")}
                      {f.folio && <div className="text-xs text-gray-400">Folio: {f.folio}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        f.cfdiType === "I" ? "bg-blue-50 text-blue-700" :
                        f.cfdiType === "E" ? "bg-orange-50 text-orange-700" :
                        "bg-purple-50 text-purple-700"
                      }`}>
                        {cfdiTypeLabels[f.cfdiType] || f.cfdiType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{f.nombreReceptor}</div>
                      <div className="text-xs text-gray-400">{f.rfcReceptor}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                      ${parseFloat(f.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handlePreviewHtml(f.id)} title="Vista previa"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDownloadFile(f.id, "pdf")} title="Descargar PDF"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDownloadFile(f.id, "xml")} title="Descargar XML"
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSendEmail(f.id)} title="Enviar por email"
                          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded">
                          <Mail className="w-4 h-4" />
                        </button>
                        {f.status === "active" && (
                          <button
                            onClick={() => handleCancel(f.id)}
                            disabled={cancellingId === f.id}
                            title="Cancelar factura"
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            {cancellingId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                          </button>
                        )}
                        {(f.status === "cancelled" || f.status === "cancellation_pending") && (
                          <button onClick={() => handleDownloadAcuse(f.id)} title="Descargar acuse de cancelación"
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded">
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    cancellation_pending: "bg-yellow-100 text-yellow-700",
  };
  const labels: Record<string, string> = {
    active: "Vigente",
    cancelled: "Cancelada",
    cancellation_pending: "Cancelando...",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// NUEVA FACTURA TAB
// ---------------------------------------------------------------------------

interface LedgerPrefill {
  ledgerEntryId?: number;
  concept: string;
  amount: number;
  clientName: string;
  formaDePago: string;
  // Receiver fiscal data (pre-filled from booking/patient)
  rfc?: string;
  fiscalRegime?: string;
  cfdiUse?: string;
  taxZipCode?: string;
}

// F2c: what GET /facturacion/drafts/[id] returns — stored flags + FRESH
// server-derived receiver/income context (09-DISENO §7.4/7.5).
interface DraftPrefill {
  id: number;
  ledgerEntryId: number | null;
  items: {
    description: string; productCode: string; unitCode: string;
    quantity: number; unitPrice: number; withIva: boolean; withIsrRetention: boolean;
  }[];
  paymentForm: string;
  paymentMethod: string;
  observations: string | null;
  status: string;
  receiver: { rfc: string; name: string; cfdiUse: string; fiscalRegime: string; taxZipCode: string } | null;
  esPublicoGeneral: boolean;
  camposFaltantes: string[];
  usoIncompatible?: boolean;
  paciente: { id: string; nombre: string } | null;
  ingreso: { id: number; amount: number; concept: string; hasFactura: boolean; formaDePago: string | null } | null;
}

// Map ledger formaDePago values to SAT payment form codes
const LEDGER_TO_SAT_FORMA: Record<string, string> = {
  efectivo: "01",
  cheque: "02",
  transferencia: "03",
  tarjeta: "04",
  deposito: "03",
};

function NuevaFacturaTab({
  profile, onCreated, ledgerData, draftData, draftError
}: {
  profile: FiscalProfile;
  onCreated: () => void;
  ledgerData?: LedgerPrefill | null;
  draftData?: DraftPrefill | null;
  draftError?: string | null;
}) {
  // F2c: a draft hydrates everything (receiver server-derived + N items with
  // flags); the query-param prefill stays as the single-concept legacy path.
  const [receiver, setReceiver] = useState(
    draftData?.receiver ?? {
      rfc: ledgerData?.rfc || "",
      name: ledgerData?.clientName || "",
      cfdiUse: ledgerData?.cfdiUse || "D01",
      fiscalRegime: ledgerData?.fiscalRegime || "",
      taxZipCode: ledgerData?.taxZipCode || "",
    }
  );
  const [items, setItems] = useState(
    draftData?.items?.length
      ? draftData.items
      : [{
          description: ledgerData?.concept || "",
          quantity: 1,
          unitPrice: ledgerData?.amount || 0,
          productCode: "85121800",
          unitCode: "E48",
          withIva: false,
          withIsrRetention: false,
        }]
  );
  const [paymentForm, setPaymentForm] = useState(
    draftData?.paymentForm ||
    (ledgerData?.formaDePago && LEDGER_TO_SAT_FORMA[ledgerData.formaDePago]) || "03"
  ); // Transferencia default
  const [paymentMethod, setPaymentMethod] = useState(draftData?.paymentMethod || "PUE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catalogs
  const [usosCfdi, setUsosCfdi] = useState<CatalogItem[]>([]);
  const [formasPago, setFormasPago] = useState<CatalogItem[]>([]);
  const [regimenes, setRegimenes] = useState<CatalogItem[]>([]);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_URL}/api/facturacion/catalogos/uso-cfdi`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/formas-pago`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/regimenes-fiscales`).then(r => r.json()),
    ]).then(([usos, formas, regs]) => {
      const u = Array.isArray(usos.data) ? usos.data : [];
      const f = Array.isArray(formas.data) ? formas.data : [];
      const r = Array.isArray(regs.data) ? regs.data : [];
      setUsosCfdi(u.length > 0 ? u : OFFLINE_USOS_CFDI);
      setFormasPago(f.length > 0 ? f : OFFLINE_FORMAS_PAGO);
      setRegimenes(r.length > 0 ? r : OFFLINE_REGIMENES);
    }).catch(() => {
      setUsosCfdi(OFFLINE_USOS_CFDI);
      setFormasPago(OFFLINE_FORMAS_PAGO);
      setRegimenes(OFFLINE_REGIMENES);
    });
  }, []);

  // Tax rates default by law, but user can override for edge cases
  const DEFAULT_IVA_RATE = 0.16;
  const defaultIsrRate = profile.regimenFiscal === '626' ? 0.0125 : 0.10;

  const [ivaRate, setIvaRate] = useState(DEFAULT_IVA_RATE);
  const [isrRetentionRate, setIsrRetentionRate] = useState(defaultIsrRate);

  const formatRateLabel = (rate: number) => {
    const pct = rate * 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
  };
  const ivaLabel = formatRateLabel(ivaRate);
  const isrRetentionLabel = formatRateLabel(isrRetentionRate);
  const ivaRateIsCustom = Math.abs(ivaRate - DEFAULT_IVA_RATE) > 0.0001;
  const isrRateIsCustom = Math.abs(isrRetentionRate - defaultIsrRate) > 0.0001;

  // Sync ISR rate when profile régimen changes (e.g. user updates fiscal config)
  useEffect(() => {
    setIsrRetentionRate(profile.regimenFiscal === '626' ? 0.0125 : 0.10);
  }, [profile.regimenFiscal]);

  // Detect if receiver is persona física (13-char RFC, 4 letters + 6 digits + 3 alphanum)
  // vs persona moral (12 chars, 3 letters + 6 digits + 3 alphanum)
  const isReceiverPF = receiver.rfc.length === 13 && /^[A-Z]{4}/.test(receiver.rfc);
  const isReceiverPublicoGeneral = receiver.rfc === 'XAXX010101000';
  const isMedicalService = items.some(i => i.productCode.startsWith('8512'));

  // F2c follow-up #2: inline SAT product-code search per concept (the agent's
  // prompt has always pointed doctors here — this makes that claim true).
  // The search is LITERAL and accent-sensitive (Facturama) — the placeholder
  // says so. One open search at a time.
  const [claveSearchIdx, setClaveSearchIdx] = useState<number | null>(null);
  const [claveQuery, setClaveQuery] = useState("");
  const [claveResults, setClaveResults] = useState<CatalogItem[]>([]);
  const [claveSearching, setClaveSearching] = useState(false);
  // null = no error; a service failure must NOT render as "sin resultados"
  // (the productos search has no offline fallback — review finding).
  const [claveError, setClaveError] = useState<string | null>(null);
  const searchClave = async () => {
    const q = claveQuery.trim();
    if (q.length < 3) return;
    setClaveSearching(true);
    setClaveError(null);
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/catalogos/productos?q=${encodeURIComponent(q)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.data)) {
        setClaveResults([]);
        setClaveError("El catálogo no está disponible en este momento — captura la clave a mano o reintenta.");
        return;
      }
      setClaveResults(body.data.slice(0, 8));
    } catch {
      setClaveResults([]);
      setClaveError("El catálogo no está disponible (error de red) — captura la clave a mano o reintenta.");
    } finally {
      setClaveSearching(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      productCode: "85121800",
      unitCode: "E48",
      withIva: false,
      withIsrRetention: false,
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let iva = 0;
    let isrRetention = 0;

    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;
      if (item.withIva) iva += itemSubtotal * ivaRate;
      if (item.withIsrRetention) isrRetention += itemSubtotal * isrRetentionRate;
    }

    return { subtotal, iva, isrRetention, total: subtotal + iva - isrRetention };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      // Build items with taxes
      const cfdiItems = items.map(item => {
        const itemSubtotal = item.quantity * item.unitPrice;
        const taxes: any[] = [];

        if (item.withIva) {
          taxes.push({
            Total: Math.round(itemSubtotal * ivaRate * 100) / 100,
            Name: "IVA",
            Base: itemSubtotal,
            Rate: ivaRate,
            IsRetention: false,
          });
        }

        if (item.withIsrRetention) {
          taxes.push({
            Total: Math.round(itemSubtotal * isrRetentionRate * 100) / 100,
            Name: "ISR",
            Base: itemSubtotal,
            Rate: isrRetentionRate,
            IsRetention: true,
          });
        }

        const total = itemSubtotal
          + (item.withIva ? itemSubtotal * ivaRate : 0)
          - (item.withIsrRetention ? itemSubtotal * isrRetentionRate : 0);

        return {
          productCode: item.productCode,
          description: item.description,
          quantity: item.quantity,
          unitCode: item.unitCode,
          unitPrice: item.unitPrice,
          subtotal: itemSubtotal,
          taxes,
          total: Math.round(total * 100) / 100,
        };
      });

      const payload: any = {
        receiver,
        items: cfdiItems,
        cfdiType: "I",
        paymentForm,
        paymentMethod,
      };
      if (draftData) {
        // F2c: link the income and close the draft on success (server-side).
        if (draftData.ledgerEntryId) payload.ledgerEntryId = draftData.ledgerEntryId;
        payload.draftId = draftData.id;
      } else if (ledgerData?.ledgerEntryId) {
        payload.ledgerEntryId = ledgerData.ledgerEntryId;
      }

      const res = await authFetch(`${API_URL}/api/facturacion/cfdi`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error: msg, details } = await res.json();
        throw new Error(msg || "Error al emitir factura");
      }

      const { data } = await res.json();
      alert(`Factura emitida exitosamente!\nUUID: ${data.uuid}`);
      onCreated();
    } catch (err: any) {
      // F2c follow-up #4: the SAT's raw errors are cryptic — translate the
      // frequent ones into actionable hints (CP-vs-constancia was hit live).
      let msg: string = err.message || "Error al emitir factura";
      if (/DomicilioFiscalReceptor/i.test(msg)) {
        msg += " — 💡 El Código Postal del receptor debe ser EXACTAMENTE el de su constancia de situación fiscal (no el de su casa/consultorio). Corrígelo arriba y vuelve a emitir.";
      } else if (/RegimenFiscalReceptor|UsoCFDI/i.test(msg)) {
        msg += " — 💡 Verifica que el régimen y el uso CFDI del receptor coincidan con su constancia (y que el uso sea válido para ese régimen: p. ej. D01 no aplica para RESICO 626).";
      } else if (/nombre.*receptor|Name/i.test(msg) && /coincide|inscrito|l_RFC/i.test(msg)) {
        msg += " — 💡 El nombre debe ser EXACTO al de la constancia (sin régimen de capital, respetando acentos).";
      }
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* F2c: draft context — surfaced BEFORE submit (the 409 is the net) */}
      {draftError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {draftError} — el formulario está vacío; puedes capturar la factura a mano.
        </div>
      )}
      {draftData && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1">
          <div>
            📝 Borrador #{draftData.id}{draftData.paciente ? ` · ${draftData.paciente.nombre}` : ""}
            {draftData.ingreso ? ` · ingreso #${draftData.ingreso.id} ($${draftData.ingreso.amount})` : ""}
            {" — revisa, edita lo que haga falta y emite."}
          </div>
          {draftData.status !== "draft" && (
            <div className="text-red-700 font-medium">⚠️ Este borrador ya está {draftData.status === "emitted" ? "EMITIDO" : "descartado"} — emitirlo de nuevo duplicaría la factura.</div>
          )}
          {draftData.ingreso?.hasFactura && (
            <div className="text-red-700 font-medium">⚠️ El ingreso ligado YA tiene factura — el sistema rechazará la emisión (409).</div>
          )}
          {draftData.camposFaltantes.length > 0 && (
            <div className="text-amber-800">⚠️ El expediente ya no tiene datos fiscales completos (faltan: {draftData.camposFaltantes.join(", ")}) — completa el receptor a mano o manda el formulario fiscal.</div>
          )}
          {draftData.usoIncompatible && (
            <div className="text-red-700 font-medium">⚠️ El uso CFDI del expediente NO es válido para el régimen del receptor — el SAT rechazará el timbrado: cámbialo abajo (p. ej. G03) antes de emitir.</div>
          )}
          {draftData.esPublicoGeneral && (
            <div>Receptor: PÚBLICO EN GENERAL (S01) — el paciente no podrá deducirla.</div>
          )}
        </div>
      )}
      {/* Receiver */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Receptor</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RFC Receptor</label>
            <input
              type="text"
              value={receiver.rfc}
              onChange={e => {
                const rfc = e.target.value.toUpperCase();
                if (rfc === 'XAXX010101000') {
                  setReceiver({ ...receiver, rfc, name: 'PUBLICO EN GENERAL', cfdiUse: 'S01', fiscalRegime: '616', taxZipCode: receiver.taxZipCode || '' });
                } else {
                  setReceiver({ ...receiver, rfc });
                }
              }}
              placeholder="XAXX010101000"
              maxLength={13}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
            <input
              type="text"
              value={receiver.name}
              onChange={e => setReceiver({ ...receiver, name: e.target.value })}
              placeholder="Nombre del paciente o empresa"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
            <select
              value={receiver.fiscalRegime}
              onChange={e => setReceiver({ ...receiver, fiscalRegime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Seleccionar...</option>
              {regimenes.map(r => (
                <option key={r.Value} value={r.Value}>{r.Value} - {r.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal Fiscal</label>
            <input
              type="text"
              value={receiver.taxZipCode}
              onChange={e => setReceiver({ ...receiver, taxZipCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder="06600"
              maxLength={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uso del CFDI</label>
            <select
              value={receiver.cfdiUse}
              onChange={e => setReceiver({ ...receiver, cfdiUse: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {usosCfdi.map(u => (
                <option key={u.Value} value={u.Value}>{u.Value} - {u.Name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Conceptos</h3>
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Agregar concepto
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-md border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, "description", e.target.value)}
                    placeholder="Consulta médica general"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unitario</label>
                  <input
                    type="number"
                    value={item.unitPrice || ""}
                    onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* SAT keys (F2c follow-up #2: drafts hydrate productCode/unitCode —
                  they must be visible and editable, not silently submitted) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Clave Prod/Serv (SAT)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={item.productCode}
                      onChange={e => updateItem(idx, "productCode", e.target.value.trim())}
                      placeholder="85121800"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setClaveSearchIdx(claveSearchIdx === idx ? null : idx);
                        setClaveQuery("");
                        setClaveResults([]);
                        setClaveError(null);
                      }}
                      className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                      title="Buscar en el catálogo SAT"
                    >
                      Buscar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Clave Unidad</label>
                  <input
                    type="text"
                    value={item.unitCode}
                    onChange={e => updateItem(idx, "unitCode", e.target.value.trim().toUpperCase())}
                    placeholder="E48"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              {claveSearchIdx === idx && (
                <div className="mt-2 p-3 rounded-md border border-blue-200 bg-blue-50 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={claveQuery}
                      onChange={e => setClaveQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchClave(); } }}
                      placeholder='Búsqueda literal — mejor "gasas" o "suturas" que "insumos" (mín. 3 letras)'
                      className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchClave}
                      disabled={claveSearching || claveQuery.trim().length < 3}
                      className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white disabled:opacity-50"
                    >
                      {claveSearching ? '…' : 'Buscar'}
                    </button>
                  </div>
                  {claveResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-blue-100">
                      {claveResults.map((r) => (
                        <button
                          key={r.Value}
                          type="button"
                          onClick={() => {
                            updateItem(idx, "productCode", r.Value);
                            setClaveSearchIdx(null);
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-100 rounded"
                        >
                          <span className="font-mono font-semibold">{r.Value}</span> — {r.Name}
                        </button>
                      ))}
                    </div>
                  )}
                  {claveError && (
                    <p className="text-xs text-red-700">{claveError}</p>
                  )}
                  {!claveSearching && !claveError && claveQuery.trim().length >= 3 && claveResults.length === 0 && (
                    <p className="text-xs text-blue-800">Sin resultados — la búsqueda es literal: intenta el nombre exacto del producto/servicio.</p>
                  )}
                </div>
              )}

              {/* Tax toggles */}
              <div className="flex flex-wrap gap-4 mt-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.withIva}
                    onChange={e => updateItem(idx, "withIva", e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  IVA
                </label>
                {item.withIva && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={parseFloat((ivaRate * 100).toFixed(4))}
                      onChange={e => {
                        const pct = parseFloat(e.target.value);
                        if (!isNaN(pct) && pct >= 0 && pct <= 100) setIvaRate(pct / 100);
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">%</span>
                    {ivaRateIsCustom && (
                      <button
                        type="button"
                        onClick={() => setIvaRate(DEFAULT_IVA_RATE)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                        title="Restaurar tasa por defecto: 16%"
                      >
                        restaurar
                      </button>
                    )}
                  </div>
                )}
                {item.withIva && isReceiverPF && isMedicalService && !isReceiverPublicoGeneral && (
                  <span className="text-xs text-amber-600">
                    Servicios médicos a PF suelen ser exentos de IVA (Art. 15 LIVA)
                  </span>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.withIsrRetention}
                    onChange={e => updateItem(idx, "withIsrRetention", e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Retención ISR
                </label>
                {item.withIsrRetention && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={parseFloat((isrRetentionRate * 100).toFixed(4))}
                      onChange={e => {
                        const pct = parseFloat(e.target.value);
                        if (!isNaN(pct) && pct >= 0 && pct <= 100) setIsrRetentionRate(pct / 100);
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">%</span>
                    {isrRateIsCustom && (
                      <button
                        type="button"
                        onClick={() => setIsrRetentionRate(defaultIsrRate)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                        title={`Restaurar tasa por defecto: ${(defaultIsrRate * 100)}%`}
                      >
                        restaurar
                      </button>
                    )}
                  </div>
                )}
                {item.withIsrRetention && isReceiverPF && !isReceiverPublicoGeneral && (
                  <span className="text-xs text-amber-600">
                    Personas físicas generalmente no retienen ISR
                  </span>
                )}
              </div>

              <div className="text-right text-sm text-gray-500 mt-2">
                Subtotal: ${(item.quantity * item.unitPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Método de Pago</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
            <select
              value={paymentForm}
              onChange={e => setPaymentForm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {formasPago.map(f => (
                <option key={f.Value} value={f.Value}>{f.Value} - {f.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="PUE">PUE - Pago en una sola exhibición</option>
              <option value="PPD">PPD - Pago en parcialidades o diferido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-8">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">${totals.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
          {totals.iva > 0 && (
            <div>
              <div className="flex gap-8">
                <span className="text-gray-600">IVA {ivaLabel}:</span>
                <span className="font-medium">${totals.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              {ivaRateIsCustom && (
                <p className="text-xs text-amber-600 text-right mt-0.5">
                  Tasa modificada (por defecto: 16%)
                </p>
              )}
            </div>
          )}
          {totals.isrRetention > 0 && (
            <div>
              <div className="flex gap-8">
                <span className="text-gray-600">Retención ISR {isrRetentionLabel}:</span>
                <span className="font-medium text-red-600">-${totals.isrRetention.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              {isrRateIsCustom && (
                <p className="text-xs text-amber-600 text-right mt-0.5">
                  Tasa modificada (por defecto para régimen {profile.regimenFiscal}: {(defaultIsrRate * 100)}%)
                </p>
              )}
            </div>
          )}
          <div className="flex gap-8 pt-2 border-t border-gray-200 mt-1">
            <span className="text-gray-900 font-semibold">Total:</span>
            <span className="text-lg font-bold text-blue-700">${totals.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-md border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={creating || items.every(i => !i.description || i.unitPrice <= 0)}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
        Emitir Factura (CFDI)
      </button>

      <p className="text-xs text-gray-400 text-center">
        Al emitir, se timbra el CFDI ante el SAT. Esta acción no se puede deshacer (solo cancelar).
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// REP TAB (Recibo Electrónico de Pago)
// ---------------------------------------------------------------------------

function REPTab({
  onCreated
}: {
  onCreated: () => void;
}) {
  const [ppdInvoices, setPpdInvoices] = useState<CfdiEmitted[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<CfdiEmitted | null>(null);

  const [receiver, setReceiver] = useState({
    rfc: "",
    name: "",
    fiscalRegime: "",
    taxZipCode: "",
  });

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentForm, setPaymentForm] = useState("03");
  const [amount, setAmount] = useState(0);
  const [partialityNumber, setPartialityNumber] = useState(1);
  const [previousBalance, setPreviousBalance] = useState(0);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formasPago, setFormasPago] = useState<CatalogItem[]>([]);
  const [regimenes, setRegimenes] = useState<CatalogItem[]>([]);

  useEffect(() => {
    // Fetch PPD invoices and catalogs in parallel
    Promise.all([
      authFetch(`${API_URL}/api/facturacion/cfdi?status=active&limit=100`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/formas-pago`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/regimenes-fiscales`).then(r => r.json()),
    ]).then(([invoices, formas, regs]) => {
      const invoiceList = Array.isArray(invoices.data) ? invoices.data : [];
      const ppd = invoiceList.filter((f: CfdiEmitted) => f.cfdiType === "I" && f.metodoPago === "PPD");
      setPpdInvoices(ppd);
      const f = Array.isArray(formas.data) ? formas.data : [];
      const r = Array.isArray(regs.data) ? regs.data : [];
      setFormasPago(f.length > 0 ? f : OFFLINE_FORMAS_PAGO);
      setRegimenes(r.length > 0 ? r : OFFLINE_REGIMENES);
    }).catch(() => {
      setFormasPago(OFFLINE_FORMAS_PAGO);
      setRegimenes(OFFLINE_REGIMENES);
    }).finally(() => setLoadingInvoices(false));
  }, []);

  const handleSelectInvoice = (uuid: string) => {
    const inv = ppdInvoices.find(f => f.uuid === uuid);
    if (inv) {
      setSelectedInvoice(inv);
      setReceiver({
        rfc: inv.rfcReceptor,
        name: inv.nombreReceptor,
        fiscalRegime: "",
        taxZipCode: "",
      });
      const total = parseFloat(inv.total);
      setPreviousBalance(total);
      setAmount(total);
    }
  };

  const remainingBalance = Math.max(0, previousBalance - amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setCreating(true);
    setError(null);

    try {
      const payload = {
        receiver,
        payment: {
          date: paymentDate,
          paymentForm,
          amount,
          currency: "MXN",
          relatedDocuments: [{
            uuid: selectedInvoice.uuid,
            folio: selectedInvoice.folio || undefined,
            partialityNumber,
            previousBalanceAmount: previousBalance,
            amountPaid: amount,
            impSaldoInsoluto: remainingBalance,
          }],
        },
      };

      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/rep`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al emitir REP");
      }

      const { data } = await res.json();
      alert(`REP emitido exitosamente!\nUUID: ${data.uuid}`);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loadingInvoices) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (ppdInvoices.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No tienes facturas con método PPD (pago diferido)</p>
        <p className="text-sm text-gray-400 mt-1">
          Primero emite una factura con método de pago PPD para poder crear un REP.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Select invoice */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Factura Original (PPD)</h3>
        <p className="text-sm text-gray-500 mb-3">
          Selecciona la factura PPD a la que corresponde este pago.
        </p>
        <select
          value={selectedInvoice?.uuid || ""}
          onChange={e => handleSelectInvoice(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Seleccionar factura...</option>
          {ppdInvoices.map(f => (
            <option key={f.uuid} value={f.uuid}>
              {f.folio ? `Folio ${f.folio} — ` : ""}{f.nombreReceptor} ({f.rfcReceptor}) — ${parseFloat(f.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })} — {new Date(f.issuedAt).toLocaleDateString("es-MX")}
            </option>
          ))}
        </select>
      </div>

      {selectedInvoice && (
        <>
          {/* Receiver */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Receptor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                <input
                  type="text"
                  value={receiver.rfc}
                  onChange={e => setReceiver({ ...receiver, rfc: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  value={receiver.name}
                  onChange={e => setReceiver({ ...receiver, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
                <select
                  value={receiver.fiscalRegime}
                  onChange={e => setReceiver({ ...receiver, fiscalRegime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {regimenes.map(r => (
                    <option key={r.Value} value={r.Value}>{r.Value} - {r.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal Fiscal</label>
                <input
                  type="text"
                  value={receiver.taxZipCode}
                  onChange={e => setReceiver({ ...receiver, taxZipCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  placeholder="06600"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
                <select
                  value={paymentForm}
                  onChange={e => setPaymentForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {formasPago.map(f => (
                    <option key={f.Value} value={f.Value}>{f.Value} - {f.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Pagado</label>
                <input
                  type="number"
                  value={amount || ""}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  min={0.01}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Parcialidad</label>
                <input
                  type="number"
                  value={partialityNumber}
                  onChange={e => setPartialityNumber(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Balance summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-100">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Saldo Anterior</label>
                  <input
                    type="number"
                    value={previousBalance || ""}
                    onChange={e => setPreviousBalance(parseFloat(e.target.value) || 0)}
                    min={0}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Monto Pagado</label>
                  <div className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium">
                    ${amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Saldo Pendiente</label>
                  <div className={`px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium ${remainingBalance === 0 ? "text-green-600" : "text-amber-600"}`}>
                    ${remainingBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-md border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={creating || amount <= 0}
            className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            Emitir REP (Recibo de Pago)
          </button>

          <p className="text-xs text-gray-400 text-center">
            Se timbra un CFDI tipo Pago ante el SAT vinculado a la factura original.
          </p>
        </>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// EGRESO TAB (Nota de Crédito)
// ---------------------------------------------------------------------------

function EgresoTab({
  onCreated
}: {
  onCreated: () => void;
}) {
  const [activeInvoices, setActiveInvoices] = useState<CfdiEmitted[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<CfdiEmitted | null>(null);

  const [receiver, setReceiver] = useState({
    rfc: "",
    name: "",
    fiscalRegime: "",
    taxZipCode: "",
  });

  const [items, setItems] = useState([{
    description: "",
    quantity: 1,
    unitPrice: 0,
    productCode: "85121800",
    unitCode: "E48",
    withIva: false,
  }]);

  const [paymentForm, setPaymentForm] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_IVA = 0.16;
  const [egresoIvaRate, setEgresoIvaRate] = useState(DEFAULT_IVA);
  const formatRate = (rate: number) => {
    const pct = rate * 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
  };
  const egresoIvaLabel = formatRate(egresoIvaRate);
  const egresoIvaIsCustom = Math.abs(egresoIvaRate - DEFAULT_IVA) > 0.0001;

  const [formasPago, setFormasPago] = useState<CatalogItem[]>([]);
  const [regimenes, setRegimenes] = useState<CatalogItem[]>([]);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_URL}/api/facturacion/cfdi?status=active&limit=100`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/formas-pago`).then(r => r.json()),
      authFetch(`${API_URL}/api/facturacion/catalogos/regimenes-fiscales`).then(r => r.json()),
    ]).then(([invoices, formas, regs]) => {
      const invoiceList = Array.isArray(invoices.data) ? invoices.data : [];
      const ingreso = invoiceList.filter((f: CfdiEmitted) => f.cfdiType === "I");
      setActiveInvoices(ingreso);
      const f = Array.isArray(formas.data) ? formas.data : [];
      const r = Array.isArray(regs.data) ? regs.data : [];
      setFormasPago(f.length > 0 ? f : OFFLINE_FORMAS_PAGO);
      setRegimenes(r.length > 0 ? r : OFFLINE_REGIMENES);
    }).catch(() => {
      setFormasPago(OFFLINE_FORMAS_PAGO);
      setRegimenes(OFFLINE_REGIMENES);
    }).finally(() => setLoadingInvoices(false));
  }, []);

  const handleSelectInvoice = (uuid: string) => {
    const inv = activeInvoices.find(f => f.uuid === uuid);
    if (inv) {
      setSelectedInvoice(inv);
      setReceiver({
        rfc: inv.rfcReceptor,
        name: inv.nombreReceptor,
        fiscalRegime: "",
        taxZipCode: "",
      });
      setPaymentForm(inv.formaPago || "99");
      // Pre-fill item with original total for full credit note
      setItems([{
        description: "Nota de crédito",
        quantity: 1,
        unitPrice: parseFloat(inv.total),
        productCode: "85121800",
        unitCode: "E48",
        withIva: false,
      }]);
    }
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems([...items, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      productCode: "85121800",
      unitCode: "E48",
      withIva: false,
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let iva = 0;
    for (const item of items) {
      const s = item.quantity * item.unitPrice;
      subtotal += s;
      if (item.withIva) iva += s * egresoIvaRate;
    }
    return { subtotal, iva, total: subtotal + iva };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setCreating(true);
    setError(null);

    try {
      const cfdiItems = items.map(item => {
        const itemSubtotal = item.quantity * item.unitPrice;
        const taxes: any[] = [];
        if (item.withIva) {
          taxes.push({
            Total: Math.round(itemSubtotal * egresoIvaRate * 100) / 100,
            Name: "IVA",
            Base: itemSubtotal,
            Rate: egresoIvaRate,
            IsRetention: false,
          });
        }
        const total = itemSubtotal + (item.withIva ? itemSubtotal * egresoIvaRate : 0);
        return {
          productCode: item.productCode,
          description: item.description,
          quantity: item.quantity,
          unitCode: item.unitCode,
          unitPrice: item.unitPrice,
          subtotal: itemSubtotal,
          taxes,
          total: Math.round(total * 100) / 100,
        };
      });

      const payload = {
        receiver,
        items: cfdiItems,
        originalUuid: selectedInvoice.uuid,
        paymentForm: paymentForm || undefined,
      };

      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/egreso`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || "Error al emitir nota de crédito");
      }

      const { data } = await res.json();
      alert(`Nota de crédito emitida exitosamente!\nUUID: ${data.uuid}`);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const totals = calculateTotal();

  if (loadingInvoices) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (activeInvoices.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <MinusCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No tienes facturas de ingreso activas</p>
        <p className="text-sm text-gray-400 mt-1">
          Primero emite una factura de ingreso para poder crear una nota de crédito.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Select original invoice */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Factura Original</h3>
        <p className="text-sm text-gray-500 mb-3">
          Selecciona la factura a la que aplicarás la nota de crédito (devolución, descuento o bonificación).
        </p>
        <select
          value={selectedInvoice?.uuid || ""}
          onChange={e => handleSelectInvoice(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Seleccionar factura...</option>
          {activeInvoices.map(f => (
            <option key={f.uuid} value={f.uuid}>
              {f.folio ? `Folio ${f.folio} — ` : ""}{f.nombreReceptor} ({f.rfcReceptor}) — ${parseFloat(f.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })} — {new Date(f.issuedAt).toLocaleDateString("es-MX")}
            </option>
          ))}
        </select>
      </div>

      {selectedInvoice && (
        <>
          {/* Receiver */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Receptor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                <input
                  type="text"
                  value={receiver.rfc}
                  onChange={e => setReceiver({ ...receiver, rfc: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  value={receiver.name}
                  onChange={e => setReceiver({ ...receiver, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Fiscal</label>
                <select
                  value={receiver.fiscalRegime}
                  onChange={e => setReceiver({ ...receiver, fiscalRegime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {regimenes.map(r => (
                    <option key={r.Value} value={r.Value}>{r.Value} - {r.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal Fiscal</label>
                <input
                  type="text"
                  value={receiver.taxZipCode}
                  onChange={e => setReceiver({ ...receiver, taxZipCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  placeholder="06600"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Uso del CFDI: G02 (Devoluciones, descuentos o bonificaciones) — se asigna automáticamente.
            </p>
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Conceptos a Acreditar</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar concepto
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Total de la factura original: ${parseFloat(selectedInvoice.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-md border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(idx, "description", e.target.value)}
                        placeholder="Nota de crédito por devolución"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                        min={1}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unitario</label>
                      <input
                        type="number"
                        value={item.unitPrice || ""}
                        onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.withIva}
                        onChange={e => updateItem(idx, "withIva", e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      IVA
                    </label>
                    {item.withIva && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={parseFloat((egresoIvaRate * 100).toFixed(4))}
                          onChange={e => {
                            const pct = parseFloat(e.target.value);
                            if (!isNaN(pct) && pct >= 0 && pct <= 100) setEgresoIvaRate(pct / 100);
                          }}
                          className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-500">%</span>
                        {egresoIvaIsCustom && (
                          <button
                            type="button"
                            onClick={() => setEgresoIvaRate(DEFAULT_IVA)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                            title="Restaurar tasa por defecto: 16%"
                          >
                            restaurar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500 mt-2">
                    Subtotal: ${(item.quantity * item.unitPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pago</h3>
            <select
              value={paymentForm}
              onChange={e => setPaymentForm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {formasPago.map(f => (
                <option key={f.Value} value={f.Value}>{f.Value} - {f.Name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">Se hereda de la factura original. Puedes cambiarla si es necesario.</p>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-8">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${totals.subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
              {totals.iva > 0 && (
                <div>
                  <div className="flex gap-8">
                    <span className="text-gray-600">IVA {egresoIvaLabel}:</span>
                    <span className="font-medium">${totals.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {egresoIvaIsCustom && (
                    <p className="text-xs text-amber-600 text-right mt-0.5">
                      Tasa modificada (por defecto: 16%)
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-8 pt-2 border-t border-gray-200 mt-1">
                <span className="text-gray-900 font-semibold">Total Nota de Crédito:</span>
                <span className="text-lg font-bold text-orange-600">${totals.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-md border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={creating || items.every(i => !i.description || i.unitPrice <= 0)}
            className="w-full py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MinusCircle className="w-5 h-5" />}
            Emitir Nota de Crédito (CFDI Egreso)
          </button>

          <p className="text-xs text-gray-400 text-center">
            Se timbra un CFDI tipo Egreso vinculado a la factura original. Esta acción no se puede deshacer.
          </p>
        </>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// GUIA TAB
// ---------------------------------------------------------------------------

function GuiaSection({
  title, children, defaultOpen = false
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900">{title}</span>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4 space-y-3 text-sm text-gray-700">{children}</div>}
    </div>
  );
}

function GuiaTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-medium text-gray-600 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ⚠️ El asistente tiene un RESUMEN curado de esta guía (GUIAS.facturacion en
// lib/agenda-agent/modules/facturas.ts) — si cambias contenido aquí, actualízalo.
function GuiaTab() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
        <p className="text-sm text-blue-800">
          <strong>Referencia rápida</strong> para emitir facturas electrónicas (CFDI 4.0) desde TuSalud.
          Consulta con tu contador para casos específicos.
        </p>
      </div>

      <GuiaSection title="1. CFDI 4.0 — Datos obligatorios del receptor" defaultOpen>
        <p>Para emitir un CFDI válido necesitas estos datos de tu paciente:</p>
        <GuiaTable
          headers={["Dato", "Ejemplo", "Dónde obtenerlo"]}
          rows={[
            ["Nombre completo", "Juan Pérez López", "Constancia de Situación Fiscal"],
            ["RFC", "PELJ850101ABC", "13 caracteres (persona física)"],
            ["Régimen fiscal", "612", "Constancia de Situación Fiscal"],
            ["Código postal fiscal", "06600", "Domicilio fiscal (NO el de consulta)"],
          ]}
        />
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
          <strong>Importante:</strong> Los datos deben coincidir exactamente con los registrados ante el SAT.
          Si el nombre o RFC no coinciden, el timbrado será rechazado.
        </div>
      </GuiaSection>

      <GuiaSection title="2. Claves SAT para servicios médicos">
        <GuiaTable
          headers={["Servicio", "Clave SAT", "Unidad"]}
          rows={[
            ["Consulta médica general", "85121502", "E48 — Unidad de servicio"],
            ["Servicios médicos especializados", "85121800", "E48 — Unidad de servicio"],
            ["Servicios de psicología", "85121608", "E48 — Unidad de servicio"],
            ["Servicios de nutrición", "85121609", "E48 — Unidad de servicio"],
            ["Análisis clínicos y laboratorio", "85141600", "E48 — Unidad de servicio"],
            ["Medicamentos", "51101500 a 51251002", "Según presentación"],
            ["Material quirúrgico", "42311500", "Según presentación"],
          ]}
        />
        <p className="text-xs text-gray-500">
          En TuSalud, la clave por defecto es <strong>85121800</strong> y la unidad <strong>E48</strong>. Puedes cambiarlas al crear cada factura.
        </p>
      </GuiaSection>

      <GuiaSection title="3. Uso del CFDI — Códigos comunes">
        <GuiaTable
          headers={["Clave", "Descripción", "Cuándo usarla"]}
          rows={[
            ["D01", "Honorarios médicos, dentales y gastos hospitalarios", "Pacientes que deducen gastos médicos (el más común)"],
            ["D02", "Gastos médicos por incapacidad o discapacidad", "Pacientes con condición de discapacidad"],
            ["G03", "Gastos en general", "Empresas que pagan servicios médicos"],
            ["S01", "Sin efectos fiscales", "Cuando el receptor no deducirá la factura"],
            ["CP01", "Pagos", "Para Recibos Electrónicos de Pago (REP)"],
          ]}
        />
      </GuiaSection>

      <GuiaSection title="4. Requisitos para facturas deducibles (D01)">
        <p>Para que tu paciente pueda deducir la factura en su declaración anual:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Uso de CFDI debe ser <strong>D01</strong> o <strong>D02</strong></li>
          <li>RFC del paciente escrito correctamente (13 caracteres, sin espacios)</li>
          <li>Clave de producto/servicio debe ser una clave médica válida</li>
          <li>Forma de pago registrada correctamente</li>
          <li><strong>Pagos en efectivo mayores a $2,000 MXN no son deducibles</strong> — el paciente debe pagar con tarjeta o transferencia</li>
        </ul>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs">
          <strong>Límite de deducción para el paciente:</strong> El menor entre 5 veces la UMA anual o 15% de sus ingresos anuales.
        </div>
      </GuiaSection>

      <GuiaSection title="5. Tu régimen fiscal y cómo afecta tu facturación">
        <p>Como médico persona física, solo puedes emitir facturas por servicios profesionales bajo uno de estos dos regímenes:</p>
        <GuiaTable
          headers={["Clave", "Régimen", "ISR", "Deducciones", "Retención ISR (PM)"]}
          rows={[
            ["612", "Actividad Empresarial y Profesional", "Progresiva (1.92% a 35%) sobre ingresos − deducciones", "Sí — todos los gastos de negocio", "10% del subtotal"],
            ["626", "RESICO (Simplificado de Confianza)", "Fija (1% a 2.5%) sobre ingresos brutos", "No — ISR sobre ingresos brutos", "1.25% del subtotal"],
          ]}
        />
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mt-2">
          <strong>Diferencias clave de RESICO:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Retención ISR al facturar a persona moral: <strong>1.25%</strong> (no 10%). TuSalud aplica la tasa correcta según tu perfil.</li>
            <li>Límite de ingresos: <strong>$3,500,000 MXN/año</strong>. Si lo rebasas, el SAT te migra a 612 automáticamente.</li>
            <li><strong>No puedes deducir gastos</strong> para ISR — tu impuesto es un porcentaje fijo sobre ingresos brutos.</li>
            <li>Sí puedes <strong>acreditar IVA</strong> (restar el IVA que pagas en compras del IVA que cobras) — funciona igual que en 612.</li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 mt-2">
          <strong>Otros regímenes</strong> como 605 (Sueldos), 606 (Arrendamiento), o 621 (Incorporación Fiscal, descontinuado) no aplican para facturar servicios médicos.
          Si eres empleado de hospital (605) y además tienes consultorio privado, facturas bajo 612 o 626.
        </div>
      </GuiaSection>

      <GuiaSection title="6. Formas y métodos de pago">
        <h4 className="font-medium text-gray-900 mb-2">Forma de pago (cómo pagó el paciente)</h4>
        <GuiaTable
          headers={["Clave", "Descripción"]}
          rows={[
            ["01", "Efectivo"],
            ["02", "Cheque nominativo"],
            ["03", "Transferencia electrónica de fondos"],
            ["04", "Tarjeta de crédito"],
            ["28", "Tarjeta de débito"],
            ["99", "Por definir (usar con método PPD)"],
          ]}
        />
        <h4 className="font-medium text-gray-900 mt-4 mb-2">Método de pago</h4>
        <GuiaTable
          headers={["Clave", "Descripción", "Cuándo usarlo"]}
          rows={[
            ["PUE", "Pago en una sola exhibición", "El paciente paga en el momento de la consulta"],
            ["PPD", "Pago en parcialidades o diferido", "El paciente pagará después o en partes"],
          ]}
        />
      </GuiaSection>

      <GuiaSection title="7. Facturación a aseguradoras">
        <p>Cuando un paciente usa seguro médico, se requieren <strong>dos facturas separadas</strong>:</p>
        <ol className="list-decimal list-inside space-y-1 ml-1">
          <li><strong>Factura a la aseguradora</strong> — por el monto cubierto por el seguro</li>
          <li><strong>Factura al paciente</strong> — por el copago o deducible que paga directamente</li>
        </ol>
        <p className="text-xs text-gray-500 mt-2">
          Cada aseguradora tiene requisitos y tiempos de pago específicos. No se puede emitir una sola factura por el total a ambas partes.
        </p>
      </GuiaSection>

      <GuiaSection title="8. Recibo Electrónico de Pago (REP)">
        <p>Cuando emites una factura con método <strong>PPD</strong> (pago diferido o parcialidades), debes emitir un REP cada vez que recibas un pago:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>El REP vincula cada pago con la factura original</li>
          <li>Es obligatorio para liquidar correctamente la factura ante el SAT</li>
          <li>Usa el uso de CFDI <strong>CP01</strong> (Pagos)</li>
        </ul>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs mt-2">
          <strong>Ejemplo:</strong> Emites factura por $10,000 con método PPD. El paciente paga $5,000 hoy y $5,000 en 30 días. Debes emitir un REP por cada pago de $5,000.
        </div>
      </GuiaSection>

      <GuiaSection title="9. Cancelación de CFDIs">
        <p>Si necesitas cancelar una factura, debes indicar un motivo al SAT:</p>
        <GuiaTable
          headers={["Clave", "Motivo", "Cuándo usarlo"]}
          rows={[
            ["01", "Comprobante emitido con errores con relación", "Vas a emitir una factura corregida que sustituye esta"],
            ["02", "Comprobante emitido con errores sin relación", "Error en la factura, no habrá sustitución"],
            ["03", "No se llevó a cabo la operación", "La consulta o servicio no se realizó"],
            ["04", "Operación nominativa relacionada en factura global", "Casos de factura global"],
          ]}
        />
        <p className="text-xs text-gray-500 mt-2">
          El motivo <strong>01</strong> requiere el UUID de la factura que sustituye a la cancelada.
        </p>
      </GuiaSection>

      <GuiaSection title="10. Retención de ISR e IVA">
        <h4 className="font-medium text-gray-900 mb-2">Retención de ISR</h4>
        <p>
          Si tu paciente es <strong>persona moral</strong> (empresa, hospital, aseguradora), está obligada a retenerte ISR.
          La tasa depende de tu régimen fiscal:
        </p>
        <GuiaTable
          headers={["Tu régimen", "Retención ISR", "Retención IVA", "Ejemplo sobre $10,000"]}
          rows={[
            ["612 (Act. Empresarial)", "10% del subtotal", "2/3 del IVA (10.67%)", "ISR: $1,000 + IVA ret: $1,067 = cobras $9,533"],
            ["626 (RESICO)", "1.25% del subtotal", "2/3 del IVA (10.67%)", "ISR: $125 + IVA ret: $1,067 = cobras $10,408"],
          ]}
        />
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mt-2">
          <strong>Importante:</strong> Las retenciones solo aplican cuando facturas servicios profesionales a <strong>persona moral</strong>.
          Si facturas a otra persona física (pacientes), no hay retención. Si vendes productos (bienes), tampoco hay retención.
        </div>
        <h4 className="font-medium text-gray-900 mt-4 mb-2">IVA en servicios médicos</h4>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Consultas médicas a persona física</strong> — <strong>exentas de IVA</strong> (Art. 15 fracción XIV LIVA)</li>
          <li><strong>Consultas médicas a persona moral</strong> — <strong>16% IVA</strong> (la persona moral puede acreditarlo)</li>
          <li><strong>Procedimientos estéticos</strong> — 16% IVA siempre (no son servicios médicos para efectos de IVA)</li>
          <li><strong>Venta de medicamentos</strong> — 0% si son de patente, 16% si son suplementos o cosméticos</li>
        </ul>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-800 mt-2">
          <strong>Error común:</strong> Cobrar IVA en consultas médicas a pacientes (personas físicas). Los servicios médicos a PF son exentos — no debes trasladar IVA.
        </div>
      </GuiaSection>

      <GuiaSection title="11. Errores comunes al facturar">
        <ul className="list-disc list-inside space-y-2 ml-1">
          <li><strong>Usar retención ISR de 10% en RESICO</strong> — Si estás en régimen 626, la retención correcta es 1.25%. Verifica tu régimen en Configuración.</li>
          <li><strong>Cobrar IVA a pacientes (PF) por consultas</strong> — Los servicios médicos a personas físicas están exentos de IVA.</li>
          <li><strong>No emitir REP para facturas PPD</strong> — Si usaste método PPD y ya te pagaron, debes emitir un Recibo Electrónico de Pago. El SAT puede multarte.</li>
          <li><strong>Datos del receptor incorrectos</strong> — Nombre, RFC, régimen fiscal y CP deben coincidir exactamente con la Constancia de Situación Fiscal del paciente.</li>
          <li><strong>Paciente paga en efectivo más de $2,000</strong> — El gasto no será deducible para el paciente. Recomiéndale pagar con tarjeta o transferencia.</li>
          <li><strong>No cancelar facturas erróneas a tiempo</strong> — Facturas con errores deben cancelarse lo antes posible. Después de declarar, requieren declaración complementaria.</li>
        </ul>
      </GuiaSection>

      <GuiaSection title="12. Configuración de sellos digitales (CSD)">
        <p>Para emitir facturas necesitas subir tus archivos CSD del SAT:</p>
        <GuiaTable
          headers={["Archivo", "Dónde obtenerlo"]}
          rows={[
            ["RFC", "Constancia de Situación Fiscal (SAT)"],
            ["Razón social", "Constancia de Situación Fiscal (SAT)"],
            ["Régimen fiscal", "Constancia de Situación Fiscal (SAT)"],
            ["Código postal fiscal", "Constancia de Situación Fiscal (SAT)"],
            ["Archivos CSD (.cer y .key)", "Portal del SAT > Certifix > Certificados de Sello Digital"],
            ["Contraseña del .key", "La que creaste al generar el CSD"],
          ]}
        />
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs mt-2">
          <strong>Pasos para obtener tus CSD:</strong>
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Ingresa al portal del SAT con tu e.firma (FIEL)</li>
            <li>Ve a Certifix {">"} Certificados de Sello Digital</li>
            <li>Genera un nuevo certificado (si no tienes uno vigente)</li>
            <li>Descarga los archivos .cer y .key</li>
            <li>Guarda la contraseña que usaste al generar el .key</li>
            <li>Sube estos archivos en la pestaña "Configuración" de esta página</li>
          </ol>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs mt-2 text-green-800">
          <strong>Seguridad:</strong> Tus archivos CSD se envían directamente al proveedor de timbrado (Facturama, PAC autorizado por el SAT)
          a través de conexión cifrada. No almacenamos tus llaves privadas en nuestros servidores.
        </div>
      </GuiaSection>

      <GuiaSection title="Preguntas frecuentes">
        <div className="space-y-4">
          <div>
            <p className="font-medium text-gray-900">¿Qué datos necesito de mi paciente para facturar?</p>
            <p className="mt-1">Nombre completo, RFC, régimen fiscal y código postal del domicilio fiscal. Estos datos los obtiene el paciente de su Constancia de Situación Fiscal en el portal del SAT.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">¿Qué uso de CFDI debo seleccionar para que sea deducible?</p>
            <p className="mt-1">D01 — Honorarios médicos, dentales y gastos hospitalarios. Con la clave de servicio médica correcta.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">¿Puedo facturar a la aseguradora y al paciente en una sola factura?</p>
            <p className="mt-1">No. Cada parte requiere su propia factura con su monto correspondiente.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">¿Qué hago si el paciente paga después de la consulta?</p>
            <p className="mt-1">Emite la factura con método de pago PPD y forma de pago 99 (por definir). Cuando recibas el pago, emite un Recibo Electrónico de Pago (REP).</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">¿Qué pasa si me equivoco en una factura?</p>
            <p className="mt-1">Puedes cancelarla desde la pestaña "Mis Facturas" indicando el motivo. Si vas a emitir una factura corregida, usa el motivo 01 e indica el UUID de la nueva factura.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">¿Cada cuándo debo emitir mis facturas?</p>
            <p className="mt-1">No hay plazo obligatorio, pero se recomienda emitirlas el mismo día de la consulta o dentro de las 24 horas siguientes para mantener un control fiscal ordenado.</p>
          </div>
        </div>
      </GuiaSection>
    </div>
  );
}
