'use client';

/**
 * ChatMessage Component
 * Renders an individual chat message (user or assistant)
 * with basic markdown-like formatting.
 */

import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/hooks/useLlmChat';
import { ChatSources } from './ChatSources';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Simple markdown-like renderer.
 * Handles bold, lists, and line breaks.
 */
function renderContent(text: string) {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // Bullet list
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <li key={i} className="ml-4 list-disc">
          {rendered.map((r, idx) => typeof r === 'string' ? r.replace(/^[-*]\s/, '') : r)}
        </li>
      );
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <li key={i} className="ml-4 list-decimal">
          {rendered.map((r, idx) => typeof r === 'string' ? r.replace(/^\d+\.\s/, '') : r)}
        </li>
      );
    }

    // Empty line = paragraph break
    if (trimmed === '') {
      return <br key={i} />;
    }

    return <p key={i} className="mb-1">{rendered}</p>;
  });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`
          w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0
          ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}
        `}
      >
        {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      </div>

      {/* Message bubble */}
      <div className={`max-w-[85%] sm:max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`
            px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }
          `}
        >
          {renderContent(message.content)}
        </div>

        {/* Sources (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <ChatSources sources={message.sources} />
        )}
      </div>
    </div>
  );
}
