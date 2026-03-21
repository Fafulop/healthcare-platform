"use client";

import { useState, useEffect } from "react";
import { X, ClipboardList, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import type { Booking } from "../_hooks/useBookings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const PUBLIC_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://tusalud.pro";

interface Template {
  id: string;
  name: string;
}

interface Props {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PreAppointmentFormModal({ booking, isOpen, onClose, onSuccess }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load pre-appointment templates when modal opens
  useEffect(() => {
    if (!isOpen || !booking) return;
    setGeneratedUrl(null);
    setSelectedTemplateId("");
    setCopied(false);

    async function fetchTemplates() {
      setLoadingTemplates(true);
      try {
        const res = await authFetch(
          `${API_URL}/api/custom-templates?isPreAppointment=true`
        );
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
  }, [isOpen, booking]);

  const handleGenerate = async () => {
    if (!booking || !selectedTemplateId) return;
    setGenerating(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/appointments/bookings/${booking.id}/form-link`,
        {
          method: "POST",
          body: JSON.stringify({ templateId: selectedTemplateId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setGeneratedUrl(data.data.url);
        onSuccess();
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
    if (!booking) return;
    const apptDate = (booking.slot?.date ?? booking.date ?? "").split("T")[0];
    const dateLabel = apptDate || "tu próxima cita";
    const msg = `Hola ${booking.patientName}, te comparto el formulario pre-cita para tu cita del ${dateLabel}:\n${url}\nPor favor complétalo antes de tu consulta. ¡Gracias!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setSelectedTemplateId("");
    setCopied(false);
    onClose();
  };

  if (!isOpen || !booking) return null;

  // Patient already submitted — show read-only state
  if (booking.formLink?.status === "SUBMITTED") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
          <div className="bg-purple-600 px-6 py-4 rounded-t-lg flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Formulario Pre-Cita
            </h2>
            <button onClick={handleClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">El paciente ya envió este formulario</p>
              <p className="text-sm text-gray-500 mt-1">{booking.patientName} completó el formulario pre-cita.</p>
            </div>
            <Link
              href={`/dashboard/medical-records/formularios/${booking.formLink.id}`}
              className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ver respuestas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const existingPendingUrl = booking.formLink?.status === "PENDING"
    ? `${PUBLIC_URL}/formulario-cita/${booking.formLink.token}`
    : null;

  const displayUrl = generatedUrl ?? existingPendingUrl;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-purple-600 px-6 py-4 rounded-t-lg flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Formulario Pre-Cita
          </h2>
          <button onClick={handleClose} className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Paciente: <span className="font-medium text-gray-900">{booking.patientName}</span>
          </p>

          {/* Generated / existing URL card */}
          {displayUrl && (
            <div className={`border rounded-lg p-3 ${generatedUrl ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${generatedUrl ? "text-green-700" : "text-blue-700"}`}>
                {generatedUrl ? "Enlace generado ✓" : "Enlace activo"}
              </p>
              <p className="text-sm text-gray-800 break-all font-mono">{displayUrl}</p>
            </div>
          )}

          {/* Existing pending notice */}
          {existingPendingUrl && !generatedUrl && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Ya existe un enlace activo. Generar uno nuevo invalidará el anterior.
            </p>
          )}

          {/* URL actions */}
          {displayUrl && (
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(displayUrl)}
                className="flex-1 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => handleWhatsApp(displayUrl)}
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
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-gray-500">No tienes plantillas pre-cita creadas.</p>
              <a
                href="/dashboard/medical-records/custom-templates/new"
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Crear plantilla pre-cita →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plantilla
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecciona una plantilla</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !selectedTemplateId}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                {generating ? "Generando..." : (existingPendingUrl || generatedUrl) ? "Regenerar enlace" : "Generar enlace"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
