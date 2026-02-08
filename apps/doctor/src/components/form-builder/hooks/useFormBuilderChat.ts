import { useState, useCallback, useRef } from 'react';
import { useFormBuilder } from '../FormBuilderProvider';
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

interface ApiResponse {
  success: boolean;
  data: {
    message: string;
    action: 'set_fields' | 'update_fields' | 'remove_fields' | 'set_metadata' | 'no_change';
    fields?: Omit<FieldDefinition, 'id'>[];
    fieldUpdates?: { name: string; updates: Partial<FieldDefinition> }[];
    removeFieldNames?: string[];
    metadataUpdates?: { name?: string; description?: string };
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
  const { state, setFields, updateField, removeField, setMetadata } = useFormBuilder();

  const [messages, setMessages] = useState<FormBuilderChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Conversation history sent to the API (excludes action summaries, etc.)
  const conversationRef = useRef<ApiConversationMessage[]>([]);

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

        const { message, action, fields, fieldUpdates, removeFieldNames, metadataUpdates } = json.data;

        // Apply action to canvas
        let actionSummary: string | undefined;

        switch (action) {
          case 'set_fields': {
            if (fields && fields.length > 0) {
              const withIds: FieldDefinition[] = fields.map((f, i) => ({
                ...f,
                id: generateFieldId(),
                order: i,
              })) as FieldDefinition[];
              setFields(withIds);
              actionSummary = `Se aplicaron ${withIds.length} campo${withIds.length !== 1 ? 's' : ''}`;
            }
            break;
          }

          case 'update_fields': {
            if (fieldUpdates && fieldUpdates.length > 0) {
              let updatedCount = 0;
              for (const patch of fieldUpdates) {
                const existing = state.fields.find((f) => f.name === patch.name);
                if (existing) {
                  updateField(existing.id, patch.updates);
                  updatedCount++;
                }
              }
              if (updatedCount > 0) {
                actionSummary = `Se actualizaron ${updatedCount} campo${updatedCount !== 1 ? 's' : ''}`;
              }
            }
            break;
          }

          case 'remove_fields': {
            if (removeFieldNames && removeFieldNames.length > 0) {
              let removedCount = 0;
              for (const name of removeFieldNames) {
                const existing = state.fields.find((f) => f.name === name);
                if (existing) {
                  removeField(existing.id);
                  removedCount++;
                }
              }
              if (removedCount > 0) {
                actionSummary = `Se eliminaron ${removedCount} campo${removedCount !== 1 ? 's' : ''}`;
              }
            }
            break;
          }

          case 'set_metadata': {
            if (metadataUpdates) {
              setMetadata(metadataUpdates);
              actionSummary = 'Se actualizó la plantilla';
            }
            break;
          }

          // no_change: just show the message
        }

        // Add assistant message to UI
        const assistantMsg: FormBuilderChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          actionSummary,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationRef.current.push({ role: 'assistant', content: message });
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
    [isLoading, state.fields, state.metadata, setFields, updateField, removeField, setMetadata]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    conversationRef.current = [];
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
