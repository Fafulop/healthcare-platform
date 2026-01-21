/**
 * useVoiceRecording Hook
 *
 * Handles browser audio recording using MediaRecorder API.
 * Returns recording state, controls, and the recorded audio blob.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingStatus = 'idle' | 'requesting' | 'ready' | 'recording' | 'stopped' | 'error';

export interface UseVoiceRecordingReturn {
  // State
  status: RecordingStatus;
  isRecording: boolean;
  duration: number; // seconds
  error: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;

  // Permissions
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
}

interface UseVoiceRecordingOptions {
  maxDuration?: number; // Max recording duration in seconds (default: 600 = 10 min)
  mimeType?: string; // Preferred MIME type
  onMaxDurationReached?: () => void;
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const {
    maxDuration = 600,
    mimeType: preferredMimeType,
    onMaxDurationReached,
  } = options;

  // State
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Revoke audio URL on change
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Get supported MIME type
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      preferredMimeType,
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ].filter(Boolean) as string[];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback - let browser choose
    return '';
  }, [preferredMimeType]);

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('requesting');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately - we just needed to check permission
      stream.getTracks().forEach((track) => track.stop());

      setHasPermission(true);
      setStatus('ready');
      return true;
    } catch (err: any) {
      console.error('[useVoiceRecording] Permission error:', err);

      setHasPermission(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permiso de micrófono denegado. Habilítelo en la configuración del navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No se encontró micrófono. Conecte un micrófono e intente nuevamente.');
      } else {
        setError('Error al acceder al micrófono. Intente nuevamente.');
      }

      setStatus('error');
      return false;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      chunksRef.current = [];

      // Request permission / get stream
      setStatus('requesting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Create MediaRecorder
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('stopped');

        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event: any) => {
        console.error('[useVoiceRecording] MediaRecorder error:', event);
        setError('Error durante la grabación. Intente nuevamente.');
        setStatus('error');
        cleanup();
      };

      // Start recording - no timeslice to produce a single valid WebM container
      // Using timeslice creates multiple WebM containers that corrupt when concatenated
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setStatus('recording');

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Check max duration
        if (elapsed >= maxDuration) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }

          onMaxDurationReached?.();
        }
      }, 1000);
    } catch (err: any) {
      console.error('[useVoiceRecording] Start error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permiso de micrófono denegado. Habilítelo en la configuración del navegador.');
        setHasPermission(false);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No se encontró micrófono. Conecte un micrófono e intente nuevamente.');
      } else {
        setError('Error al iniciar la grabación. Intente nuevamente.');
      }

      setStatus('error');
      cleanup();
    }
  }, [cleanup, getSupportedMimeType, maxDuration, onMaxDurationReached]);

  // Stop recording
  const stopRecording = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Reset recording
  const resetRecording = useCallback((): void => {
    cleanup();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setStatus('idle');
    setDuration(0);
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
  }, [cleanup, audioUrl]);

  return {
    // State
    status,
    isRecording: status === 'recording',
    duration,
    error,
    audioBlob,
    audioUrl,

    // Controls
    startRecording,
    stopRecording,
    resetRecording,

    // Permissions
    hasPermission,
    requestPermission,
  };
}

/**
 * Format seconds to MM:SS string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
