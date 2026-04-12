"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ClipboardList, Copy, Check, Loader2, Search, UserSquare2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Template {
  id: string;
  name: string;
}

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function StandaloneFormularioModal({ isOpen, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset + load templates on open
  useEffect(() => {
    if (!isOpen) return;
    setGeneratedUrl(null);
    setSelectedTemplateId("");
    setPatientSearch("");
    setPatientResults([]);
    setSelectedPatient(null);
    setCopied(false);

    async function fetchTemplates() {
      setLoadingTemplates(true);
      try {
        const res = await authFetch(`/api/custom-templates?isPreAppointment=true`);
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data ?? []);
        } else {
          toast.error("Error al cargar plantillas");
        }
      } catch {
        toast.error("Error al cargar plantillas");
      } finally {
        setLoadingTemplates(false);
      }
    }
    fetchTemplates();
  }, [isOpen]);

  // Debounced patient search
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPatientResults([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await authFetch(
        `/api/medical-records/patients?search=${encodeURIComponent(query)}&status=active`
      );
      const data = await res.json();
      if (data.data) setPatientResults(data.data.slice(0, 6));
    } catch {
      // silent — user can retry
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch, searchPatients]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!patientResults.length) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPatientResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [patientResults.length]);

  const handleGenerate = async () => {
    if (!selectedPatient || !selectedTemplateId) return;
    setGenerating(true);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/form-links`, {
        method: "POST",
        body: JSON.stringify({ patientId: selectedPatient.id, templateId: selectedTemplateId }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedUrl(data.data.url);
      } else {
        toast.error(data.error || "Error al generar el enlace");
      }
    } catch {
      toast.error("Error al generar el enlace");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = (url: string) => {
    if (!selectedPatient) return;
    const msg = `Hola ${selectedPatient.firstName}, te comparto un formulario médico para completar:\n${url}\nPor favor complétalo antes de tu consulta. ¡Gracias!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setSelectedTemplateId("");
    setPatientSearch("");
    setPatientResults([]);
    setSelectedPatient(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-violet-500" />
            Formulario libre
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* Patient selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Paciente</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between px-3 py-2.5 border border-violet-200 bg-violet-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserSquare2 className="w-4 h-4 text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-violet-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                </div>
                {!generatedUrl && (
                  <button
                    onClick={() => { setSelectedPatient(null); setPatientSearch(""); }}
                    className="text-xs text-violet-600 hover:text-violet-800"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <div ref={dropdownRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Buscar paciente por nombre..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-violet-400 focus:border-violet-400"
                />
                {searchingPatients && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
                {patientResults.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch("");
                          setPatientResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {p.firstName} {p.lastName}
                        </p>
                        {p.phone && <p className="text-xs text-gray-500">{p.phone}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generated URL */}
          {generatedUrl && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Enlace generado
              </p>
              <p className="text-sm text-gray-800 break-all font-mono">{generatedUrl}</p>
            </div>
          )}

          {/* URL actions */}
          {generatedUrl && (
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(generatedUrl)}
                className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => handleWhatsApp(generatedUrl)}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>
            </div>
          )}

          {/* Template selector + generate */}
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-gray-500">No tienes plantillas pre-cita creadas.</p>
              <a
                href="/dashboard/medical-records/custom-templates/new"
                className="text-sm text-gray-700 hover:text-gray-900 font-medium underline"
              >
                Crear plantilla pre-cita →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Plantilla
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={!!generatedUrl}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm disabled:opacity-50 disabled:bg-gray-50"
                >
                  <option value="">Selecciona una plantilla</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {!generatedUrl && (
                <button
                  onClick={handleGenerate}
                  disabled={generating || !selectedTemplateId || !selectedPatient}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {generating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ClipboardList className="w-4 h-4" />
                  }
                  {generating ? "Generando..." : "Generar enlace"}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
