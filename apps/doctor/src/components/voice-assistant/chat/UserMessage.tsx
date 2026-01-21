'use client';

/**
 * UserMessage
 *
 * Displays a user message bubble (right-aligned, blue).
 */

import { Mic } from 'lucide-react';
import type { ChatMessage } from '@/types/voice-assistant';

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const timestamp = new Date(message.timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1 px-1">
          {message.isVoice && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Mic className="w-3 h-3" />
              {message.audioDuration && `${Math.round(message.audioDuration)}s`}
            </span>
          )}
          <span className="text-xs text-gray-400">{timestamp}</span>
        </div>
      </div>
    </div>
  );
}

export default UserMessage;
