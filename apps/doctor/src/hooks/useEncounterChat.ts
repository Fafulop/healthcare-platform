import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import type { EncounterFormData } from '@/components/medical-records/EncounterForm';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EncounterChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

interface ApiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    message: string;
    action: 'update_fields' | 'no_change';
    fieldUpdates?: Record<string, any>;
  };
  error?: { code: string; message: string };
}

export interface TemplateInfo {
  type: 'standard' | 'custom';
  name?: string;
  fieldVisibility?: Record<string, boolean>;
  customFields?: {
    name: string;
    label: string;
    type: string;
    options?: string[];
  }[];
}

interface UseEncounterChatOptions {
  currentFormData: EncounterFormData;
  onUpdateForm: (updates: Partial<EncounterFormData>) => void;
  templateInfo: TemplateInfo;
  onUpdateCustomFields?: (updates: Record<string, any>) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `enc_chat_${Date.now()}_${_counter}`;
}

const STANDARD_KEYS = new Set([
  'encounterDate', 'encounterType', 'chiefComplaint', 'location',
  'clinicalNotes', 'subjective', 'objective', 'assessment', 'plan',
  'vitalsBloodPressure', 'vitalsHeartRate', 'vitalsTemperature',
  'vitalsWeight', 'vitalsHeight', 'vitalsOxygenSat', 'vitalsOther',
  'followUpDate', 'followUpNotes', 'status',
]);

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useEncounterChat({
  currentFormData,
  onUpdateForm,
  templateInfo,
  onUpdateCustomFields,
}: UseEncounterChatOptions) {
  const [messages, setMessages] = useState<EncounterChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const conversationRef = useRef<ApiConversationMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>();
  const shouldAutoSendRef = useRef(false);

  // Voice recording
  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: EncounterChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      conversationRef.current.push({ role: 'user', content: text });

      setIsLoading(true);

      try {
        const res = await fetch('/api/encounter-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFormData,
            templateInfo,
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errText = json.error?.message || 'Error desconocido';
          const assistantMsg: EncounterChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errText}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message = '', action, fieldUpdates } = json.data;

        let actionSummary: string | undefined;

        if (action === 'update_fields' && fieldUpdates && Object.keys(fieldUpdates).length > 0) {
          const standardUpdates: Partial<EncounterFormData> = {};
          const customUpdates: Record<string, any> = {};

          for (const [key, value] of Object.entries(fieldUpdates)) {
            if (STANDARD_KEYS.has(key)) {
              (standardUpdates as any)[key] = value;
            } else {
              customUpdates[key] = value;
            }
          }

          if (Object.keys(standardUpdates).length > 0) {
            onUpdateForm(standardUpdates);
          }
          if (Object.keys(customUpdates).length > 0 && onUpdateCustomFields) {
            onUpdateCustomFields(customUpdates);
          }

          const count = Object.keys(fieldUpdates).length;
          actionSummary = `Se actualizaron ${count} campo${count !== 1 ? 's' : ''}`;
        }

        const assistantMsg: EncounterChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          actionSummary,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (message) {
          conversationRef.current.push({ role: 'assistant', content: message });
        }
      } catch (err) {
        console.error('[useEncounterChat] Error:', err);
        const assistantMsg: EncounterChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Lo siento, no pude conectarme con el servidor. Intente de nuevo.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, currentFormData, templateInfo, onUpdateForm, onUpdateCustomFields]
  );

  // Keep a ref to latest sendMessage so processVoiceMessage can call it
  sendMessageRef.current = sendMessage;

  // Process voice recording: transcribe audio blob then send as text
  const processVoiceMessage = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();

      if (json.success && json.data?.transcript) {
        await sendMessageRef.current?.(json.data.transcript);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: json.error?.message || 'No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'Error al transcribir el audio. Intente de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTranscribing(false);
      voice.resetRecording();
    }
  }, [voice.resetRecording]);

  // Auto-send when recording stops (mirrors working useChatSession pattern)
  useEffect(() => {
    if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
      shouldAutoSendRef.current = false;
      processVoiceMessage(voice.audioBlob);
    }
  }, [voice.status, voice.audioBlob, processVoiceMessage]);

  // Stop recording and flag for auto-send
  const handleVoiceStop = useCallback(() => {
    shouldAutoSendRef.current = true;
    voice.stopRecording();
  }, [voice.stopRecording]);

  const clearChat = useCallback(() => {
    setMessages([]);
    conversationRef.current = [];
  }, []);

  return {
    messages,
    isLoading,
    isTranscribing,
    sendMessage,
    clearChat,
    voice: {
      isRecording: voice.isRecording,
      isProcessing: isTranscribing,
      duration: formatDuration(voice.duration),
      startRecording: voice.startRecording,
      stopRecording: handleVoiceStop,
      cancelRecording: voice.resetRecording,
    },
  };
}
