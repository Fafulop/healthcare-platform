/**
 * useChatSession Hook
 *
 * Manages the conversational chat flow for voice assistant.
 * Handles text and voice messages, accumulates structured data,
 * and provides confirm functionality.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import { useChatPersistence } from './useChatPersistence';
import type {
  VoiceSessionType,
  VoiceSessionContext,
  VoiceStructuredData,
  ChatMessage,
  ChatSession,
  ChatSessionStatus,
  ChatResponse,
  TranscribeResponse,
} from '@/types/voice-assistant';

export interface UseChatSessionReturn {
  // Session state
  session: ChatSession | null;
  messages: ChatMessage[];
  currentData: VoiceStructuredData | null;
  fieldsExtracted: string[];
  status: ChatSessionStatus;
  error: string | null;

  // Recording state
  isRecording: boolean;
  recordingDuration: number;
  recordingDurationFormatted: string;

  // Computed
  isReady: boolean;
  isProcessing: boolean;

  // Actions
  sendTextMessage: (text: string) => Promise<void>;
  startVoiceMessage: () => Promise<void>;
  stopVoiceMessage: () => Promise<void>;
  cancelVoiceMessage: () => void;
  confirmData: () => VoiceStructuredData | null;
  resetSession: () => void;
}

export interface InitialChatData {
  transcript: string;
  structuredData: VoiceStructuredData;
  transcriptId: string;
  sessionId: string;
  audioDuration: number;
  fieldsExtracted: string[];
}

interface UseChatSessionOptions {
  sessionType: VoiceSessionType;
  patientId: string;
  doctorId: string;
  context?: VoiceSessionContext;
  onConfirm?: (data: VoiceStructuredData) => void;
  initialData?: InitialChatData; // NEW: Seed session with initial voice recording
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create an empty session
 */
function createEmptySession(
  sessionType: VoiceSessionType,
  patientId: string,
  doctorId: string
): ChatSession {
  return {
    id: generateId(),
    sessionType,
    patientId,
    doctorId,
    messages: [],
    currentData: null,
    fieldsExtracted: [],
    status: 'idle',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a session initialized with first voice recording result
 */
function createSessionWithInitialData(
  sessionType: VoiceSessionType,
  patientId: string,
  doctorId: string,
  initialData: InitialChatData
): ChatSession {
  const now = new Date();

  // Create user message (voice transcription)
  const userMessage: ChatMessage = {
    id: generateId(),
    role: 'user',
    content: initialData.transcript,
    timestamp: now,
    status: 'sent',
    isVoice: true,
    audioDuration: initialData.audioDuration,
  };

  // Create assistant message (structured data response)
  const assistantMessage: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: generateAssistantWelcomeMessage(initialData.structuredData, sessionType),
    timestamp: now,
    status: 'sent',
    structuredData: initialData.structuredData,
    fieldsExtracted: initialData.fieldsExtracted,
  };

  return {
    id: initialData.sessionId,
    sessionType,
    patientId,
    doctorId,
    messages: [userMessage, assistantMessage],
    currentData: initialData.structuredData,
    fieldsExtracted: calculateExtractedFields(initialData.structuredData),
    status: 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate a friendly assistant message for the initial response
 */
function generateAssistantWelcomeMessage(
  data: VoiceStructuredData,
  sessionType: VoiceSessionType
): string {
  const fieldCount = calculateExtractedFields(data).length;

  const messages: Record<VoiceSessionType, string> = {
    NEW_PATIENT: `He registrado la información del paciente. Extraje ${fieldCount} campos. ¿Hay algo que quieras agregar o corregir?`,
    NEW_ENCOUNTER: `He registrado la información de la consulta. Extraje ${fieldCount} campos. ¿Deseas agregar o modificar algo?`,
    NEW_PRESCRIPTION: `He registrado la prescripción. Extraje ${fieldCount} campos. ¿Hay algo más que agregar?`,
  };

  return messages[sessionType];
}

/**
 * Merge new structured data with existing data
 * New non-null values override existing values
 */
function mergeStructuredData(
  existing: VoiceStructuredData | null,
  incoming: VoiceStructuredData | null
): VoiceStructuredData | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (value !== null && value !== undefined && value !== '') {
      (merged as any)[key] = value;
    }
  }

  return merged;
}

/**
 * Calculate all extracted fields from merged data
 */
function calculateExtractedFields(data: VoiceStructuredData | null): string[] {
  if (!data) return [];

  const extracted: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    ) {
      extracted.push(key);
    }
  }
  return extracted;
}

