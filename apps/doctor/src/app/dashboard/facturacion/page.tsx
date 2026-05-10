"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
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
// Main Page
// ---------------------------------------------------------------------------

export default function FacturacionPage() {
  const { status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [activeTab, setActiveTab] = useState<"facturas" | "config" | "nueva">("config");
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [csdStatus, setCsdStatus] = useState<CSDStatus | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Once profile is set and CSD is active, default to "facturas" tab
  useEffect(() => {
    if (profile && csdStatus?.csdUploaded && csdStatus.facturamaStatus === "active") {
      setActiveTab("facturas");
    }
  }, [profile, csdStatus]);

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
            </>
          )}
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
        <NuevaFacturaTab profile={profile} onCreated={() => setActiveTab("facturas")} />
      )}
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
      .then(({ data }) => setRegimenes(data || []))
      .catch(() => {});
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

      const res = await authFetch(`${API_URL}/api/facturacion/csd`, {
        method: "POST",
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
// FACTURAS LIST TAB
// ---------------------------------------------------------------------------

function FacturasListTab() {
  const [facturas, setFacturas] = useState<CfdiEmitted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFacturas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi`);
      if (!res.ok) throw new Error("Error al obtener facturas");
      const { data } = await res.json();
      setFacturas(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacturas();
  }, [fetchFacturas]);

  const handleDownloadPdf = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/pdf`);
      if (!res.ok) throw new Error("Error al descargar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadXml = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${id}/xml`);
      if (!res.ok) throw new Error("Error al descargar XML");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura_${id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No has emitido facturas aún</p>
        <p className="text-sm text-gray-400 mt-1">Usa la pestaña "Nueva Factura" para crear tu primera</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Receptor</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {facturas.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">
                  {new Date(f.issuedAt).toLocaleDateString("es-MX")}
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900">{f.nombreReceptor}</div>
                  <div className="text-xs text-gray-400">{f.rfcReceptor}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  ${parseFloat(f.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleDownloadPdf(f.id)} title="Descargar PDF"
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDownloadXml(f.id)} title="Descargar XML"
                      className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleSendEmail(f.id)} title="Enviar por email"
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function NuevaFacturaTab({
  profile, onCreated
}: {
  profile: FiscalProfile;
  onCreated: () => void;
}) {
  const [receiver, setReceiver] = useState({
    rfc: "",
    name: "",
    cfdiUse: "D01",
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
    withIsrRetention: false,
  }]);
  const [paymentForm, setPaymentForm] = useState("03"); // Transferencia
  const [paymentMethod, setPaymentMethod] = useState("PUE");
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
      setUsosCfdi(usos.data || []);
      setFormasPago(formas.data || []);
      setRegimenes(regs.data || []);
    }).catch(() => {});
  }, []);

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
      if (item.withIva) iva += itemSubtotal * 0.16;
      if (item.withIsrRetention) isrRetention += itemSubtotal * 0.10;
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
            Total: Math.round(itemSubtotal * 0.16 * 100) / 100,
            Name: "IVA",
            Base: itemSubtotal,
            Rate: 0.16,
            IsRetention: false,
          });
        }

        if (item.withIsrRetention) {
          taxes.push({
            Total: Math.round(itemSubtotal * 0.10 * 100) / 100,
            Name: "ISR",
            Base: itemSubtotal,
            Rate: 0.10,
            IsRetention: true,
          });
        }

        const total = itemSubtotal
          + (item.withIva ? itemSubtotal * 0.16 : 0)
          - (item.withIsrRetention ? itemSubtotal * 0.10 : 0);

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
        cfdiType: "I",
        paymentForm,
        paymentMethod,
      };

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
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Receiver */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Receptor</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RFC Receptor</label>
            <input
              type="text"
              value={receiver.rfc}
              onChange={e => setReceiver({ ...receiver, rfc: e.target.value.toUpperCase() })}
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

              {/* Tax toggles */}
              <div className="flex gap-4 mt-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.withIva}
                    onChange={e => updateItem(idx, "withIva", e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  IVA 16%
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.withIsrRetention}
                    onChange={e => updateItem(idx, "withIsrRetention", e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Retención ISR 10%
                </label>
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
            <div className="flex gap-8">
              <span className="text-gray-600">IVA 16%:</span>
              <span className="font-medium">${totals.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.isrRetention > 0 && (
            <div className="flex gap-8">
              <span className="text-gray-600">Retención ISR 10%:</span>
              <span className="font-medium text-red-600">-${totals.isrRetention.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
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
