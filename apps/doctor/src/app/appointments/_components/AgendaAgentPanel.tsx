"use client";

/**
 * AgendaAgentPanel — chat panel for the read-only agenda agent (PR 1).
 * Side panel on desktop, bottom sheet on mobile (same layout conventions as
 * AppointmentChatPanel, without the action-confirmation UI — no writes yet).
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Bot, User, Send, X, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useAgendaAgent, type AgentMessage } from '@/hooks/useAgendaAgent';

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={j}>{part}</span>
    )
  );
}

function renderContent(content: string) {
  // Minimal markdown: **bold** + line breaks + "- "/"• " bullets as real bullets
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="flex-shrink-0 text-gray-400">•</span>
              <span>{renderInline(bullet[1])}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          {renderContent(message.content)}
        </div>
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5 px-1">
            consultó: {[...new Set(message.toolsUsed)].join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  '¿Cómo está mi agenda hoy?',
  '¿Tengo citas vencidas?',
  '¿Cuándo tengo espacio esta semana?',
];

interface AgendaAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgendaAgentPanel({ isOpen, onClose }: AgendaAgentPanelProps) {
  const { messages, loading, sendMessage, clearChat } = useAgendaAgent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = (value?: string) => {
    const trimmed = (value ?? text).trim();
    if (!trimmed || loading) return;
    sendMessage(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-[60] flex flex-col shadow-xl bg-white border-t sm:border-t-0 sm:border-l border-gray-200
        inset-x-0 bottom-0 h-[60vh] rounded-t-2xl
        sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-96 sm:rounded-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-emerald-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-800">Asistente de Agenda</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            beta · solo consulta
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Limpiar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-8 space-y-4">
            <Bot className="w-10 h-10 text-emerald-200 mx-auto" />
            <p className="text-sm text-gray-500">
              Pregúntame sobre tu agenda: citas, disponibilidad, pacientes.
            </p>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm px-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Consultando tu agenda…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta…"
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!text.trim() || loading}
            className="p-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
