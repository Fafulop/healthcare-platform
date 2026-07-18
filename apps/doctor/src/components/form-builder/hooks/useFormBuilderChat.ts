import { useState, useCallback, useRef, useEffect } from 'react';
import { useFormBuilder } from '../FormBuilderProvider';
import { useVoiceRecording, formatDuration } from '@/hooks/useVoiceRecording';
import type { FieldDefinition } from '@/types/custom-encounter';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FormBuilderChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Badge shown on assistant messages when fields were applied */
  actionSummary?: string;
}

interface ApiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ApiAction =
  | { type: 'set_fields'; fields: Omit<FieldDefinition, 'id'>[] }
  | { type: 'update_fields'; patches: { name: string; changes: Partial<FieldDefinition> }[] }
  | { type: 'remove_fields'; names: string[] }
  | { type: 'set_metadata'; metadata: { name?: string; description?: string } };

interface ApiResponse {
  success: boolean;
  data: {
    message: string;
    actions: ApiAction[];
  };
  error?: { code: string; message: string };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `fb_chat_${Date.now()}_${_counter}`;
}

let _fieldCounter = 0;
function generateFieldId(): string {
  _fieldCounter++;
  return `ai_field_${Date.now()}_${_fieldCounter}`;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFormBuilderChat() {
  const { state, setFields, setMetadata } = useFormBuilder();

  const [messages, setMessages] = useState<FormBuilderChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Conversation history sent to the API (excludes action summaries, etc.)
  const conversationRef = useRef<ApiConversationMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(undefined);
  const shouldAutoSendRef = useRef(false);

  // Latest canvas fields — the apply step reads THIS, not the send-time
  // closure, so a hand-edit made while the model call is in flight isn't
  // clobbered by update/remove patches (set_fields still replaces wholesale).
  const fieldsRef = useRef<FieldDefinition[]>(state.fields);
  fieldsRef.current = state.fields;

  // Voice recording
  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      // Add user message to UI
      const userMsg: FormBuilderChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add to conversation history
      conversationRef.current.push({ role: 'user', content: text });

      setIsLoading(true);

      try {
        const res = await fetch('/api/form-builder-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFields: state.fields,
            currentMetadata: {
              name: state.metadata.name,
              description: state.metadata.description,
            },
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errMsg = json.error?.message || 'Error desconocido';
          const assistantMsg: FormBuilderChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrió un error: ${errMsg}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message, actions } = json.data;

        // Apply all actions against ONE working copy (a turn can carry several
        // actions; matching against render-time state after a set_fields in the
        // same turn would use a stale snapshot). One setFields dispatch at the end.
        let working: FieldDefinition[] = [...fieldsRef.current];
        let fieldsChanged = false;
        const summaries: string[] = [];
        const warnings: string[] = [];

        for (const act of actions || []) {
          switch (act.type) {
            case 'set_fields': {
              if (act.fields.length > 0) {
                // Preserve ids of surviving fields (name match) so selection
                // and DB-born ids on /edit aren't discarded on every AI pass.
                const withIds: FieldDefinition[] = act.fields.map((f, i) => ({
                  ...f,
                  id: working.find((w) => w.name === f.name)?.id ?? generateFieldId(),
                  order: i,
                })) as FieldDefinition[];
                working = withIds;
                fieldsChanged = true;
                summaries.push(`Se aplicaron ${withIds.length} campo${withIds.length !== 1 ? 's' : ''}`);
              }
              break;
            }

            case 'update_fields': {
              let updatedCount = 0;
              for (const patch of act.patches) {
                const idx = working.findIndex((f) => f.name === patch.name);
                if (idx === -1) {
                  warnings.push(`no encontré el campo "${patch.name}"`);
                  continue;
                }
                const { id: _ignored, ...changes } = patch.changes as Partial<FieldDefinition>;
                if (Object.keys(changes).length === 0) continue;
                working[idx] = { ...working[idx], ...changes, id: working[idx].id };
                updatedCount++;
                fieldsChanged = true;
              }
              if (updatedCount > 0) {
                summaries.push(`Se actualizaron ${updatedCount} campo${updatedCount !== 1 ? 's' : ''}`);
              }
              break;
            }

            case 'remove_fields': {
              let removedCount = 0;
              for (const name of act.names) {
                const idx = working.findIndex((f) => f.name === name);
                if (idx === -1) {
                  warnings.push(`no encontré el campo "${name}"`);
                  continue;
                }
                working.splice(idx, 1);
                removedCount++;
                fieldsChanged = true;
              }
              if (removedCount > 0) {
                summaries.push(`Se eliminaron ${removedCount} campo${removedCount !== 1 ? 's' : ''}`);
              }
              break;
            }

            case 'set_metadata': {
              setMetadata(act.metadata);
              summaries.push('Se actualizó la plantilla');
              break;
            }
          }
        }

        if (fieldsChanged) {
          setFields(working); // reducer reindexes order
        }

        // Honesty: if the canvas didn't move, say so visibly instead of letting
        // the model's prose claim success.
        let content = message;
        if (warnings.length > 0) {
          content += `\n\n⚠️ No apliqué todo: ${warnings.join('; ')}.`;
        }
        if ((actions?.length ?? 0) > 0 && summaries.length === 0) {
          content += '\n\n⚠️ No se aplicó ningún cambio en el canvas.';
        }

        const assistantMsg: FormBuilderChatMessage = {
          id: generateId(),
          role: 'assistant',
          content,
          timestamp: new Date(),
          actionSummary: summaries.length > 0 ? summaries.join(' · ') : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        // History carries the warning-annotated content so the model never
        // believes a claim the canvas contradicts on the next turn.
        conversationRef.current.push({ role: 'assistant', content });
      } catch (err) {
        console.error('[useFormBuilderChat] Error:', err);
        const assistantMsg: FormBuilderChatMessage = {
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
    [isLoading, state.fields, state.metadata, setFields, setMetadata]
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
