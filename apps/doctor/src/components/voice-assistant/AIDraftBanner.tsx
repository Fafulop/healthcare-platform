'use client';

/**
 * AIDraftBanner
 *
 * Banner displayed when a form is pre-filled by AI voice assistant.
 * Shows confidence level and extracted fields info.
 */

import { Bot, CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useState } from 'react';
import { FIELD_LABELS_ES } from '@/types/voice-assistant';

interface AIDraftBannerProps {
  confidence: 'high' | 'medium' | 'low';
  fieldsExtracted: string[];
  fieldsEmpty: string[];
  onDismiss?: () => void;
  showDetails?: boolean;
}

export function AIDraftBanner({
  confidence,
  fieldsExtracted,
  fieldsEmpty,
  onDismiss,
  showDetails = false,
}: AIDraftBannerProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  // Confidence styling
  const confidenceConfig = {
    high: {
      label: 'Alta',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
    },
    medium: {
      label: 'Media',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: <Info className="w-5 h-5 text-yellow-600" />,
    },
    low: {
      label: 'Baja',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
    },
  };

  const config = confidenceConfig[confidence];

  // Get Spanish labels for fields
  const getFieldLabel = (field: string): string => {
    return FIELD_LABELS_ES[field] || field;
  };

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} mb-6`}>
      {/* Main Banner */}
      <div className="px-4 py-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              Borrador generado por IA
              <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                Confianza: {config.label}
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Revise y edite la información antes de guardar.
              {fieldsExtracted.length > 0 && (
                <span className="text-gray-500">
                  {' '}Se extrajeron {fieldsExtracted.length} campos.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 mt-2 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Extracted Fields */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Campos extraídos ({fieldsExtracted.length})
              </h4>
              {fieldsExtracted.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {fieldsExtracted.map((field) => (
                    <span
                      key={field}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                    >
                      {getFieldLabel(field)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Ningún campo extraído</p>
              )}
            </div>

            {/* Empty Fields */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-400" />
                Campos vacíos ({fieldsEmpty.length})
              </h4>
              {fieldsEmpty.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {fieldsEmpty.slice(0, 10).map((field) => (
                    <span
                      key={field}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded"
                    >
                      {getFieldLabel(field)}
                    </span>
                  ))}
                  {fieldsEmpty.length > 10 && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      +{fieldsEmpty.length - 10} más
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Todos los campos fueron extraídos</p>
              )}
            </div>
          </div>

          {/* Warning for low confidence */}
          {confidence === 'low' && (
            <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                La confianza es baja. Revise cuidadosamente todos los campos antes de guardar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
