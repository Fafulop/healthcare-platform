'use client';

import { X, Copy, RefreshCw, Loader2, Check } from 'lucide-react';
import { useState } from 'react';

interface PatientSummaryData {
  id: string;
  content: string;
  dataPoints: { encounters: number; prescriptions: number; notes: number };
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summary: PatientSummaryData;
  patientName: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function PatientSummaryModal({
  isOpen,
  onClose,
  summary,
  patientName,
  onRegenerate,
  isRegenerating,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const dp = summary.dataPoints;

  const formattedDate = new Date(summary.createdAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full my-4 sm:my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Resumen Clínico
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date banner */}
        <div className="px-4 sm:px-6 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <p className="text-sm text-blue-700 font-medium">
            Generado el {formattedDate}
          </p>
          <p className="text-xs text-blue-500 mt-0.5">
            Basado en {dp.encounters} consulta{dp.encounters !== 1 ? 's' : ''}, {dp.prescriptions} prescripci{dp.prescriptions !== 1 ? 'ones' : 'ón'} y {dp.notes} nota{dp.notes !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto flex-1 min-h-0">
          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
            {summary.content}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isRegenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isRegenerating ? 'Regenerando...' : 'Regenerar'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
