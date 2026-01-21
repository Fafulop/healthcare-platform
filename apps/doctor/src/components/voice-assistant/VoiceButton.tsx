'use client';

/**
 * VoiceButton
 *
 * Button that triggers the voice recording modal.
 * Displays a microphone icon with label.
 */

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { VoiceRecordingModal } from './VoiceRecordingModal';
import type {
  VoiceSessionType,
  VoiceSessionContext,
  VoiceStructuredData,
} from '@/types/voice-assistant';

interface VoiceButtonProps {
  sessionType: VoiceSessionType;
  context?: VoiceSessionContext;
  onComplete: (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

// Default labels for each session type
const DEFAULT_LABELS: Record<VoiceSessionType, string> = {
  NEW_PATIENT: 'Nuevo Paciente (Voz)',
  NEW_ENCOUNTER: 'Nueva Consulta (Voz)',
  NEW_PRESCRIPTION: 'Nueva Prescripción (Voz)',
};

export function VoiceButton({
  sessionType,
  context,
  onComplete,
  label,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
}: VoiceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const displayLabel = label || DEFAULT_LABELS[sessionType];

  const handleComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    setIsModalOpen(false);
    onComplete(transcript, data, sessionId, transcriptId, audioDuration);
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent',
    outline: 'bg-white text-blue-600 hover:bg-blue-50 border-blue-600',
  };

  // Icon size based on button size
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 font-medium rounded-lg border transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
      >
        <Mic className={iconSizes[size]} />
        {displayLabel}
      </button>

      <VoiceRecordingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sessionType={sessionType}
        context={context}
        onComplete={handleComplete}
      />
    </>
  );
}
