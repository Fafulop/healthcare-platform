import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface PracticeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── ID generator ────────────────────────────────────────────────────────────

let _counter = 0;
export function generateChatId(prefix: string): string {
  _counter++;
  return `${prefix}_${Date.now()}_${_counter}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Core chat + voice infrastructure shared by all practice domain chat hooks.
 *
 * Pass `makeApiCall` to implement the domain-specific API request and response
 * processing. It receives the current conversation history and the raw user
 * text, and should return `{ message, actionSummary? }`.  Throwing an error
 * from `makeApiCall` triggers the standard "could not connect" fallback.
 */
export function useBasePracticeChat({
  idPrefix,
  makeApiCall,
}: {
  idPrefix: string;
  makeApiCall: (
    conversation: ConversationMessage[],
    text: string
  ) => Promise<{ message: string; actionSummary?: string }>;
}) {
  const [messages, setMessages] = useState<PracticeChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const conversationRef = useRef<ConversationMessage[]>([]);
  // Always points to the latest makeApiCall so sendMessage's useCallback
  // deps stay stable even when makeApiCall captures fresh closure state.
  const makeApiCallRef = useRef(makeApiCall);
  makeApiCallRef.current = makeApiCall;

  const sendMessageRef = useRef<(text: string) => Promise<void>>(undefined);
  const shouldAutoSendRef = useRef(false);

  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(async (text: string) => {
    if (isLoading) return;

    const userMsg: PracticeChatMessage = {
      id: generateChatId(idPrefix),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    conversationRef.current.push({ role: 'user', content: text });
    setIsLoading(true);

    try {
      const { message = '', actionSummary } = await makeApiCallRef.current(
        conversationRef.current,
        text
      );

      const assistantMsg: PracticeChatMessage = {
        id: generateChatId(idPrefix),
        role: 'assistant',
        content: message,
        timestamp: new Date(),
        actionSummary,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (message) {
        conversationRef.current.push({ role: 'assistant', content: message });
      }
    } catch (err: any) {
      console.error(`[${idPrefix}] Error:`, err);
      const content =
        err?.message && !err.message.includes('fetch')
          ? `Lo siento, ocurrio un error: ${err.message}`
          : 'Lo siento, no pude conectarme con el servidor. Intente de nuevo.';
      const assistantMsg: PracticeChatMessage = {
        id: generateChatId(idPrefix),
        role: 'assistant',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      conversationRef.current.push({ role: 'assistant', content });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, idPrefix]);

  sendMessageRef.current = sendMessage;

  // ─── Voice ─────────────────────────────────────────────────────────────────

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
            id: generateChatId(idPrefix),
            role: 'assistant',
            content:
              json.error?.message ||
              'No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateChatId(idPrefix),
          role: 'assistant',
          content: 'Error al transcribir el audio. Intente de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTranscribing(false);
      voice.resetRecording();
    }
  }, [idPrefix, voice.resetRecording]);

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
