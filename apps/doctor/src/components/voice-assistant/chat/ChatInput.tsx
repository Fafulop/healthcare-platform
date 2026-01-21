'use client';

/**
 * ChatInput
 *
 * Combined voice and text input for the chat sidebar.
 * - Voice record button (left)
 * - Text input (center)
 * - Send button (right)
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { VoiceRecordButton } from './VoiceRecordButton';

interface ChatInputProps {
  // Voice recording props
  isRecording: boolean;
  isProcessing: boolean;
  recordingDuration: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;

  // Text input props
  onSendText: (text: string) => void;

  // State
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  isRecording,
  isProcessing,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSendText,
  disabled = false,
  placeholder = 'Escriba un mensaje...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled && !isRecording && !isProcessing) {
      onSendText(text.trim());
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

  const canSend = text.trim().length > 0 && !disabled && !isRecording && !isProcessing;

  return (
    <div className="border-t border-gray-200 p-3 bg-white">
      <div className="flex items-center gap-2">
        {/* Voice record button */}
        <VoiceRecordButton
          isRecording={isRecording}
          isProcessing={isProcessing}
          duration={recordingDuration}
          disabled={disabled}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onCancel={onCancelRecording}
        />

        {/* Text input - hidden during recording */}
        {!isRecording && (
          <>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              className={`
                flex-1 px-4 py-2 rounded-full border border-gray-200
                focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
                text-sm placeholder:text-gray-400
                ${disabled || isProcessing ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
              `}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }
              `}
              title="Enviar mensaje"
            >
              <Send className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Helper text during recording */}
      {isRecording && (
        <p className="text-xs text-center text-gray-500 mt-2">
          Hable claramente. Presione el botón rojo para enviar.
        </p>
      )}
    </div>
  );
}

export default ChatInput;
