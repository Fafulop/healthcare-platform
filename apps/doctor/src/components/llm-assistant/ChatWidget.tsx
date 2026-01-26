'use client';

/**
 * ChatWidget
 *
 * Floating chat bubble + expandable panel for the LLM help assistant.
 * Appears on all dashboard pages.
 */

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Trash2, Loader2 } from 'lucide-react';
import { useLlmChat } from '@/hooks/useLlmChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useLlmChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="
            fixed bottom-6 right-6 z-50
            w-14 h-14 rounded-full
            bg-blue-600 hover:bg-blue-700
            text-white shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-all active:scale-95
          "
          title="Asistente de ayuda"
        >
          <HelpCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="
            fixed bottom-6 right-6 z-50
            w-[380px] max-h-[600px]
            bg-white rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
            border border-gray-200
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <span className="font-medium text-sm">Asistente de Ayuda</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
                  title="Limpiar conversación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[440px]">
            {messages.length === 0 ? (
              <EmptyState onSuggestionClick={sendMessage} />
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
                    </div>
                    <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      )}
    </>
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
        <HelpCircle className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">
        Asistente de Ayuda
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Pregunta sobre cualquier funcionalidad del Portal Médico.
      </p>
      <div className="space-y-2 w-full">
        <SuggestionChip text="¿Cómo creo un nuevo paciente?" onClick={onSuggestionClick} />
        <SuggestionChip text="¿Cómo registro una venta?" onClick={onSuggestionClick} />
        <SuggestionChip text="¿Cómo uso el asistente de voz?" onClick={onSuggestionClick} />
      </div>
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="
        w-full text-left px-3 py-2 rounded-lg
        text-xs text-gray-600 bg-gray-50
        hover:bg-blue-50 hover:text-blue-700
        transition-colors border border-gray-100
      "
    >
      {text}
    </button>
  );
}
