'use client';

import { useEffect, useRef } from 'react';
import { Sparkles, X, Bot, User, Loader2 } from 'lucide-react';
import { ChatInput } from '@/components/llm-assistant/ChatInput';
import { useFormBuilderChat, type FormBuilderChatMessage } from './hooks/useFormBuilderChat';

// -----------------------------------------------------------------------------
// Markdown-like renderer (same pattern as ChatMessage.tsx)
// -----------------------------------------------------------------------------

function renderContent(text: string) {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <li key={i} className="ml-4 list-disc">
          {rendered.map((r) => (typeof r === 'string' ? r.replace(/^[-*]\s/, '') : r))}
        </li>
      );
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <li key={i} className="ml-4 list-decimal">
          {rendered.map((r) => (typeof r === 'string' ? r.replace(/^\d+\.\s/, '') : r))}
        </li>
      );
    }
    if (trimmed === '') return <br key={i} />;
    return <p key={i} className="mb-1">{rendered}</p>;
  });
}

// -----------------------------------------------------------------------------
// Suggestion chips
// -----------------------------------------------------------------------------

const SUGGESTIONS = [
  'Plantilla para dermatologia',
  'Evaluacion nutricional',
  'Consulta pediatrica basica',
];

// -----------------------------------------------------------------------------
// Single message
// -----------------------------------------------------------------------------

function MessageBubble({ message }: { message: FormBuilderChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-600'
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

        {/* Action summary badge */}
        {!isUser && message.actionSummary && (
          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            {message.actionSummary}
          </span>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------

interface AIChatPanelProps {
  onClose: () => void;
}

export function AIChatPanel({ onClose }: AIChatPanelProps) {
  const { messages, isLoading, sendMessage, clearChat } = useFormBuilderChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 z-10 flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Asistente IA</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-indigo-500" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Describe tu plantilla
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Dime qué campos necesitas y los creo automaticamente en el canvas.
            </p>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  className="text-xs text-left px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-gray-100 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder="Describe los campos que necesitas..."
      />
    </div>
  );
}
