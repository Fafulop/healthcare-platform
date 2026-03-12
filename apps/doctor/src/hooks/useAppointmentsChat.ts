/**
 * useAppointmentsChat
 *
 * Hook for the Appointments Chat IA panel.
 * - Sends messages to /api/appointments-chat (AI reasoning only)
 * - Validates action batches before showing confirmation
 * - Executes confirmed mutations sequentially via authFetch → apps/api
 * - Calls onRefresh once after all actions complete
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { authFetch } from '@/lib/auth-fetch';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import type { AppointmentSlot, Booking } from '@/app/appointments/useAppointmentsPage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// -----------------------------------------------------------------------------
// Action types
// -----------------------------------------------------------------------------

export interface CreateSlotsAction {
  type: 'create_slots';
  summary: string;
  date?: string;
  startTime: string;
  endTime: string;
  duration: 30 | 60;
  breakStart?: string;
  breakEnd?: string;
  recurring?: boolean;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  maxBookings?: number;
  replaceConflicts?: boolean;
}

export interface BookPatientAction {
  type: 'book_patient';
  summary: string;
  date: string;
  startTime: string;
  duration: 30 | 60;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  notes?: string;
  serviceId?: string;
}

export interface CloseSlotAction {
  type: 'close_slot';
  summary: string;
  slotId: string;
}

export interface OpenSlotAction {
  type: 'open_slot';
  summary: string;
  slotId: string;
}

export interface DeleteSlotAction {
  type: 'delete_slot';
  summary: string;
  slotId: string;
}

export interface CancelBookingAction {
  type: 'cancel_booking';
  summary: string;
  bookingId: string;
}

export interface ConfirmBookingAction {
  type: 'confirm_booking';
  summary: string;
  bookingId: string;
}

export interface CompleteBookingAction {
  type: 'complete_booking';
  summary: string;
  bookingId: string;
}

export interface RescheduleBookingAction {
  type: 'reschedule_booking';
  summary: string;
  bookingId: string;
  newDate: string;
  newStartTime: string;
  newDuration: 30 | 60;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  serviceId?: string;
}

export interface BulkCloseAction {
  type: 'bulk_close';
  summary: string;
  slotIds: string[];
}

export interface BulkOpenAction {
  type: 'bulk_open';
  summary: string;
  slotIds: string[];
}

export interface BulkDeleteAction {
  type: 'bulk_delete';
  summary: string;
  slotIds: string[];
}

export type AppointmentChatAction =
  | CreateSlotsAction
  | BookPatientAction
  | CloseSlotAction
  | OpenSlotAction
  | DeleteSlotAction
  | CancelBookingAction
  | ConfirmBookingAction
  | CompleteBookingAction
  | RescheduleBookingAction
  | BulkCloseAction
  | BulkOpenAction
  | BulkDeleteAction;

// -----------------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiResponse {
  success: boolean;
  data: { reply: string; actions: AppointmentChatAction[] };
  error?: { code: string; message: string };
}

interface DispatchResult {
  ok: boolean;
  error?: string;
}

export interface UseAppointmentsChatOptions {
  slots: AppointmentSlot[];
  bookings: Booking[];
  onRefresh: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  return `ac_${Date.now()}_${++_counter}`;
}

/** Reads JSON from a Response and converts it to a DispatchResult. */
async function toResult(res: Response, fallback: string): Promise<DispatchResult> {
  const json = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: json.error || fallback };
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const TERMINAL_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW'];

