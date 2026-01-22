'use client';

/**
 * VoiceRecordingModal
 *
 * Modal for recording voice dictation. Shows:
 * - Reference guide for what can be dictated
 * - Recording controls and timer
 * - Processing status
 * - Error states
 */

import { useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileText,
  Stethoscope,
  Pill,
  User,
} from 'lucide-react';
import { useVoiceSession, formatDuration } from '@/hooks/useVoiceSession';
import type {
  VoiceSessionType,
  VoiceSessionContext,
  VoiceStructuredData,
} from '@/types/voice-assistant';

interface VoiceRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: VoiceSessionType;
  context?: VoiceSessionContext;
  onComplete: (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => void;
}

// Reference guides for each session type
const REFERENCE_GUIDES: Record<VoiceSessionType, { title: string; icon: React.ReactNode; items: string[] }> = {
  NEW_PATIENT: {
    title: 'Nuevo Paciente',
    icon: <User className="w-5 h-5" />,
    items: [
      'Nombre completo del paciente',
      'Fecha de nacimiento y sexo',
      'Tipo de sangre',
      'Teléfono y email',
      'Dirección completa',
      'Contacto de emergencia',
      'Alergias conocidas',
      'Condiciones crónicas',
      'Medicamentos actuales',
    ],
  },
  NEW_ENCOUNTER: {
    title: 'Nueva Consulta',
    icon: <Stethoscope className="w-5 h-5" />,
    items: [
      'Fecha y tipo de consulta',
      'Motivo de consulta',
      'Signos vitales (presión, frecuencia, temperatura, peso, talla, saturación)',
      'Notas clínicas o formato SOAP:',
      '  • Subjetivo: lo que refiere el paciente',
      '  • Objetivo: hallazgos de exploración',
      '  • Evaluación: diagnóstico o impresión',
      '  • Plan: tratamiento indicado',
      'Fecha y notas de seguimiento',
    ],
  },
  NEW_PRESCRIPTION: {
    title: 'Nueva Prescripción',
    icon: <Pill className="w-5 h-5" />,
    items: [
      'Diagnóstico',
      '💡 Puede dictar múltiples medicamentos en un solo comando',
      'Para cada medicamento:',
      '  • Nombre del medicamento',
      '  • Presentación (tableta, jarabe, etc.)',
      '  • Dosis (ej: 500mg)',
      '  • Frecuencia (ej: cada 8 horas)',
      '  • Duración (ej: 7 días)',
      '  • Indicaciones de uso (REQUERIDO)',
      '  • Advertencias especiales',
    ],
  },
};

