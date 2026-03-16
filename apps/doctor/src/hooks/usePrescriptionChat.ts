import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecording, formatDuration } from './useVoiceRecording';
import type { Medication } from '@/components/medical-records/MedicationList';
import type { ImagingStudy, LabStudy } from '@/components/medical-records/StudyList';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PrescriptionChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionSummary?: string;
}

export interface PrescriptionFormData {
  prescriptionDate: string;
  diagnosis: string;
  clinicalNotes: string;
  doctorFullName: string;
  doctorLicense: string;
  expiresAt: string;
  medications: Medication[];
  imagingStudies: ImagingStudy[];
  labStudies: LabStudy[];
}

interface MedicationAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  medication?: Partial<Medication>;
  updates?: Partial<Medication>;
  medications?: Partial<Medication>[];
}

interface ApiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StudyAction {
  type: 'add' | 'update' | 'remove' | 'replace_all';
  index?: number;
  study?: Partial<ImagingStudy> | Partial<LabStudy>;
  updates?: Partial<ImagingStudy> | Partial<LabStudy>;
  studies?: (Partial<ImagingStudy> | Partial<LabStudy>)[];
}

interface ApiResponse {
  success: boolean;
  data: {
    message: string;
    action: 'update_fields' | 'no_change';
    fieldUpdates?: Record<string, any>;
    medicationActions?: MedicationAction[];
    imagingStudyActions?: StudyAction[];
    labStudyActions?: StudyAction[];
  };
  error?: { code: string; message: string };
}

interface UsePrescriptionChatOptions {
  currentFormData: PrescriptionFormData;
  onUpdateFields: (updates: Record<string, any>) => void;
  onUpdateMedications: (medications: Medication[]) => void;
  onUpdateImagingStudies: (studies: ImagingStudy[]) => void;
  onUpdateLabStudies: (studies: LabStudy[]) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let _counter = 0;
function generateId(): string {
  _counter++;
  return `presc_chat_${Date.now()}_${_counter}`;
}

function applyMedicationActions(
  currentMeds: Medication[],
  actions: MedicationAction[]
): Medication[] {
  let result = [...currentMeds];

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        if (action.medication) {
          result.push({
            drugName: action.medication.drugName || '',
            dosage: action.medication.dosage || '',
            frequency: action.medication.frequency || '',
            instructions: action.medication.instructions || '',
            presentation: action.medication.presentation,
            duration: action.medication.duration,
            quantity: action.medication.quantity,
            warnings: action.medication.warnings,
            order: result.length,
          });
        }
        break;
      }
      case 'update': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length && action.updates) {
          result[idx] = { ...result[idx], ...action.updates };
        }
        break;
      }
      case 'remove': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length) {
          result = result.filter((_, i) => i !== idx);
          // Re-assign order
          result = result.map((med, i) => ({ ...med, order: i }));
        }
        break;
      }
      case 'replace_all': {
        if (action.medications) {
          result = action.medications.map((med, i) => ({
            drugName: med.drugName || '',
            dosage: med.dosage || '',
            frequency: med.frequency || '',
            instructions: med.instructions || '',
            presentation: med.presentation,
            duration: med.duration,
            quantity: med.quantity,
            warnings: med.warnings,
            order: i,
          }));
        }
        break;
      }
    }
  }

  return result;
}

