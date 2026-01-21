'use client';

/**
 * VoiceRecordButton
 *
 * Microphone button with recording states:
 * - Idle: gray mic
 * - Recording: red pulsing with duration
 * - Processing: spinner
 */

import { Mic, MicOff, Loader2, Square } from 'lucide-react';

interface VoiceRecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  duration: string;
  disabled?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancel?: () => void;
}

export function VoiceRecordButton({
  isRecording,
  isProcessing,
  duration,
  disabled = false,
  onStartRecording,
  onStopRecording,
  onCancel,
}: VoiceRecordButtonProps) {
  // Processing state
  if (isProcessing) {
    return (
      <button
        disabled
        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center cursor-not-allowed"
        title="Procesando..."
      >
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </button>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            title="Cancelar"
          >
            <MicOff className="w-4 h-4 text-gray-600" />
          </button>
        )}

        {/* Recording indicator with duration */}
        <div className="flex items-center gap-2 bg-red-50 rounded-full px-3 py-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 tabular-nums">{duration}</span>
        </div>

        {/* Stop button */}
        <button
          onClick={onStopRecording}
          className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg animate-pulse"
          title="Detener grabación"
        >
          <Square className="w-4 h-4 text-white fill-white" />
        </button>
      </div>
    );
  }

  // Idle state
  return (
    <button
      onClick={onStartRecording}
      disabled={disabled}
      className={`
        w-10 h-10 rounded-full flex items-center justify-center transition-all
        ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-blue-100 hover:text-blue-600 active:scale-95'
        }
      `}
      title="Grabar mensaje de voz"
    >
      <Mic className={`w-5 h-5 ${disabled ? 'text-gray-300' : 'text-gray-600'}`} />
    </button>
  );
}

export default VoiceRecordButton;