export function VoiceRecordingModal({
  isOpen,
  onClose,
  sessionType,
  context,
  onComplete,
}: VoiceRecordingModalProps) {
  const session = useVoiceSession({
    sessionType,
    context,
    onComplete: (data) => {
      // Will be called when structuring is complete
    },
  });

  const guide = REFERENCE_GUIDES[sessionType];

  // Handle completion - auto-transition to sidebar after 1 second
  // Track if we've already called onComplete for this session to prevent duplicates
  const hasCalledCompleteRef = useRef<string | null>(null);

  useEffect(() => {
    // Only proceed if modal is actually open
    if (!isOpen) return;

    if (
      session.sessionStatus === 'draft_ready' &&
      session.structuredData &&
      session.sessionId &&
      session.transcriptId &&
      session.transcript
    ) {
      // Prevent calling onComplete multiple times for the same session
      if (hasCalledCompleteRef.current === session.sessionId) return;

      // Show success state for 1 second, then open sidebar
      const timer = setTimeout(() => {
        // Double-check we haven't already called for this session
        if (hasCalledCompleteRef.current === session.sessionId) return;
        hasCalledCompleteRef.current = session.sessionId;

        onComplete(
          session.transcript!,
          session.structuredData!,
          session.sessionId!,
          session.transcriptId!,
          session.recordingDuration
        );
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    isOpen,
    session.sessionStatus,
    session.structuredData,
    session.sessionId,
    session.transcriptId,
    session.transcript,
    session.recordingDuration,
    onComplete,
  ]);

  // Reset the completion tracker when modal opens
  useEffect(() => {
    if (isOpen) {
      hasCalledCompleteRef.current = null;
    }
  }, [isOpen]);

  // Handle close
  const handleClose = () => {
    session.reset();
    onClose();
  };

  // Handle retry
  const handleRetry = () => {
    session.reset();
  };

  if (!isOpen) return null;

  const error = session.recordingError || session.sessionError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              {guide.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {guide.title} (Voz)
              </h2>
              <p className="text-sm text-gray-500">Dicte la información del paciente</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Reference Guide */}
          {(session.sessionStatus === 'idle' || session.sessionStatus === 'recording') && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Información que puede dictar:
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {guide.items.map((item, index) => (
                  <li key={index} className={item.startsWith('  •') ? 'ml-4' : ''}>
                    {item.startsWith('  •') ? item : `• ${item}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Divider */}
          {(session.sessionStatus === 'idle' || session.sessionStatus === 'recording') && (
            <hr className="my-6 border-gray-200" />
          )}

          {/* Recording UI */}
          <div className="flex flex-col items-center py-4">
            {/* Status: Idle - Ready to record */}
            {session.sessionStatus === 'idle' && !session.audioBlob && (
              <>
                <button
                  onClick={session.startRecording}
                  className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-lg"
                >
                  <Mic className="w-8 h-8" />
                </button>
                <p className="mt-4 text-sm text-gray-600">
                  Presione para comenzar a grabar
                </p>
              </>
            )}

            {/* Status: Recording (including permission request phase) */}
            {session.sessionStatus === 'recording' && (
              <>
                <div className="relative">
                  <button
                    onClick={session.stopRecording}
                    className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg animate-pulse"
                  >
                    <Square className="w-8 h-8" />
                  </button>
                  {/* Pulse animation - pointer-events-none so clicks pass through to button */}
                  <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25 pointer-events-none" />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-2xl font-mono font-semibold text-gray-900">
                    {session.recordingDurationFormatted}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {session.isRecording ? 'Grabando... Presione para detener' : 'Iniciando grabación...'}
                </p>
              </>
            )}

            {/* Status: Stopped - Ready to process */}
            {session.sessionStatus === 'idle' && session.audioBlob && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  Grabación completada ({session.recordingDurationFormatted})
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Grabar de nuevo
                  </button>
                  <button
                    onClick={session.processRecording}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Procesar
                  </button>
                </div>
              </>
            )}

            {/* Status: Transcribing */}
            {session.sessionStatus === 'transcribing' && (
              <>
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>
                <p className="mt-4 text-sm text-gray-600 font-medium">
                  Transcribiendo audio...
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Esto puede tomar unos segundos
                </p>
              </>
            )}

            {/* Status: Structuring */}
            {session.sessionStatus === 'structuring' && (
              <>
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>
                <p className="mt-4 text-sm text-gray-600 font-medium">
                  Estructurando información...
                </p>
                {session.transcript && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg max-w-sm">
                    <p className="text-xs text-gray-500 mb-1">Transcripción:</p>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {session.transcript}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Status: Error */}
            {session.sessionStatus === 'error' && (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <p className="mt-4 text-sm text-red-600 font-medium text-center max-w-xs">
                  {error}
                </p>
                <button
                  onClick={handleRetry}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Intentar de nuevo
                </button>
              </>
            )}

            {/* Status: Draft Ready */}
            {session.sessionStatus === 'draft_ready' && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <p className="mt-4 text-sm text-green-600 font-medium">
                  ¡Información estructurada!
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {session.fieldsExtracted.length} campos extraídos • Confianza: {session.confidence}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Abriendo chat...
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              El audio no se almacena. Solo se usa para transcripción.
            </p>
            <button
              onClick={handleClose}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
