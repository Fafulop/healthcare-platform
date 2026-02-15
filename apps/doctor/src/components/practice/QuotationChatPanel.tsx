'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Sparkles, X, Bot, User, Loader2, Send, Minus, ChevronUp } from 'lucide-react';
import { VoiceRecordButton } from '@/components/voice-assistant/chat/VoiceRecordButton';
import { useQuotationChat, type QuotationChatMessage, type QuotationFormData, type QuotationItemAction } from '@/hooks/useQuotationChat';

// -----------------------------------------------------------------------------
// Markdown-like renderer
// -----------------------------------------------------------------------------

function renderContent(text: string) {
  if (!text) return null;
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
// Suggestions
// -----------------------------------------------------------------------------

const SUGGESTIONS = [
  'Cotizacion para paciente Garcia, ortodoncia a 15000 pesos',
  'Agrega limpieza dental a 1500 y blanqueamiento a 5000',
  'Cotizacion de implante dental 25000, valida por 15 dias',
];

// -----------------------------------------------------------------------------
// Single message
// -----------------------------------------------------------------------------

function MessageBubble({ message }: { message: QuotationChatMessage }) {
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

interface QuotationChatPanelProps {
  onClose: () => void;
  currentFormData: QuotationFormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateItems: (actions: QuotationItemAction[]) => void;
}

export function QuotationChatPanel({
  onClose,
  currentFormData,
  onUpdateFields,
  onUpdateItems,
}: QuotationChatPanelProps) {
  const { messages, isLoading, isTranscribing, sendMessage, clearChat, voice } =
    useQuotationChat({
      currentFormData,
      onUpdateFields,
      onUpdateItems,
    });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Draggable panel height (mobile only)
  const [panelHeight, setPanelHeight] = useState(60);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(60);

  const onDragStart = (clientY: number) => {
    isDragging.current = true;
    dragStartY.current = clientY;
    dragStartHeight.current = panelHeight;
  };

  const onDragMove = (clientY: number) => {
    if (!isDragging.current) return;
    const deltaVh = ((dragStartY.current - clientY) / window.innerHeight) * 100;
    const newHeight = Math.min(90, Math.max(25, dragStartHeight.current + deltaVh));
    setPanelHeight(newHeight);
  };

  const onDragEnd = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => onDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => onDragEnd();

  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(e.clientY);
    const onMouseMove = (ev: MouseEvent) => onDragMove(ev.clientY);
    const onMouseUp = () => {
      onDragEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed && !isLoading) {
      sendMessage(trimmed);
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

  const handleSuggestion = (s: string) => {
    sendMessage(s);
  };

  const canSend = text.trim().length > 0 && !isLoading;
  const isBusy = isLoading || isTranscribing;

  return (
    <div
      className={`fixed z-[60] flex flex-col shadow-xl transition-all duration-300 ease-in-out ${
        collapsed
          ? 'inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:top-auto sm:w-96 h-auto'
          : 'inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:!h-auto sm:w-96 rounded-t-2xl sm:rounded-none'
      } bg-white border-t sm:border-t-0 sm:border-l border-gray-200`}
      style={collapsed ? undefined : { height: `${panelHeight}vh` }}
    >
      {!collapsed && (
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 sm:py-3 border-b border-gray-200 bg-indigo-50 sm:rounded-none">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Chat IA</span>
          {collapsed && messages.length > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1">
          {messages.length > 0 && !collapsed && (
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
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors"
            title={collapsed ? 'Expandir' : 'Minimizar'}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Asistente de Cotizaciones
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Describe la cotizacion y se llenara automaticamente el formulario. Incluye paciente, servicios y condiciones.
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
                {(isLoading || isTranscribing) && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-gray-100 text-gray-500 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isTranscribing ? 'Transcribiendo...' : 'Pensando...'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 p-2 sm:p-3 bg-white">
            <div className="flex items-center gap-2">
              <VoiceRecordButton
                isRecording={voice.isRecording}
                isProcessing={voice.isProcessing}
                duration={voice.duration}
                disabled={isBusy}
                onStartRecording={voice.startRecording}
                onStopRecording={voice.stopRecording}
                onCancel={voice.cancelRecording}
              />
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describa la cotizacion..."
                disabled={isBusy}
                className={`
                  flex-1 px-3 sm:px-4 py-2.5 sm:py-2 rounded-full border border-gray-200
                  focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
                  text-sm placeholder:text-gray-400
                  ${isBusy ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
                `}
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0
                  ${canSend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }
                `}
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
