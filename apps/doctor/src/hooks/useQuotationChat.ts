import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface QuotationChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface QuotationFormData {
  clientName: string;
  issueDate: string;
  validUntil: string;
  notes: string;
  termsAndConditions: string;
  itemCount: number;
  items: QuotationChatItem[];
}

export interface QuotationChatItem {
  description: string;
  itemType: 'product' | 'service';
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
}

export interface QuotationItemAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  item?: Partial<QuotationChatItem>;
  updates?: Partial<QuotationChatItem>;
  items?: Partial<QuotationChatItem>[];
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
    itemActions?: QuotationItemAction[];
  };
  error?: { code: string; message: string };
}

interface UseQuotationChatOptions {
  currentFormData: QuotationFormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateItems: (actions: QuotationItemAction[]) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `quot_chat_${Date.now()}_${_counter}`;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useQuotationChat({
  currentFormData,
  onUpdateFields,
  onUpdateItems,
}: UseQuotationChatOptions) {
  const [messages, setMessages] = useState<QuotationChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const conversationRef = useRef<ApiConversationMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(undefined);
  const shouldAutoSendRef = useRef(false);

  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: QuotationChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      conversationRef.current.push({ role: 'user', content: text });
      setIsLoading(true);

      try {
        const res = await fetch('/api/quotation-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFormData,
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errText = json.error?.message || 'Error desconocido';
          const assistantMsg: QuotationChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errText}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message = '', action, fieldUpdates, itemActions } = json.data;

        let fieldCount = 0;
        let itemCount = 0;

        const hasFieldUpdates = fieldUpdates && Object.keys(fieldUpdates).length > 0;
        const hasItemActions = itemActions && itemActions.length > 0;

        if (action !== 'no_change' || hasFieldUpdates || hasItemActions) {
          if (hasFieldUpdates) {
            onUpdateFields(fieldUpdates);
            fieldCount = Object.keys(fieldUpdates).length;
          }
          if (hasItemActions) {
            onUpdateItems(itemActions);
            itemCount = itemActions.length;
          }
        }

        let actionSummary: string | undefined;
        if (fieldCount > 0 || itemCount > 0) {
          const parts: string[] = [];
          if (fieldCount > 0) parts.push(`${fieldCount} campo${fieldCount !== 1 ? 's' : ''}`);
          if (itemCount > 0) parts.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`);
          actionSummary = `Se actualizaron ${parts.join(' y ')}`;
        }

        const assistantMsg: QuotationChatMessage = {
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
        console.error('[useQuotationChat] Error:', err);
        const assistantMsg: QuotationChatMessage = {
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
    [isLoading, currentFormData, onUpdateFields, onUpdateItems]
  );

  sendMessageRef.current = sendMessage;

  const processVoiceMessage = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
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

  useEffect(() => {
    if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
      shouldAutoSendRef.current = false;
      processVoiceMessage(voice.audioBlob);
    }
  }, [voice.status, voice.audioBlob, processVoiceMessage]);

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
