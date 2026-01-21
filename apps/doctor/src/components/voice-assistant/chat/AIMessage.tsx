'use client';

/**
 * AIMessage
 *
 * Displays an AI assistant message bubble (left-aligned, gray)
 * with optional structured data preview.
 */

import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { StructuredDataPreview } from './StructuredDataPreview';
import type { ChatMessage, VoiceSessionType } from '@/types/voice-assistant';

interface AIMessageProps {
  message: ChatMessage;
  sessionType: VoiceSessionType;
  showDataPreview?: boolean;
}

export function AIMessage({ message, sessionType, showDataPreview = true }: AIMessageProps) {
  const [isDataExpanded, setIsDataExpanded] = useState(true);

  const timestamp = new Date(message.timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const hasData =
    message.structuredData &&
    message.fieldsExtracted &&
    message.fieldsExtracted.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {/* Message bubble */}
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <Bot className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>

            {/* Data preview */}
            {showDataPreview && hasData && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setIsDataExpanded(!isDataExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {message.fieldsExtracted?.length} campos
                    </span>
                    Datos extraídos
                  </span>
                  {isDataExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {isDataExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <div className="pt-2">
                      <StructuredDataPreview
                        data={message.structuredData!}
                        sessionType={sessionType}
                        fieldsExtracted={message.fieldsExtracted}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-2 mt-1 px-1">
              <span className="text-xs text-gray-400">{timestamp}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIMessage;