export function useChatSession(options: UseChatSessionOptions): UseChatSessionReturn {
  const { sessionType, patientId, doctorId, context, onConfirm, initialData } = options;

  // Persistence hook
  const { saveSession, loadSession, clearSession } = useChatPersistence();

  // Recording hook
  const recording = useVoiceRecording({
    maxDuration: 120, // 2 minutes max for chat messages
  });

  // Session state
  const [session, setSession] = useState<ChatSession | null>(null);
  const [status, setStatus] = useState<ChatSessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Track if voice recording should auto-send when stopped
  const shouldAutoSendRef = useRef(false);

  // Track if we've initialized to prevent re-initialization
  const hasInitializedRef = useRef(false);
  // Track if we've processed initialData to prevent re-processing
  const processedInitialDataIdRef = useRef<string | null>(null);

  // Load or initialize session ONCE on mount
  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Priority 1: If initialData provided at mount, use it to seed the session
    if (initialData) {
      const newSession = createSessionWithInitialData(
        sessionType,
        patientId,
        doctorId,
        initialData
      );
      setSession(newSession);
      processedInitialDataIdRef.current = initialData.sessionId;
      // Save immediately to localStorage so it persists
      saveSession(patientId, sessionType, newSession);
      return;
    }

    // Priority 2: Try to load existing session from localStorage
    const saved = loadSession(patientId, sessionType);
    if (saved) {
      setSession(saved);
      setStatus(saved.status === 'error' ? 'idle' : saved.status);
      return;
    }

    // Priority 3: Create empty session
    setSession(createEmptySession(sessionType, patientId, doctorId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only run once on mount

  // Handle late-arriving initialData (when sidebar is already mounted but data arrives later)
  useEffect(() => {
    // Skip if no initialData or if we already processed this exact initialData
    if (!initialData) return;
    if (processedInitialDataIdRef.current === initialData.sessionId) return;

    // New initialData arrived - create session with it
    const newSession = createSessionWithInitialData(
      sessionType,
      patientId,
      doctorId,
      initialData
    );
    setSession(newSession);
    processedInitialDataIdRef.current = initialData.sessionId;
    // Save immediately to localStorage so it persists
    saveSession(patientId, sessionType, newSession);
  }, [initialData, sessionType, patientId, doctorId, saveSession]);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (session && session.messages.length > 0) {
      saveSession(patientId, sessionType, session);
    }
  }, [session, patientId, sessionType, saveSession]);

  // Handle auto-send when recording stops
  useEffect(() => {
    if (recording.status === 'stopped' && recording.audioBlob && shouldAutoSendRef.current) {
      shouldAutoSendRef.current = false;
      processVoiceMessage(recording.audioBlob);
    }
  }, [recording.status, recording.audioBlob]);

  /**
   * Add a message to the session
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, message],
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Update a message in the session
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Update session data with AI response
   */
  const updateSessionData = useCallback(
    (structuredData: VoiceStructuredData | null, fieldsExtracted: string[]) => {
      setSession((prev) => {
        if (!prev) return prev;
        const mergedData = mergeStructuredData(prev.currentData, structuredData);
        const allExtracted = calculateExtractedFields(mergedData);
        return {
          ...prev,
          currentData: mergedData,
          fieldsExtracted: allExtracted,
          updatedAt: new Date(),
        };
      });
    },
    []
  );

  /**
   * Send a text message to the chat
   */
  const sendTextMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || !session) return;

      setError(null);

      // Create user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
        status: 'sent',
        isVoice: false,
      };

      addMessage(userMessage);
      setStatus('thinking');

      try {
        // Prepare messages for API (only role and content)
        const apiMessages = [...session.messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        console.log('[useChatSession] Sending chat request:', {
          sessionType,
          messageCount: apiMessages.length,
          currentData: session.currentData,
          lastMessage: text.trim()
        });

        // Call chat API
        const response = await fetch('/api/voice/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionType,
            messages: apiMessages,
            currentData: session.currentData,
            context,
          }),
        });

        const data: ChatResponse = await response.json();

        console.log('[useChatSession] Received chat response:', {
          success: data.success,
          message: data.data?.message,
          fieldsExtracted: data.data?.fieldsExtracted,
          hasStructuredData: !!data.data?.structuredData
        });

        if (!data.success || !data.data) {
          throw new Error(data.error?.message || 'Error al procesar mensaje');
        }

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date(),
          status: 'sent',
          structuredData: data.data.structuredData,
          fieldsExtracted: data.data.fieldsExtracted,
        };

        addMessage(assistantMessage);
        updateSessionData(data.data.structuredData, data.data.fieldsExtracted);
        setStatus(data.data.isComplete ? 'ready' : 'idle');
      } catch (err: any) {
        console.error('[useChatSession] Send text error:', err);
        setError(err.message || 'Error al enviar mensaje');
        setStatus('error');
      }
    },
    [session, sessionType, context, addMessage, updateSessionData]
  );

  /**
   * Process a voice message (transcribe and send)
   */
  const processVoiceMessage = useCallback(
    async (audioBlob: Blob): Promise<void> => {
      if (!session) return;

      setError(null);
      setStatus('transcribing');

      try {
        // 1. Transcribe audio
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', 'es');

        const transcribeRes = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: formData,
        });

        const transcribeData: TranscribeResponse = await transcribeRes.json();

        if (!transcribeData.success || !transcribeData.data) {
          throw new Error(transcribeData.error?.message || 'Error al transcribir audio');
        }

        const transcript = transcribeData.data.transcript;

        // Create user message with transcribed text
        const userMessage: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: transcript,
          timestamp: new Date(),
          status: 'sent',
          isVoice: true,
          audioDuration: transcribeData.data.duration,
        };

        addMessage(userMessage);
        setStatus('thinking');

        // 2. Send to chat API
        const apiMessages = [...session.messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const chatRes = await fetch('/api/voice/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionType,
            messages: apiMessages,
            currentData: session.currentData,
            context,
          }),
        });

        const chatData: ChatResponse = await chatRes.json();

        if (!chatData.success || !chatData.data) {
          throw new Error(chatData.error?.message || 'Error al procesar mensaje');
        }

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: chatData.data.message,
          timestamp: new Date(),
          status: 'sent',
          structuredData: chatData.data.structuredData,
          fieldsExtracted: chatData.data.fieldsExtracted,
        };

        addMessage(assistantMessage);
        updateSessionData(chatData.data.structuredData, chatData.data.fieldsExtracted);
        setStatus(chatData.data.isComplete ? 'ready' : 'idle');

        // Reset recording
        recording.resetRecording();
      } catch (err: any) {
        console.error('[useChatSession] Voice message error:', err);
        setError(err.message || 'Error al procesar mensaje de voz');
        setStatus('error');
        recording.resetRecording();
      }
    },
    [session, sessionType, context, addMessage, updateSessionData, recording]
  );

  /**
   * Start recording a voice message
   */
  const startVoiceMessage = useCallback(async (): Promise<void> => {
    setError(null);
    shouldAutoSendRef.current = false;
    setStatus('recording');
    await recording.startRecording();
  }, [recording]);

  /**
   * Stop recording and send the voice message
   */
  const stopVoiceMessage = useCallback(async (): Promise<void> => {
    shouldAutoSendRef.current = true;
    recording.stopRecording();
  }, [recording]);

  /**
   * Cancel recording without sending
   */
  const cancelVoiceMessage = useCallback((): void => {
    shouldAutoSendRef.current = false;
    recording.resetRecording();
    setStatus('idle');
  }, [recording]);

  /**
   * Confirm the current data and return it
   */
  const confirmData = useCallback((): VoiceStructuredData | null => {
    console.log('[useChatSession] confirmData called:', {
      hasSession: !!session,
      hasCurrentData: !!session?.currentData,
      currentData: session?.currentData,
      hasOnConfirm: !!onConfirm
    });

    if (!session?.currentData) {
      console.warn('[useChatSession] No currentData to confirm!');
      return null;
    }

    const data = session.currentData;

    console.log('[useChatSession] Calling onConfirm with data:', data);

    // Call onConfirm callback
    onConfirm?.(data);

    // Clear session from localStorage
    clearSession(patientId, sessionType);

    return data;
  }, [session, patientId, sessionType, clearSession, onConfirm]);

  /**
   * Reset the session completely
   */
  const resetSession = useCallback((): void => {
    clearSession(patientId, sessionType);
    setSession(createEmptySession(sessionType, patientId, doctorId));
    setStatus('idle');
    setError(null);
    recording.resetRecording();
  }, [patientId, sessionType, doctorId, clearSession, recording]);

  // Computed values
  const isReady = Boolean(session?.currentData && session.fieldsExtracted.length > 0);
  const isProcessing = status === 'transcribing' || status === 'thinking';

  return {
    // Session state
    session,
    messages: session?.messages || [],
    currentData: session?.currentData || null,
    fieldsExtracted: session?.fieldsExtracted || [],
    status,
    error,

    // Recording state
    isRecording: recording.isRecording,
    recordingDuration: recording.duration,
    recordingDurationFormatted: formatDuration(recording.duration),

    // Computed
    isReady,
    isProcessing,

    // Actions
    sendTextMessage,
    startVoiceMessage,
    stopVoiceMessage,
    cancelVoiceMessage,
    confirmData,
    resetSession,
  };
}

export { formatDuration };
