"use client";

import { useState } from "react";
import { X, Star, Copy, Check, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateReviewLinkModal({ isOpen, onClose }: Props) {
  const [patientName, setPatientName] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/reviews/generate-link`, {
        method: "POST",
        body: JSON.stringify({ patientName: patientName.trim() || undefined }),
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
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!generatedUrl) return;
    const name = patientName.trim();
    const msg = name
      ? `Hola ${name}, te compartimos el enlace para dejar tu opinión sobre tu consulta: ${generatedUrl}`
      : `Te compartimos el enlace para dejar tu opinión sobre tu consulta: ${generatedUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleClose = () => {
    setPatientName("");
    setGeneratedUrl(null);
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
            <Star className="w-4 h-4 text-amber-500" />
            Generar Enlace de Reseña
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!generatedUrl ? (
            <>
              <p className="text-sm text-gray-500">
                Genera un enlace único para que cualquier paciente pueda dejar una opinión en tu perfil público.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Nombre del paciente <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ej: Juan García"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Se pre-llenará en el formulario de reseña.
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                {loading ? "Generando..." : "Generar Enlace"}
              </button>
            </>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Enlace generado
                </p>
                <p className="text-sm text-gray-800 break-all font-mono">{generatedUrl}</p>
              </div>

              <p className="text-xs text-gray-400">
                Este enlace es de un solo uso. Cuando el paciente lo use quedará desactivado.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "¡Copiado!" : "Copiar enlace"}
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
              </div>

              <button
                onClick={() => { setGeneratedUrl(null); setPatientName(""); }}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Generar otro enlace
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
