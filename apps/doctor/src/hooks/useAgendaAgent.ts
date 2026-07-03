/**
 * useAgendaAgent — hook for the read-only agenda agent panel (PR 1).
 *
 * Sends messages to /api/agenda-agent (server runs the tool loop) and keeps
 * client-side conversation history for the session (gap G10: no persistence yet).
 */

import { useState, useCallback } from 'react';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface AgentResponse {
  success: boolean;
  data?: { reply: string; toolsUsed: string[] };
  error?: { code: string; message: string };
}

export function useAgendaAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch('/api/agenda-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, conversationHistory: history }),
        });
        const data: AgentResponse = await res.json();

        if (data.success && data.data) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.data!.reply, toolsUsed: data.data!.toolsUsed },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.error?.message || 'Ocurrió un error. Intenta de nuevo.',
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Error de conexión. Verifica tu internet e intenta de nuevo.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, loading, sendMessage, clearChat };
}
