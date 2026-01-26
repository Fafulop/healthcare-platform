'use client';

/**
 * ChatInput Component
 * Text input with send button for the LLM assistant chat.
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe tu pregunta...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-gray-200 p-3 bg-white">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            flex-1 px-4 py-2 rounded-full border border-gray-200
            focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
            text-sm placeholder:text-gray-400
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
          `}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${canSend
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }
          `}
          title="Enviar pregunta"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
