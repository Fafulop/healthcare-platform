/**
 * useVoiceSession Hook
 *
 * Orchestrates the complete voice-to-form flow:
 * 1. Recording audio
 * 2. Transcribing via API
 * 3. Structuring via API
 * 4. Returning structured data for form pre-fill
 */

import { useState, useCallback } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import type {
  VoiceSessionType,
  VoiceSessionContext,
  VoiceSessionStatus,
  VoiceStructuredData,
  TranscribeResponse,
  StructureResponse,
} from '@/types/voice-assistant';

export interface UseVoiceSessionReturn {
  // Recording state (from useVoiceRecording)
  isRecording: boolean;
  recordingDuration: number;
  recordingDurationFormatted: string;
  recordingError: string | null;
  audioBlob: Blob | null;

  // Session state
  sessionStatus: VoiceSessionStatus;
  transcript: string | null;
  structuredData: VoiceStructuredData | null;
  fieldsExtracted: string[];
  fieldsEmpty: string[];
  confidence: 'high' | 'medium' | 'low' | null;
  sessionError: string | null;

  // IDs for audit
  transcriptId: string | null;
  sessionId: string | null;

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  processRecording: () => Promise<void>;
  reset: () => void;

  // Computed
  canProcess: boolean;
  isProcessing: boolean;
}

interface UseVoiceSessionOptions {
  sessionType: VoiceSessionType;
  context?: VoiceSessionContext;
  onComplete?: (data: VoiceStructuredData) => void;
  onError?: (error: string) => void;
}

export function useVoiceSession(options: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const { sessionType, context, onComplete, onError } = options;

  // Recording hook
  const recording = useVoiceRecording({
    maxDuration: 600, // 10 minutes
    onMaxDurationReached: () => {
      // Auto-process when max duration reached
    },
  });

  // Session state
  const [sessionStatus, setSessionStatus] = useState<VoiceSessionStatus>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [structuredData, setStructuredData] = useState<VoiceStructuredData | null>(null);
  const [fieldsExtracted, setFieldsExtracted] = useState<string[]>([]);
  const [fieldsEmpty, setFieldsEmpty] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Start recording
  const startRecording = useCallback(async () => {
    setSessionStatus('recording');
    setSessionError(null);
    setTranscript(null);
    setStructuredData(null);
    setFieldsExtracted([]);
    setFieldsEmpty([]);
    setConfidence(null);
    setTranscriptId(null);
    setSessionId(null);

    await recording.startRecording();
  }, [recording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    recording.stopRecording();
    setSessionStatus('idle');
  }, [recording]);

  // Process recording (transcribe + structure)
  const processRecording = useCallback(async () => {
    if (!recording.audioBlob) {
      setSessionError('No hay grabación para procesar');
      return;
    }

    try {
      // ==================== TRANSCRIBE ====================
      setSessionStatus('transcribing');
      setSessionError(null);

      const formData = new FormData();
      formData.append('audio', recording.audioBlob, 'recording.webm');
      formData.append('language', 'es');

      const transcribeRes = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const transcribeData: TranscribeResponse = await transcribeRes.json();

      if (!transcribeData.success || !transcribeData.data) {
        const errorMsg = transcribeData.error?.message || 'Error al transcribir el audio';
        setSessionError(errorMsg);
        setSessionStatus('error');
        onError?.(errorMsg);
        return;
      }

      setTranscript(transcribeData.data.transcript);
      setTranscriptId(transcribeData.data.transcriptId);

      // ==================== STRUCTURE ====================
      setSessionStatus('structuring');

      const structureRes = await fetch('/api/voice/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcribeData.data.transcript,
          transcriptId: transcribeData.data.transcriptId,
          sessionType,
          context,
        }),
      });

      const structureData: StructureResponse = await structureRes.json();

      if (!structureData.success || !structureData.data) {
        const errorMsg = structureData.error?.message || 'Error al estructurar la información';
        setSessionError(errorMsg);
        setSessionStatus('error');
        onError?.(errorMsg);
        return;
      }

      // Success!
      setStructuredData(structureData.data.structuredData);
      setFieldsExtracted(structureData.data.fieldsExtracted);
      setFieldsEmpty(structureData.data.fieldsEmpty);
      setConfidence(structureData.data.confidence);
      setSessionId(structureData.data.sessionId);
      setSessionStatus('draft_ready');

      onComplete?.(structureData.data.structuredData);
    } catch (error: any) {
      console.error('[useVoiceSession] Process error:', error);
      const errorMsg = 'Error de conexión. Verifique su internet e intente nuevamente.';
      setSessionError(errorMsg);
      setSessionStatus('error');
      onError?.(errorMsg);
    }
  }, [recording.audioBlob, sessionType, context, onComplete, onError]);

  // Reset everything
  const reset = useCallback(() => {
    recording.resetRecording();
    setSessionStatus('idle');
    setTranscript(null);
    setStructuredData(null);
    setFieldsExtracted([]);
    setFieldsEmpty([]);
    setConfidence(null);
    setSessionError(null);
    setTranscriptId(null);
    setSessionId(null);
  }, [recording]);

  // Computed values
  const canProcess = recording.status === 'stopped' && recording.audioBlob !== null;
  const isProcessing = sessionStatus === 'transcribing' || sessionStatus === 'structuring';

  return {
    // Recording state
    isRecording: recording.isRecording,
    recordingDuration: recording.duration,
    recordingDurationFormatted: formatDuration(recording.duration),
    recordingError: recording.error,
    audioBlob: recording.audioBlob,

    // Session state
    sessionStatus,
    transcript,
    structuredData,
    fieldsExtracted,
    fieldsEmpty,
    confidence,
    sessionError,

    // IDs
    transcriptId,
    sessionId,

    // Controls
    startRecording,
    stopRecording,
    processRecording,
    reset,

    // Computed
    canProcess,
    isProcessing,
  };
}

export { formatDuration };