function applyStudyActions<T extends { studyName: string; order?: number }>(
  current: T[],
  actions: StudyAction[],
  empty: () => T
): T[] {
  let result = [...current];
  for (const action of actions) {
    switch (action.type) {
      case 'add':
        if (action.study) {
          result.push({ ...empty(), ...action.study, order: result.length } as T);
        }
        break;
      case 'update': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length && action.updates) {
          result[idx] = { ...result[idx], ...action.updates };
        }
        break;
      }
      case 'remove': {
        const idx = action.index ?? -1;
        if (idx >= 0 && idx < result.length) {
          result = result.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
        }
        break;
      }
      case 'replace_all':
        if (action.studies) {
          result = action.studies.map((s, i) => ({ ...empty(), ...s, order: i } as T));
        }
        break;
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePrescriptionChat({
  currentFormData,
  onUpdateFields,
  onUpdateMedications,
  onUpdateImagingStudies,
  onUpdateLabStudies,
}: UsePrescriptionChatOptions) {
  const [messages, setMessages] = useState<PrescriptionChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const conversationRef = useRef<ApiConversationMessage[]>([]);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(undefined);
  const shouldAutoSendRef = useRef(false);

  // Voice recording
  const voice = useVoiceRecording({ maxDuration: 120 });

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: PrescriptionChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      conversationRef.current.push({ role: 'user', content: text });

      setIsLoading(true);

      try {
        const res = await fetch('/api/prescription-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationRef.current,
            currentFormData,
          }),
        });

        const json: ApiResponse = await res.json();

        if (!json.success) {
          const errText = json.error?.message || 'Error desconocido';
          const assistantMsg: PrescriptionChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Lo siento, ocurrio un error: ${errText}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
          return;
        }

        const { message = '', action, fieldUpdates, medicationActions, imagingStudyActions, labStudyActions } = json.data;

        let fieldCount = 0;
        let medCount = 0;
        let imagingCount = 0;
        let labCount = 0;

        const hasFieldUpdates = fieldUpdates && Object.keys(fieldUpdates).length > 0;
        const hasMedActions = medicationActions && medicationActions.length > 0;
        const hasImagingActions = imagingStudyActions && imagingStudyActions.length > 0;
        const hasLabActions = labStudyActions && labStudyActions.length > 0;

        if (action !== 'no_change' || hasFieldUpdates || hasMedActions || hasImagingActions || hasLabActions) {
          if (hasFieldUpdates) {
            onUpdateFields(fieldUpdates);
            fieldCount = Object.keys(fieldUpdates).length;
          }
          if (hasMedActions) {
            const newMeds = applyMedicationActions(currentFormData.medications, medicationActions);
            onUpdateMedications(newMeds);
            medCount = medicationActions.length;
          }
          if (hasImagingActions) {
            const newStudies = applyStudyActions(
              currentFormData.imagingStudies,
              imagingStudyActions,
              () => ({ studyName: '' })
            );
            onUpdateImagingStudies(newStudies as ImagingStudy[]);
            imagingCount = imagingStudyActions.length;
          }
          if (hasLabActions) {
            const newStudies = applyStudyActions(
              currentFormData.labStudies,
              labStudyActions,
              () => ({ studyName: '' })
            );
            onUpdateLabStudies(newStudies as LabStudy[]);
            labCount = labStudyActions.length;
          }
        }

        let actionSummary: string | undefined;
        if (fieldCount > 0 || medCount > 0 || imagingCount > 0 || labCount > 0) {
          const parts: string[] = [];
          if (fieldCount > 0) parts.push(`${fieldCount} campo${fieldCount !== 1 ? 's' : ''}`);
          if (medCount > 0) parts.push(`${medCount} medicamento${medCount !== 1 ? 's' : ''}`);
          if (imagingCount > 0) parts.push(`${imagingCount} estudio${imagingCount !== 1 ? 's' : ''} de imagen`);
          if (labCount > 0) parts.push(`${labCount} estudio${labCount !== 1 ? 's' : ''} de laboratorio`);
          actionSummary = `Se actualizaron ${parts.join(', ')}`;
        }

        const assistantMsg: PrescriptionChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: message,
          timestamp: new Date(),
          actionSummary,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (message) {
          conversationRef.current.push({ role: 'assistant', content: message });
        }
      } catch (err) {
        console.error('[usePrescriptionChat] Error:', err);
        const assistantMsg: PrescriptionChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Lo siento, no pude conectarme con el servidor. Intente de nuevo.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationRef.current.push({ role: 'assistant', content: assistantMsg.content });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, currentFormData, onUpdateFields, onUpdateMedications]
  );

  // Keep a ref to latest sendMessage so processVoiceMessage can call it
  sendMessageRef.current = sendMessage;

  // Process voice recording: transcribe audio blob then send as text
  const processVoiceMessage = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();

      if (json.success && json.data?.transcript) {
        await sendMessageRef.current?.(json.data.transcript);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: json.error?.message || 'No se pudo transcribir el audio. Intente de nuevo o escriba su mensaje.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'Error al transcribir el audio. Intente de nuevo.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTranscribing(false);
      voice.resetRecording();
    }
  }, [voice.resetRecording]);

  // Auto-send when recording stops
  useEffect(() => {
    if (voice.status === 'stopped' && voice.audioBlob && shouldAutoSendRef.current) {
      shouldAutoSendRef.current = false;
      processVoiceMessage(voice.audioBlob);
    }
  }, [voice.status, voice.audioBlob, processVoiceMessage]);

  // Stop recording and flag for auto-send
  const handleVoiceStop = useCallback(() => {
    shouldAutoSendRef.current = true;
    voice.stopRecording();
  }, [voice.stopRecording]);

  const clearChat = useCallback(() => {
    setMessages([]);
    conversationRef.current = [];
  }, []);

  return {
    messages,
    isLoading,
    isTranscribing,
    sendMessage,
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