function validateActionOrder(
  actions: AppointmentChatAction[],
  slots: AppointmentSlot[],
  bookings: Booking[]
): { valid: boolean; error?: string } {

  // True if a cancel_booking for bookingId appears before index i
  function cancelAppearsBeforeIndex(bookingId: string, index: number): boolean {
    return actions.slice(0, index).some(
      (a) => a.type === 'cancel_booking' && a.bookingId === bookingId
    );
  }

  // Active (non-terminal) bookings for a given slot
  function activeBookingsForSlot(slotId: string): Booking[] {
    return bookings.filter(
      (b) => b.slotId === slotId && !TERMINAL_STATUSES.includes(b.status)
    );
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Check 1: close_slot / delete_slot with active bookings
    if (action.type === 'close_slot' || action.type === 'delete_slot') {
      const active = activeBookingsForSlot(action.slotId);
      for (const booking of active) {
        if (!cancelAppearsBeforeIndex(booking.id, i)) {
          const verb = action.type === 'close_slot' ? 'cerrar' : 'eliminar';
          return {
            valid: false,
            error: `No se puede ${verb} el horario porque la cita de ${booking.patientName} sigue activa. Indícame si también quieres cancelarla.`,
          };
        }
      }
    }

    // Check 2: bulk_close / bulk_delete with active bookings in any slot
    if (action.type === 'bulk_close' || action.type === 'bulk_delete') {
      const verb = action.type === 'bulk_close' ? 'cerrar' : 'eliminar';
      for (const slotId of action.slotIds) {
        const active = activeBookingsForSlot(slotId);
        for (const booking of active) {
          if (!cancelAppearsBeforeIndex(booking.id, i)) {
            const slot = slots.find((s) => s.id === slotId);
            const slotLabel = slot ? `${slot.date} ${slot.startTime}` : slotId;
            return {
              valid: false,
              error: `No se puede ${verb} el horario del ${slotLabel} porque la cita de ${booking.patientName} sigue activa. Indícame si también quieres cancelarla.`,
            };
          }
        }
      }
    }

    // Check 3: book_patient into a full slot
    if (action.type === 'book_patient') {
      const existing = slots.find(
        (s) => s.date === action.date && s.startTime === action.startTime
      );
      if (existing && existing.currentBookings >= existing.maxBookings) {
        const anyCancel = activeBookingsForSlot(existing.id).some(
          (b) => cancelAppearsBeforeIndex(b.id, i)
        );
        if (!anyCancel) {
          return {
            valid: false,
            error: `El horario de las ${action.startTime} del ${action.date} está lleno. Indícame si quieres cancelar alguna cita existente primero.`,
          };
        }
      }
    }

    // Check 4: reschedule_booking into a full target slot
    if (action.type === 'reschedule_booking') {
      const existing = slots.find(
        (s) => s.date === action.newDate && s.startTime === action.newStartTime
      );
      if (existing && existing.currentBookings >= existing.maxBookings) {
        const anyCancel = activeBookingsForSlot(existing.id).some(
          (b) => cancelAppearsBeforeIndex(b.id, i)
        );
        if (!anyCancel) {
          return {
            valid: false,
            error: `El horario de las ${action.newStartTime} del ${action.newDate} está lleno. Por favor elige otra hora para reagendar.`,
          };
        }
      }
    }
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// dispatchAction — standalone (no React deps, independently testable)
// -----------------------------------------------------------------------------

async function dispatchAction(
  action: AppointmentChatAction,
  doctorId: string
): Promise<DispatchResult> {
  try {
    switch (action.type) {

      case 'create_slots':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots`, {
            method: 'POST',
            body: JSON.stringify({
              doctorId,
              mode: action.recurring ? 'recurring' : 'single',
              basePrice: 0,
              maxBookings: action.maxBookings ?? 1,
              date: action.date,
              startTime: action.startTime,
              endTime: action.endTime,
              duration: action.duration,
              breakStart: action.breakStart,
              breakEnd: action.breakEnd,
              startDate: action.startDate,
              endDate: action.endDate,
              daysOfWeek: action.daysOfWeek,
              replaceConflicts: action.replaceConflicts,
            }),
          }),
          'Error al crear horarios'
        );

      case 'book_patient':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/bookings/instant`, {
            method: 'POST',
            body: JSON.stringify({
              doctorId,
              date: action.date,
              startTime: action.startTime,
              duration: action.duration,
              patientName: action.patientName,
              patientEmail: action.patientEmail,
              patientPhone: action.patientPhone,
              notes: action.notes,
              serviceId: action.serviceId,
            }),
          }),
          'Error al agendar paciente'
        );

      case 'close_slot':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/${action.slotId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isOpen: false }),
          }),
          'Error al cerrar horario'
        );

      case 'open_slot':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/${action.slotId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isOpen: true }),
          }),
          'Error al abrir horario'
        );

      case 'delete_slot':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/${action.slotId}`, {
            method: 'DELETE',
          }),
          'Error al eliminar horario'
        );

      case 'cancel_booking':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/bookings/${action.bookingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'CANCELLED' }),
          }),
          'Error al cancelar cita'
        );

      case 'confirm_booking':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/bookings/${action.bookingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'CONFIRMED' }),
          }),
          'Error al confirmar cita'
        );

      case 'complete_booking':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/bookings/${action.bookingId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'COMPLETED' }),
          }),
          'Error al completar cita'
        );

      case 'reschedule_booking': {
        // Step 1: cancel original booking
        const cancelRes = await authFetch(
          `${API_URL}/api/appointments/bookings/${action.bookingId}`,
          { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) }
        );
        if (!cancelRes.ok) return { ok: false, error: 'No se pudo cancelar la cita original' };

        // Step 2: book at new time (instant booking, always CONFIRMED)
        const bookRes = await authFetch(`${API_URL}/api/appointments/bookings/instant`, {
          method: 'POST',
          body: JSON.stringify({
            doctorId,
            date: action.newDate,
            startTime: action.newStartTime,
            duration: action.newDuration,
            patientName: action.patientName,
            patientEmail: action.patientEmail,
            patientPhone: action.patientPhone,
            serviceId: action.serviceId,
          }),
        });
        if (!bookRes.ok) {
          return {
            ok: false,
            error: 'Cita cancelada pero no se pudo agendar en el nuevo horario. Reagenda manualmente.',
          };
        }
        return { ok: true };
      }

      case 'bulk_close':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/bulk`, {
            method: 'POST',
            body: JSON.stringify({ action: 'close', slotIds: action.slotIds }),
          }),
          'Error al cerrar horarios'
        );

      case 'bulk_open':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/bulk`, {
            method: 'POST',
            body: JSON.stringify({ action: 'open', slotIds: action.slotIds }),
          }),
          'Error al abrir horarios'
        );

      case 'bulk_delete':
        return toResult(
          await authFetch(`${API_URL}/api/appointments/slots/bulk`, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', slotIds: action.slotIds }),
          }),
          'Error al eliminar horarios'
        );

      default: {
        const _exhaustive: never = action;
        return { ok: false, error: `Acción desconocida: ${(_exhaustive as any).type}` };
      }
    }
  } catch (err) {
    console.error('[useAppointmentsChat] dispatchAction error:', err);
    return { ok: false, error: 'Error de conexión. Intente de nuevo.' };
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAppointmentsChat({ slots, bookings, onRefresh }: UseAppointmentsChatOptions) {
  const { data: session } = useSession();
  const doctorId = (session?.user as any)?.doctorId as string | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingActions, setPendingActions] = useState<AppointmentChatAction[] | null>(null);

  const conversationRef = useRef<ConversationMessage[]>([]);
  const sendMessageRef = useRef<((text: string) => Promise<void>) | undefined>(undefined);
  const shouldAutoSendRef = useRef(false);

  const voice = useVoiceRecording({ maxDuration: 120 });

  // ---------------------------------------------------------------------------
  // appendAssistantMessage
  // ---------------------------------------------------------------------------

  const appendAssistantMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: generateId(), role: 'assistant', content, timestamp: new Date() };
    setMessages((prev) => [...prev, msg]);
    conversationRef.current.push({ role: 'assistant', content });
  }, []);

  // ---------------------------------------------------------------------------
  // executeActions — sequential, stop on first failure
  // ---------------------------------------------------------------------------

  const executeActions = useCallback(
    async (actions: AppointmentChatAction[]) => {
      if (!doctorId) {
        appendAssistantMessage('No se pudo obtener el ID del doctor. Recarga la página.');
        setPendingActions(null);
        return;
      }

      setLoading(true);
      let completedCount = 0;
      for (const action of actions) {
        const result = await dispatchAction(action, doctorId);
        if (!result.ok) {
          const partial = completedCount > 0
            ? ` (completé ${completedCount} de ${actions.length} acciones; los cambios anteriores ya se aplicaron)`
            : '';
          appendAssistantMessage(`Error al ejecutar "${action.summary}": ${result.error}${partial}`);
          break;
        }
        completedCount++;
      }

      if (completedCount > 0) await onRefresh();
      setLoading(false);
      setPendingActions(null);
    },
    [doctorId, appendAssistantMessage, onRefresh]
  );

  // ---------------------------------------------------------------------------
  // confirmActions / cancelActions
  // ---------------------------------------------------------------------------

  const confirmActions = useCallback(() => {
    if (!pendingActions) return;
    executeActions(pendingActions);
  }, [pendingActions, executeActions]);

  const cancelActions = useCallback(() => {
    setPendingActions(null);
    appendAssistantMessage('Acciones canceladas. ¿En qué más puedo ayudarte?');
  }, [appendAssistantMessage]);

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      if (loading || pendingActions) return;

      const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      conversationRef.current.push({ role: 'user', content: text });
      setLoading(true);

      try {
        const res = await fetch('/api/appointments-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationHistory: conversationRef.current.slice(0, -1),
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          appendAssistantMessage(json.error?.message || 'Error desconocido al procesar tu mensaje.');
          return;
        }

        const { reply, actions: _actions } = json.data;

        // PHASE 1 — query only: actions are disabled until AI query understanding is validated.
        appendAssistantMessage(reply);
      } catch (err) {
        console.error('[useAppointmentsChat] sendMessage error:', err);
        appendAssistantMessage('No pude conectarme con el servidor. Intente de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [loading, pendingActions, appendAssistantMessage]
  );

  sendMessageRef.current = sendMessage;

  // ---------------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------------

  const processVoiceMessage = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
      const json = await res.json();

      if (json.success && json.data?.transcript) {
        await sendMessageRef.current?.(json.data.transcript);
      } else {
        appendAssistantMessage(
          json.error?.message || 'No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje.'
        );
      }
    } catch {
      appendAssistantMessage('Error al transcribir el audio. Intente de nuevo.');
    } finally {
      setIsTranscribing(false);
      voice.resetRecording();
    }
  }, [appendAssistantMessage, voice.resetRecording]);

  useEffect(() => {
    if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
      shouldAutoSendRef.current = false;
      processVoiceMessage(voice.audioBlob);
    }
  }, [voice.status, voice.audioBlob, processVoiceMessage]);

  const handleVoiceStop = useCallback(() => {
    shouldAutoSendRef.current = true;
    voice.stopRecording();
  }, [voice.stopRecording]);

  // ---------------------------------------------------------------------------
  // clearChat
  // ---------------------------------------------------------------------------

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingActions(null);
    conversationRef.current = [];
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    messages,
    loading,
    pendingActions,
    sendMessage,
    confirmActions,
    cancelActions,
    clearChat,
    voice: {
      isRecording: voice.isRecording,
      isProcessing: isTranscribing,
      duration: formatDuration(voice.duration),
      startRecording: voice.startRecording,
      stopRecording: handleVoiceStop,
      cancelRecording: voice.resetRecording,
    },
  };
}
