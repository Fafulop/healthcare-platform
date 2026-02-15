import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface LedgerChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface LedgerFormData {
  entryType: string;
  amount: string;
  concept: string;
  transactionDate: string;
  area: string;
  subarea: string;
  bankAccount: string;
  formaDePago: string;
  bankMovementId: string;
  paymentOption: string;
}

export interface LedgerEntryData {
  entryType: string | null;
  amount: number | null;
  concept: string | null;
  transactionDate: string | null;
  area: string | null;
  subarea: string | null;
  bankAccount: string | null;
  formaDePago: string | null;
  bankMovementId: string | null;
  paymentOption: string | null;
}

interface EntryAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  entry?: Partial<LedgerEntryData>;
  updates?: Partial<LedgerEntryData>;
  entries?: Partial<LedgerEntryData>[];
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
    entryActions?: EntryAction[];
  };
  error?: { code: string; message: string };
}

interface UseLedgerChatOptions {
  currentFormData: LedgerFormData;
  accumulatedEntries: LedgerEntryData[];
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateEntries: (entries: LedgerEntryData[]) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `ledger_chat_${Date.now()}_${_counter}`;
}

function normalizeEntry(partial: Partial<LedgerEntryData>): LedgerEntryData {
  return {
    entryType: partial.entryType || null,
    amount: partial.amount ?? null,
    concept: partial.concept || null,
    transactionDate: partial.transactionDate || null,
    area: partial.area || null,
    subarea: partial.subarea || null,
    bankAccount: partial.bankAccount || null,
    formaDePago: partial.formaDePago || null,
    bankMovementId: partial.bankMovementId || null,
    paymentOption: partial.paymentOption || null,
  };
}

function applyEntryActions(
  currentEntries: LedgerEntryData[],
  actions: EntryAction[]
): LedgerEntryData[] {
  let result = [...currentEntries];

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        if (action.entry) {
          result.push(normalizeEntry(action.entry));
        }
        break;
      }
      case 'update': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length && action.updates) {
          result[idx] = { ...result[idx], ...action.updates };
        }
        break;
      }
      case 'remove': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length) {
          result = result.filter((_, i) => i !== idx);
        }
        break;
      }
      case 'replace_all': {
        if (action.entries) {
          result = action.entries.map(normalizeEntry);
        }
        break;
      }
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useLedgerChat({
  currentFormData,
  accumulatedEntries,
  onUpdateFields,
  onUpdateEntries,
}: UseLedgerChatOptions) {
  const [messages, setMessages] = useState<LedgerChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const conversationRef = useRef<ApiConversationMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(undefined);
  const shouldAutoSendRef = useRef(false);

  // Voice recording
  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: LedgerChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      conversationRef.current.push({ role: 'user', content: text });

      setIsLoading(true);

      try {
        const res = await fetch('/api/ledger-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFormData,
            accumulatedEntries,
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errText = json.error?.message || 'Error desconocido';
          const assistantMsg: LedgerChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errText}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message = '', action, fieldUpdates, entryActions } = json.data;

        let fieldCount = 0;
        let entryCount = 0;

        const hasFieldUpdates = fieldUpdates && Object.keys(fieldUpdates).length > 0;
        const hasEntryActions = entryActions && entryActions.length > 0;

        if (action !== 'no_change' || hasFieldUpdates || hasEntryActions) {
          // Apply flat field updates
          if (hasFieldUpdates) {
            // Convert amount to string for form compatibility
            const updates = { ...fieldUpdates };
            if (updates.amount !== undefined) {
              updates.amount = String(updates.amount);
            }
            onUpdateFields(updates);
            fieldCount = Object.keys(fieldUpdates).length;
          }

          // Apply entry actions
          if (hasEntryActions) {
            const newEntries = applyEntryActions(accumulatedEntries, entryActions);
            onUpdateEntries(newEntries);
            entryCount = entryActions.length;
          }
        }

        let actionSummary: string | undefined;
        if (fieldCount > 0 || entryCount > 0) {
          const parts: string[] = [];
          if (fieldCount > 0) parts.push(`${fieldCount} campo${fieldCount !== 1 ? 's' : ''}`);
          if (entryCount > 0) parts.push(`${entryCount} movimiento${entryCount !== 1 ? 's' : ''}`);
          actionSummary = `Se actualizaron ${parts.join(' y ')}`;
        }

        const assistantMsg: LedgerChatMessage = {
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
        console.error('[useLedgerChat] Error:', err);
        const assistantMsg: LedgerChatMessage = {
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
    [isLoading, currentFormData, accumulatedEntries, onUpdateFields, onUpdateEntries]
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

  // Auto-send when recording stops
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
