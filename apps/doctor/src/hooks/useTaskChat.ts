import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import type { VoiceTaskData } from '@/types/voice-assistant';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TaskChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  dueDate: string;
  startTime: string;
  endTime: string;
  priority: string;
  category: string;
}

interface TaskAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  task?: Partial<VoiceTaskData>;
  updates?: Partial<VoiceTaskData>;
  tasks?: Partial<VoiceTaskData>[];
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
    taskActions?: TaskAction[];
  };
  error?: { code: string; message: string };
}

interface UseTaskChatOptions {
  currentFormData: TaskFormData;
  accumulatedTasks: VoiceTaskData[];
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateTasks: (tasks: VoiceTaskData[]) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `task_chat_${Date.now()}_${_counter}`;
}

function normalizeTask(partial: Partial<VoiceTaskData>): VoiceTaskData {
  return {
    title: partial.title || null,
    description: partial.description || null,
    dueDate: partial.dueDate || null,
    startTime: partial.startTime || null,
    endTime: partial.endTime || null,
    priority: partial.priority || null,
    category: partial.category || null,
    patientId: partial.patientId || null,
  };
}

function applyTaskActions(
  currentTasks: VoiceTaskData[],
  actions: TaskAction[]
): VoiceTaskData[] {
  let result = [...currentTasks];

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        if (action.task) {
          result.push(normalizeTask(action.task));
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
        if (action.tasks) {
          result = action.tasks.map(normalizeTask);
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

export function useTaskChat({
  currentFormData,
  accumulatedTasks,
  onUpdateFields,
  onUpdateTasks,
}: UseTaskChatOptions) {
  const [messages, setMessages] = useState<TaskChatMessage[]>([]);
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

      const userMsg: TaskChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      conversationRef.current.push({ role: 'user', content: text });

      setIsLoading(true);

      try {
        const res = await fetch('/api/task-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFormData,
            accumulatedTasks,
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errText = json.error?.message || 'Error desconocido';
          const assistantMsg: TaskChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errText}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message = '', action, fieldUpdates, taskActions } = json.data;

        let fieldCount = 0;
        let taskCount = 0;

        const hasFieldUpdates = fieldUpdates && Object.keys(fieldUpdates).length > 0;
        const hasTaskActions = taskActions && taskActions.length > 0;

        if (action !== 'no_change' || hasFieldUpdates || hasTaskActions) {
          // Apply flat field updates
          if (hasFieldUpdates) {
            onUpdateFields(fieldUpdates);
            fieldCount = Object.keys(fieldUpdates).length;
          }

          // Apply task actions
          if (hasTaskActions) {
            const newTasks = applyTaskActions(accumulatedTasks, taskActions);
            onUpdateTasks(newTasks);
            taskCount = taskActions.length;
          }
        }

        let actionSummary: string | undefined;
        if (fieldCount > 0 || taskCount > 0) {
          const parts: string[] = [];
          if (fieldCount > 0) parts.push(`${fieldCount} campo${fieldCount !== 1 ? 's' : ''}`);
          if (taskCount > 0) parts.push(`${taskCount} tarea${taskCount !== 1 ? 's' : ''}`);
          actionSummary = `Se actualizaron ${parts.join(' y ')}`;
        }

        const assistantMsg: TaskChatMessage = {
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
        console.error('[useTaskChat] Error:', err);
        const assistantMsg: TaskChatMessage = {
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
    [isLoading, currentFormData, accumulatedTasks, onUpdateFields, onUpdateTasks]
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
