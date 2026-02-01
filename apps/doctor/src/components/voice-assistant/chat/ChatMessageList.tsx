'use client';

/**
 * ChatMessageList
 *
 * Scrollable list of chat messages with auto-scroll to bottom.
 * Shows welcome message when empty.
 */

import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';
import type { ChatMessage, VoiceSessionType } from '@/types/voice-assistant';

interface ChatMessageListProps {
  messages: ChatMessage[];
  sessionType: VoiceSessionType;
  isProcessing?: boolean;
}

// Welcome messages per session type
const WELCOME_MESSAGES: Record<VoiceSessionType, { title: string; subtitle: string }> = {
  NEW_PATIENT: {
    title: 'Registro de Nuevo Paciente',
    subtitle: 'Dicte o escriba la información del paciente. Por ejemplo: nombre, fecha de nacimiento, teléfono, alergias...',
  },
  NEW_ENCOUNTER: {
    title: 'Nueva Consulta',
    subtitle: 'Dicte los datos de la consulta: motivo, signos vitales, exploración física, diagnóstico y plan de tratamiento.',
  },
  NEW_PRESCRIPTION: {
    title: 'Nueva Prescripción',
    subtitle: 'Dicte los medicamentos con dosis, frecuencia e instrucciones. Por ejemplo: "Amoxicilina 500mg cada 8 horas por 7 días"',
  },
  CREATE_APPOINTMENT_SLOTS: {
    title: 'Crear Horarios de Citas',
    subtitle: 'Dicte o escriba la configuración de horarios. Por ejemplo: "De lunes a viernes, de 9 a 5, citas de 60 minutos, precio 500 pesos"',
  },
  CREATE_LEDGER_ENTRY: {
    title: 'Nuevo Movimiento de Dinero',
    subtitle: 'Dicte o escriba los detalles del movimiento. Por ejemplo: "Ingreso de 500 pesos por consulta de hoy, en efectivo" o "Egreso de 1500 por compra de material médico"',
  },
  CREATE_SALE: {
    title: 'Nueva Venta',
    subtitle: 'Dicte o escriba los detalles de la venta. Por ejemplo: "Venta para Farmacia San Juan, 3 consultas a 500 pesos cada una, pago parcial de 1000 pesos"',
  },
  CREATE_PURCHASE: {
    title: 'Nueva Compra',
    subtitle: 'Dicte o escriba los detalles de la compra. Por ejemplo: "Compra a Distribuidora Médica, 10 cajas de guantes a 100 pesos, 5 frascos de suero a 80 pesos, pagado"',
  },
  NEW_TASK: {
    title: 'Nuevo Pendiente',
    subtitle: 'Dicte o escriba los detalles del pendiente. Por ejemplo: "Llamar al paciente Juan García mañana a las 10am para seguimiento de estudios"',
  },
};

export function ChatMessageList({ messages, sessionType, isProcessing }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom only when new messages arrive (not when user scrolls)
  useEffect(() => {
    // Only scroll if messages were added (not on initial load or manual scroll)
    const messagesAdded = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (!messagesAdded && !isProcessing) return;

    // Check if user is near bottom before auto-scrolling
    if (scrollRef.current && bottomRef.current) {
      const container = scrollRef.current;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom < 100; // Within 100px of bottom

      // Only auto-scroll if user is already near the bottom
      if (isNearBottom || messages.length === 1) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isProcessing]);

  const welcome = WELCOME_MESSAGES[sessionType];

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Welcome message when empty */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{welcome.title}</h3>
          <p className="text-sm text-gray-500 max-w-xs">{welcome.subtitle}</p>
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => {
        if (message.role === 'user') {
          return <UserMessage key={message.id} message={message} />;
        }
        if (message.role === 'assistant') {
          return (
            <AIMessage
              key={message.id}
              message={message}
              sessionType={sessionType}
            />
          );
        }
        // System messages (errors, etc.)
        if (message.role === 'system') {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-lg">
                {message.content}
              </div>
            </div>
          );
        }
        return null;
      })}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-gray-500">Procesando...</span>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

export default ChatMessageList;
