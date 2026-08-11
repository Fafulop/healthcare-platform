'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Sparkles, X, Bot, User, Loader2, Send, Trash2 } from 'lucide-react';
import { VoiceRecordButton } from '@/components/voice-assistant/chat/VoiceRecordButton';
import { useEncounterChat, type EncounterChatMessage, type TemplateInfo } from '@/hooks/useEncounterChat';
import type { EncounterFormData } from './EncounterForm';

// -----------------------------------------------------------------------------
// Markdown-like renderer (same pattern as AIChatPanel)
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
  'Motivo: dolor de cabeza severo',
  'Presion arterial 120/80, temperatura 37',
  'Diagnostico: migraña sin aura',
];

// -----------------------------------------------------------------------------
// Single message
// -----------------------------------------------------------------------------

// 🔴 La misma burbuja que el asistente de agenda y el del informe: avatar
// redondo de 6, doctor en azul a la derecha, asistente en el color de acento del
// panel (índigo aquí) a la izquierda. Lo único propio de este chat es el
// `renderContent` con negritas y listas, y la etiqueta de campos aplicados.
function MessageBubble({ message }: { message: EncounterChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
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

interface EncounterChatPanelProps {
  onClose: () => void;
  currentFormData: EncounterFormData;
  onUpdateForm: (updates: Partial<EncounterFormData>) => void;
  templateInfo: TemplateInfo;
  onUpdateCustomFields?: (updates: Record<string, any>) => void;
}

export function EncounterChatPanel({
  onClose,
  currentFormData,
  onUpdateForm,
  templateInfo,
  onUpdateCustomFields,
}: EncounterChatPanelProps) {
  const { messages, isLoading, isTranscribing, sendMessage, clearChat, voice } =
    useEncounterChat({
      currentFormData,
      onUpdateForm,
      templateInfo,
      onUpdateCustomFields,
    });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * 🔴 Enfocar al mandar NO alcanza: la caja se pone `disabled` mientras el
   * turno corre, el navegador desenfoca lo deshabilitado y no lo devuelve al
   * re-habilitarlo — había que volver a hacer clic para escribir el segundo
   * mensaje. Mismo arreglo (y mismas guardas) que en `ChatInforme` y
   * `AgendaAgentPanel`.
   */
  const devolverFoco = useRef(false);

  // Auto-scroll on new messages
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
      devolverFoco.current = true;
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

  // Ver `devolverFoco`. Sólo se devuelve el cursor si nadie más lo tiene: lo
  // normal en esta pantalla es seguir llenando el formulario mientras el
  // asistente contesta, y robarle el foco al doctor a media palabra (o abrirle
  // el teclado en móvil) es peor que el bug que esto arregla. Al deshabilitarse
  // el input, el navegador deja el foco en el `body`: ése es el caso a reparar.
  useEffect(() => {
    if (isBusy) return;
    if (!devolverFoco.current) return;
    devolverFoco.current = false;
    const dondeEstaElFoco = document.activeElement;
    if (dondeEstaElFoco !== null && dondeEstaElFoco !== document.body) return;
    inputRef.current?.focus();
  }, [isBusy]);

  return (
    // 🔴 Mismo armazón que `ChatInforme` y `AgendaAgentPanel`: en `lg` deja de
    // flotar y pasa a ser un HERMANO FLEX (`lg:static`), así que el formulario
    // se encoge en vez de quedar tapado. Debajo de `lg` cae a barra lateral
    // fija de altura completa, y en móvil a hoja inferior.
    <div
      className="flex flex-col shrink-0 bg-white border-gray-200 shadow-xl
        fixed z-[60] inset-x-0 bottom-0 h-[60vh] rounded-t-2xl border-t
        sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-auto sm:w-96 sm:rounded-none sm:border-t-0 sm:border-l
        lg:static lg:shadow-none lg:border-l lg:h-full lg:min-h-0"
    >
      {/* Header — mismas medidas que los otros dos chats; lo único distinto
          entre los tres es el color de acento (índigo aquí). */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-800">Chat IA</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Limpiar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center pt-8 space-y-4">
            <Bot className="w-10 h-10 text-indigo-200 mx-auto" />
            <p className="text-sm text-gray-500">
              Describe los datos del paciente y se llenaran automaticamente en el formulario.
            </p>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
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
            {isBusy && (
              <div className="flex items-center gap-2 text-gray-400 text-sm px-8">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isTranscribing ? 'Transcribiendo...' : 'Pensando...'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input with voice */}
      <div className="border-t border-gray-200 p-3">
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
            placeholder="Describe los datos del paciente..."
            disabled={isBusy}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700"
            title="Enviar mensaje"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
