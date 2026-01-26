'use client';

/**
 * useLlmChat Hook
 * Manages chat messages, API calls, session, and loading state
 * for the LLM help assistant.
 */

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    module: string;
    submodule?: string;
    heading?: string;
  }>;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  cached?: boolean;
  timestamp: Date;
}

interface UseLlmChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (question: string) => Promise<void>;
  clearChat: () => void;
  sessionId: string;
}

function generateSessionId(): string {
  return `llm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useLlmChat(): UseLlmChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(generateSessionId());

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/llm-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          sessionId: sessionIdRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al obtener respuesta');
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.data.answer,
        sources: data.data.sources,
        confidence: data.data.confidence,
        cached: data.data.cached,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);

      // Add error message as assistant response
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearChat = useCallback(() => {
    // Clear memory on server
    fetch(`/api/llm-assistant/memory?sessionId=${sessionIdRef.current}`, {
      method: 'DELETE',
    }).catch(() => {});

    setMessages([]);
    setError(null);
    sessionIdRef.current = generateSessionId();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    sessionId: sessionIdRef.current,
  };
}
